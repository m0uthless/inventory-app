"""maintenance/api/notifications.py — MaintenanceNotification serializer + ViewSet."""
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

from maintenance.models import MaintenanceNotification

class MaintenanceNotificationSerializer(serializers.ModelSerializer):
    plan_title         = serializers.CharField(source="plan.title",    read_only=True)
    customer_code      = serializers.CharField(source="plan.customer.code", read_only=True)
    customer_name      = serializers.CharField(source="plan.customer.name", read_only=True)
    inventory_hostname = serializers.CharField(source="inventory.hostname", read_only=True)

    def run_validators(self, value):
        # UniqueTogetherValidator condizionale su `deleted_at` cerca il campo in attrs,
        # ma nei PATCH parziali i campi non inviati non sono presenti. Iniettalo
        # dall'istanza esistente (o None se è un create) prima di delegare ai validatori.
        if "deleted_at" not in value and self.instance is not None:
            value["deleted_at"] = self.instance.deleted_at
        super().run_validators(value)

    class Meta:
        model  = MaintenanceNotification
        fields = [
            "id",
            "plan",
            "plan_title",
            "inventory",
            "inventory_hostname",
            "customer_code",
            "customer_name",
            "due_date",
            "sent_at",
            "recipient_internal",
            "recipient_tech",
            "status",
            "error_message",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class MaintenanceNotificationViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = MaintenanceNotificationSerializer
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["plan", "inventory", "status"]
    search_fields    = [
        "recipient_internal",
        "recipient_tech",
        "error_message",
        "inventory__hostname",
        "plan__title",
        "plan__customer__code",
        "plan__customer__name",
    ]
    ordering_fields  = ["due_date", "sent_at", "updated_at", "created_at", "deleted_at"]
    ordering         = ["-sent_at"]

    def get_queryset(self):
        qs = (
            MaintenanceNotification.objects
            .select_related(
                "plan",
                "plan__customer",
                "inventory",
                "inventory__site",
            )
        )

        customer = self.request.query_params.get("customer")
        if customer:
            qs = qs.filter(plan__customer_id=customer)

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

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
            MaintenanceNotification.objects.filter(id__in=ids, deleted_at__isnull=False)
            .values_list("id", flat=True)
        )
        MaintenanceNotification.objects.filter(id__in=restored_ids).update(deleted_at=None, updated_at=now)
        log_event(
            actor=request.user, action="restore", instance=None,
            changes={"ids": restored_ids}, request=request,
            subject=f"bulk restore MaintenanceNotification: {restored_ids}",
        )
        return Response({"restored": restored_ids, "count": len(restored_ids)}, status=200)
