"""wiki/api/categories.py — WikiCategory serializer + ViewSet."""
from __future__ import annotations

from typing import ClassVar

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

from wiki.models import WikiCategory

class WikiCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = WikiCategory
        fields = [
            "id",
            "name",
            "description",
            "sort_order",
            "emoji",
            "color",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class WikiCategoryViewSet(RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    restore_has_updated_by = False
    restore_response_204   = False
    restore_use_split      = False
    restore_use_block_check = False
    serializer_class = WikiCategorySerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields: ClassVar[list[str]] = []
    search_fields = ["name", "description"]
    ordering_fields = ["sort_order", "name", "updated_at", "created_at", "deleted_at"]
    ordering = ["sort_order", "name"]

    def get_queryset(self):
        qs = WikiCategory.objects.all()
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    # WikiCategory non ha created_by/updated_by: override senza userstamp.
    def perform_create(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)
