from __future__ import annotations

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import CanRestoreModelPermission


class SoftDeleteRestoreActionsMixin:
    """Reusable restore / bulk_restore actions for soft-deleted models.

    Defaults are intentionally conservative:
    - `restore` returns 204 No Content
    - `bulk_restore` returns {restored, count}
    - permission is delegated to CanRestoreModelPermission, optionally using
      `restore_permission` on the viewset

    Viewsets can override hook methods for audit logging or business rules.
    """

    restore_detail_status = status.HTTP_204_NO_CONTENT
    restore_returns_instance = False
    bulk_restore_status = status.HTTP_200_OK

    def get_restore_model(self):
        queryset = getattr(self, "queryset", None)
        if queryset is not None:
            return queryset.model
        return self.get_queryset().model

    def get_restore_base_queryset(self):
        return self.get_restore_model()._default_manager.all()

    def _restore_has_field(self, field_name: str) -> bool:
        model = self.get_restore_model()
        try:
            model._meta.get_field(field_name)
            return True
        except Exception:
            return False

    def get_restore_update_kwargs(self, request, *, now=None):
        now = now or timezone.now()
        values = {"deleted_at": None}
        if self._restore_has_field("updated_by"):
            values["updated_by"] = request.user
        if self._restore_has_field("updated_at"):
            values["updated_at"] = now
        return values

    def get_restore_update_fields(self, request, *, now=None):
        return list(self.get_restore_update_kwargs(request, now=now).keys())

    def parse_bulk_restore_ids(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return None
        return ids

    def before_restore_instance(self, obj, request):
        return getattr(obj, "deleted_at", None)

    def after_restore_instance(self, obj, request, context):
        return None

    def after_bulk_restore(self, restored_ids, request):
        return None

    def perform_restore_instance(self, obj, request):
        now = timezone.now()
        context = self.before_restore_instance(obj, request)
        values = self.get_restore_update_kwargs(request, now=now)
        for field_name, value in values.items():
            setattr(obj, field_name, value)
        obj.save(update_fields=self.get_restore_update_fields(request, now=now))
        self.after_restore_instance(obj, request, context)
        return obj

    def perform_bulk_restore(self, queryset, request, restored_ids):
        queryset.update(**self.get_restore_update_kwargs(request, now=timezone.now()))
        self.after_bulk_restore(restored_ids, request)

    def build_restore_response(self, obj):
        if self.restore_returns_instance:
            return Response(self.get_serializer(obj).data, status=self.restore_detail_status)
        return Response(status=self.restore_detail_status)

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission], url_path="restore")
    def restore(self, request, pk=None):
        obj = self.get_object()
        self.perform_restore_instance(obj, request)
        return self.build_restore_response(obj)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission], url_path="bulk_restore")
    def bulk_restore(self, request):
        ids = self.parse_bulk_restore_ids(request)
        if ids is None:
            return Response({"detail": "ids must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_restore_base_queryset().filter(id__in=ids, deleted_at__isnull=False)
        restored_ids = list(queryset.values_list("id", flat=True))
        if restored_ids:
            self.perform_bulk_restore(queryset.filter(id__in=restored_ids), request, restored_ids)
        return Response({"restored": restored_ids, "count": len(restored_ids)}, status=self.bulk_restore_status)
