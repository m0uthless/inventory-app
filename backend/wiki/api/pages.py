"""wiki/api/pages.py — WikiPage serializer + ViewSet."""
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

import io
import re
from html import unescape
from django.db import models as django_models
from django.http import HttpResponse
from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from wiki.models import WikiPage, WikiPageRating, WikiPageRevision
from wiki.api.helpers import _markdown_to_html, _markdown_to_plain_text, _slug_is_available, _suggest_available_slug

class WikiPageSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    average_rating = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()
    current_user_rating = serializers.SerializerMethodField()
    attachment_count = serializers.SerializerMethodField()
    created_by_username = serializers.SerializerMethodField()
    updated_by_username = serializers.SerializerMethodField()

    def get_average_rating(self, obj):
        value = getattr(obj, "average_rating", None)
        if value is None:
            value = obj.ratings.aggregate(avg=django_models.Avg("rating"))["avg"]
        return round(float(value), 1) if value is not None else None

    def get_rating_count(self, obj):
        value = getattr(obj, "rating_count", None)
        if value is None:
            value = obj.ratings.count()
        return int(value or 0)

    def get_current_user_rating(self, obj):
        prefetched = getattr(obj, "_current_user_ratings", None)
        if prefetched is not None:
            return prefetched[0].rating if prefetched else None

        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None

        return obj.ratings.filter(user=user).values_list("rating", flat=True).first()

    def get_attachment_count(self, obj):
        value = getattr(obj, "attachment_count", None)
        if value is None:
            value = obj.attachments.count()
        return int(value or 0)

    def get_created_by_username(self, obj):
        u = obj.created_by
        if not u:
            return None
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    def get_updated_by_username(self, obj):
        u = obj.updated_by
        if not u:
            return None
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    class Meta:
        model = WikiPage
        fields = [
            "id",
            "kb_code",
            "title",
            "slug",
            "category",
            "category_name",
            "summary",
            "tags",
            "content_markdown",
            "is_published",
            "view_count",
            "average_rating",
            "rating_count",
            "current_user_rating",
            "attachment_count",
            "custom_fields",
            "pdf_template_key",
            "pdf_options",
            "created_by_username",
            "updated_by_username",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = ["kb_code", "view_count"]


class WikiPageViewSet(RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    restore_has_updated_by  = True
    restore_response_204    = False
    restore_use_split       = False
    restore_use_block_check = False
    serializer_class = WikiPageSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["category", "is_published", "slug"]
    search_fields = ["title", "slug", "summary", "content_markdown"]
    ordering_fields = [
        "title",
        "updated_at",
        "created_at",
        "deleted_at",
        "average_rating",
        "rating_count",
        "view_count",
        "attachment_count",
    ]
    ordering = ["title"]

    def get_queryset(self):
        qs = (
            WikiPage.objects
            .select_related("category", "created_by", "updated_by")
            .annotate(
                average_rating=django_models.Avg("ratings__rating"),
                rating_count=django_models.Count("ratings", distinct=True),
                attachment_count=django_models.Count("attachments", distinct=True),
            )
        )

        user = getattr(self.request, "user", None)
        if user and user.is_authenticated:
            qs = qs.prefetch_related(
                django_models.Prefetch(
                    "ratings",
                    queryset=WikiPageRating.objects.filter(user=user),
                    to_attr="_current_user_ratings",
                )
            )

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    @action(detail=False, methods=["get"], url_path="slug-availability")
    def slug_availability(self, request):
        raw_slug = (request.query_params.get("slug") or "").strip()
        exclude_id_raw = request.query_params.get("exclude_id")
        exclude_id = None
        if exclude_id_raw not in (None, ""):
            try:
                exclude_id = int(exclude_id_raw)
            except (TypeError, ValueError):
                return Response({"detail": "exclude_id non valido."}, status=400)

        if not raw_slug:
            return Response({"detail": "slug obbligatorio."}, status=400)

        available = _slug_is_available(slug=raw_slug, exclude_id=exclude_id)
        suggested = raw_slug if available else _suggest_available_slug(raw_slug, exclude_id=exclude_id)
        return Response({"slug": raw_slug, "available": available, "suggested_slug": suggested})

    @action(detail=True, methods=["get"], url_path="render")
    def render_page(self, request, pk=None):
        """Return rendered (sanitized) HTML for a wiki page's markdown."""

        page = self.get_object()
        html = _markdown_to_html(page.content_markdown or "")
        return Response({"id": page.id, "title": page.title, "slug": page.slug, "html": html})

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        """Export the wiki page as a simple PDF (server-side)."""

        page = self.get_object()

        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.units import cm
            from reportlab.pdfgen import canvas
        except Exception as e:
            return Response({"detail": f"PDF export dependency missing: {e}"}, status=501)

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4

        left = 2 * cm
        right = 2 * cm
        top = 2 * cm
        bottom = 2 * cm
        _ = width - left - right  # max_w (kept for clarity)

        # Title
        y = height - top
        c.setFont("Helvetica-Bold", 16)
        c.drawString(left, y, unescape(page.title or "Wiki page"))
        y -= 24

        # Body text
        c.setFont("Helvetica", 10)
        text = _markdown_to_plain_text(page.content_markdown or "")

        def wrap_line(line: str, max_chars: int) -> list[str]:
            if not line:
                return [""]
            out: list[str] = []
            cur = ""
            for word in line.split():
                if len(cur) + (1 if cur else 0) + len(word) <= max_chars:
                    cur = f"{cur} {word}".strip()
                else:
                    out.append(cur)
                    cur = word
            if cur:
                out.append(cur)
            return out

        # Very rough char-based wrap; good enough for readable PDFs
        max_chars = 110
        lines: list[str] = []
        for para in re.split(r"\n\n+", text):
            para = para.strip()
            if not para:
                lines.append("")
                continue
            for ln in para.splitlines():
                lines.extend(wrap_line(ln, max_chars))
            lines.append("")

        line_h = 13
        for ln in lines:
            if y <= bottom:
                c.showPage()
                c.setFont("Helvetica", 10)
                y = height - top
            c.drawString(left, y, ln)
            y -= line_h

        c.save()
        buf.seek(0)

        filename = re.sub(r"[^A-Za-z0-9._-]+", "_", page.slug or f"wiki_{page.id}") + ".pdf"
        resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp

    def perform_create(self, serializer):
        instance = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        instance.kb_code = f"KB{instance.pk:07d}"
        instance.save(update_fields=["kb_code"])
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    @action(detail=True, methods=["post"], url_path="view", permission_classes=[IsAuthenticated])
    def record_view(self, request, pk=None):
        """Incrementa il contatore visualizzazioni atomicamente."""
        WikiPage.objects.filter(pk=pk).update(view_count=django_models.F("view_count") + 1)
        return Response({"ok": True})

    @action(detail=True, methods=["post"], url_path="rate", permission_classes=[IsAuthenticated])
    def rate_page(self, request, pk=None):
        page = self.get_object()
        raw_rating = request.data.get("rating") if isinstance(request.data, dict) else None

        try:
            rating = int(raw_rating)
        except (TypeError, ValueError):
            return Response({"detail": "rating deve essere un intero tra 1 e 5."}, status=400)

        if rating < 1 or rating > 5:
            return Response({"detail": "rating deve essere compreso tra 1 e 5."}, status=400)

        # Usa get_or_create per evitare la race condition check-then-act:
        # due richieste concorrenti dello stesso utente non possono creare
        # due rating distinti grazie all'atomicità della query.
        _, created = WikiPageRating.objects.get_or_create(
            page=page,
            user=request.user,
            defaults={"rating": rating},
        )
        if not created:
            return Response({"detail": "Hai già votato questa pagina."}, status=400)
        log_event(
            actor=request.user,
            action="rate",
            instance=page,
            changes={"rating": rating},
            request=request,
            subject=f"wiki rating page {page.pk}: {rating}",
        )

        refreshed = self.get_queryset().get(pk=page.pk)
        return Response(self.get_serializer(refreshed).data, status=201)

    def perform_update(self, serializer):
        instance = serializer.instance
        # Snapshot della versione corrente PRIMA di sovrascrivere.
        # Lockiamo la riga della pagina per serializzare gli update concorrenti:
        # se non esistono ancora revisioni, il lock sulla pagina evita comunque
        # che due thread calcolino entrambi revision_number=1.
        from django.db import transaction
        with transaction.atomic():
            WikiPage.objects.select_for_update().filter(pk=instance.pk).get()
            last_rev = (
                WikiPageRevision.objects
                .filter(page=instance)
                .order_by("-revision_number")
                .first()
            )
            next_num = (last_rev.revision_number + 1) if last_rev else 1
            WikiPageRevision.objects.create(
                page=instance,
                revision_number=next_num,
                title=instance.title,
                summary=instance.summary,
                tags=instance.tags,
                content_markdown=instance.content_markdown or "",
                saved_by=self.request.user,
            )
            updated = serializer.save(updated_by=self.request.user)
        log_event(actor=self.request.user, action="update", instance=updated, request=self.request)
