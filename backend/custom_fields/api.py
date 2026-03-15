from django.utils import timezone

from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework.response import Response

from custom_fields.models import CustomFieldDefinition
from audit.utils import log_event, to_change_value_for_field
from core.soft_delete import TRUTHY, apply_soft_delete_filters
from core.restore_actions import SoftDeleteRestoreActionsMixin


class CustomFieldDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomFieldDefinition
        fields = [
            "id",
            "entity",
            "key",
            "label",
            "field_type",
            "required",
            "options",
            "aliases",
            "help_text",
            "sort_order",
            "is_active",
            "is_sensitive",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class CustomFieldDefinitionPermission(BasePermission):
    """Allow any authenticated user to READ definitions (needed by dynamic forms).

    Write operations require standard Django model permissions.
    """

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        # Map HTTP methods to perms
        if request.method == "POST":
            return user.has_perm("custom_fields.add_customfielddefinition")
        if request.method in {"PUT", "PATCH"}:
            return user.has_perm("custom_fields.change_customfielddefinition")
        if request.method == "DELETE":
            return user.has_perm("custom_fields.delete_customfielddefinition")
        return False


class CustomFieldDefinitionViewSet(SoftDeleteRestoreActionsMixin, viewsets.ModelViewSet):
    restore_permission = "custom_fields.change_customfielddefinition"
    queryset = CustomFieldDefinition.objects.all()
    serializer_class = CustomFieldDefinitionSerializer
    permission_classes = [CustomFieldDefinitionPermission]

    def get_queryset(self):
        qs = CustomFieldDefinition.objects.all()

        entity = (self.request.query_params.get("entity") or "").strip()
        if entity:
            qs = qs.filter(entity=entity)

        active = (self.request.query_params.get("is_active") or "").lower()
        if active in TRUTHY:
            qs = qs.filter(is_active=True)

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    def perform_destroy(self, instance):
        before = instance.deleted_at
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at", "updated_at"])
        log_event(
            actor=self.request.user,
            action="delete",
            instance=instance,
            changes={
                "deleted_at": {
                    "from": to_change_value_for_field("deleted_at", before),
                    "to":   to_change_value_for_field("deleted_at", instance.deleted_at),
                }
            },
            request=self.request,
        )

