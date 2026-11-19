"""wiki/api/links.py — WikiLink serializer + ViewSet."""
from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status as drf_status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.permissions import CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin, RestoreActionMixin
from core.soft_delete import apply_soft_delete_filters
from audit.utils import log_event, to_change_value_for_field

from wiki.models import WikiEntityType, WikiLink
from wiki.api.helpers import _label_for_wiki_link, _path_for_wiki_link

class WikiLinkSerializer(serializers.ModelSerializer):
    page_title = serializers.CharField(source="page.title", read_only=True)
    entity_label = serializers.SerializerMethodField()
    entity_path = serializers.SerializerMethodField()

    def get_entity_label(self, obj):
        label = _label_for_wiki_link(obj.entity_type, obj.entity_id)
        if label:
            return label
        fallback_type = {
            "customer": "Cliente",
            "site": "Sito",
            "inventory": "Inventory",
        }.get(obj.entity_type, obj.entity_type.capitalize())
        return f"{fallback_type} #{obj.entity_id}"

    def get_entity_path(self, obj):
        return _path_for_wiki_link(obj.entity_type, obj.entity_id)

    class Meta:
        model = WikiLink
        fields = [
            "id",
            "page",
            "page_title",
            "entity_type",
            "entity_id",
            "entity_label",
            "entity_path",
            "notes",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class WikiLinkViewSet(RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    restore_has_updated_by  = False
    restore_response_204    = False
    restore_use_split       = False
    restore_use_block_check = False
    serializer_class = WikiLinkSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["entity_type", "entity_id"]
    search_fields = ["notes", "page__title", "entity_type"]
    ordering_fields = ["updated_at", "created_at", "entity_type", "entity_id", "deleted_at"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        qs = WikiLink.objects.select_related("page")
        page_id = self.request.query_params.get("page_id")
        if page_id not in (None, ""):
            try:
                qs = qs.filter(page_id=int(page_id))
            except (TypeError, ValueError):
                qs = qs.none()
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    def _check_issue_link(self, entity_type, entity_id):
        """Un collegamento Wiki su una issue è una scrittura sulla issue: per le
        issue di un'altra area vale la sola lettura (vedi issues.api)."""
        if entity_type != WikiEntityType.ISSUE or entity_id is None:
            return
        from issues.api import can_edit_issue
        from issues.models import Issue

        issue = Issue.objects.filter(pk=entity_id).only("id", "area_id").first()
        if issue is not None and not can_edit_issue(self.request.user, issue):
            raise PermissionDenied("Puoi modificare solo le issue della tua area.")

    def _restore_obj(self, obj, request):
        self._check_issue_link(obj.entity_type, obj.entity_id)
        super()._restore_obj(obj, request)

    def perform_destroy(self, instance):
        self._check_issue_link(instance.entity_type, instance.entity_id)
        super().perform_destroy(instance)

    # WikiLink non ha created_by/updated_by: override senza userstamp.
    def perform_create(self, serializer):
        self._check_issue_link(serializer.validated_data.get("entity_type"), serializer.validated_data.get("entity_id"))
        instance = serializer.save()
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        self._check_issue_link(serializer.instance.entity_type, serializer.instance.entity_id)
        self._check_issue_link(
            serializer.validated_data.get("entity_type", serializer.instance.entity_type),
            serializer.validated_data.get("entity_id", serializer.instance.entity_id),
        )
        instance = serializer.save()
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)
