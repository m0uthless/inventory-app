"""maintenance/api/techs.py — Tech serializer + ViewSet."""
from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import CanRestoreModelPermission, CanPurgeModelPermission
from core.mixins import SoftDeleteAuditMixin, CustomFieldsValidationMixin, RestoreActionMixin, PurgeActionMixin
from core.soft_delete import apply_soft_delete_filters
from core.purge_policy import try_purge_instance
from core.restore_policy import get_restore_block_reason, split_restorable
from audit.utils import log_event

from maintenance.models import Tech

class TechSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Tech
        fields = [
            "id", "first_name", "last_name", "full_name",
            "email", "phone", "notes", "is_active",
            "created_at", "updated_at", "deleted_at",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


class TechViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = TechSerializer
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields  = ["is_active"]
    search_fields     = ["first_name", "last_name", "email", "phone", "notes"]
    ordering_fields   = ["last_name", "first_name", "updated_at", "created_at", "deleted_at"]
    ordering          = ["last_name", "first_name"]

    def get_queryset(self):
        return apply_soft_delete_filters(
            Tech.objects.all(), request=self.request, action_name=getattr(self, "action", "")
        )

    # Tech non ha created_by/updated_by sul modello: override per non passarli.
    def perform_create(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)
    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at", "updated_at"])
        log_event(actor=request.user, action="restore", instance=obj, request=request)
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)
        now = timezone.now()
        restored_ids = list(
            Tech.objects.filter(id__in=ids, deleted_at__isnull=False)
            .values_list("id", flat=True)
        )
        Tech.objects.filter(id__in=restored_ids).update(deleted_at=None, updated_at=now)
        log_event(
            actor=request.user, action="restore", instance=None,
            changes={"ids": restored_ids}, request=request,
            subject=f"bulk restore Tech: {restored_ids}",
        )
        return Response({"restored": restored_ids, "count": len(restored_ids)}, status=200)

    @action(detail=True, methods=["post"], permission_classes=[CanPurgeModelPermission])
    def purge(self, request, pk=None):
        obj = Tech.objects.filter(pk=pk, deleted_at__isnull=False).first()
        if obj is None:
            return Response({"detail": "Elemento non trovato nel cestino."}, status=404)
        ok, reason, blockers = try_purge_instance(obj)
        if not ok:
            return Response({"detail": reason, "blocked": blockers}, status=409)
        log_event(
            actor=request.user, action="delete", instance=None, request=request,
            metadata={"purge": True}, subject=f"purge Tech #{pk}",
        )
        return Response(status=204)

    @action(detail=False, methods=["post"], permission_classes=[CanPurgeModelPermission])
    def bulk_purge(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)
        purged = []
        blocked = []
        for obj in Tech.objects.filter(id__in=ids, deleted_at__isnull=False):
            obj_id = obj.id
            ok, reason, blockers = try_purge_instance(obj)
            if ok:
                purged.append(obj_id)
            else:
                blocked.append({"id": obj.id, "reason": reason, "blocked": blockers})
        log_event(
            actor=request.user, action="delete", instance=None, changes={"ids": purged},
            request=request, metadata={"purge": True, "blocked_count": len(blocked)},
            subject=f"bulk purge Tech: {purged}",
        )
        return Response(
            {"purged": purged, "count": len(purged), "blocked": blocked, "blocked_count": len(blocked)},
            status=200,
        )


