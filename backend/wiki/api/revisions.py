"""wiki/api/revisions.py — WikiPageRevision serializer + ViewSet."""
from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status as drf_status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.permissions import CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin, RestoreActionMixin
from core.soft_delete import apply_soft_delete_filters
from audit.utils import log_event, to_change_value_for_field

from wiki.models import WikiPageRevision, WikiPage
from wiki.api.helpers import _markdown_to_html


class WikiPageRevisionSerializer(serializers.ModelSerializer):
    saved_by_username = serializers.SerializerMethodField()

    def get_saved_by_username(self, obj):
        u = obj.saved_by
        if not u:
            return None
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    class Meta:
        model = WikiPageRevision
        fields = [
            "id",
            "page",
            "revision_number",
            "title",
            "summary",
            "tags",
            "content_markdown",
            "saved_by_username",
            "saved_at",
        ]
        read_only_fields = fields


class WikiPageRevisionViewSet(viewsets.ReadOnlyModelViewSet):
    """Revisioni in sola lettura. Il restore avviene tramite action dedicata."""
    serializer_class = WikiPageRevisionSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = []
    ordering_fields = ["revision_number", "saved_at"]
    ordering = ["-revision_number"]

    def get_queryset(self):
        qs = WikiPageRevision.objects.select_related("saved_by", "page")
        page_id = self.request.query_params.get("page_id")
        if page_id not in (None, ""):
            try:
                qs = qs.filter(page_id=int(page_id))
            except (TypeError, ValueError):
                qs = qs.none()
        return qs

    @action(detail=True, methods=["get"], url_path="render")
    def render_revision(self, request, pk=None):
        rev = self.get_object()
        html = _markdown_to_html(rev.content_markdown or "")
        return Response({"id": rev.id, "title": rev.title, "html": html})

    @action(detail=True, methods=["post"], url_path="restore", permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        """Ripristina la pagina a questa revisione creando una nuova revisione."""
        rev = self.get_object()
        page = rev.page

        from django.db import transaction
        with transaction.atomic():
            # Lockiamo la pagina per serializzare i restore concorrenti.
            WikiPage.objects.select_for_update().filter(pk=page.pk).get()
            last = (
                WikiPageRevision.objects
                .filter(page=page)
                .order_by("-revision_number")
                .first()
            )
            next_num = (last.revision_number + 1) if last else 1
            WikiPageRevision.objects.create(
                page=page,
                revision_number=next_num,
                title=page.title,
                summary=page.summary,
                tags=page.tags,
                content_markdown=page.content_markdown or "",
                saved_by=request.user,
            )

            # Applica la revisione scelta
            page.title = rev.title
            page.summary = rev.summary
            page.tags = rev.tags
            page.content_markdown = rev.content_markdown
            page.updated_by = request.user
            page.save(update_fields=["title", "summary", "tags", "content_markdown", "updated_by", "updated_at"])

        from wiki.api import WikiPageSerializer
        return Response(WikiPageSerializer(page, context={"request": request}).data)


# -------------------------
