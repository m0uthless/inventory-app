from django.utils import timezone

from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework.response import Response

from custom_fields.models import CustomFieldDefinition


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


class CanRestoreCustomFieldDefinition(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.has_perm("custom_fields.change_customfielddefinition")
        )


class CustomFieldDefinitionViewSet(viewsets.ModelViewSet):
    queryset = CustomFieldDefinition.objects.all()
    serializer_class = CustomFieldDefinitionSerializer
    permission_classes = [CustomFieldDefinitionPermission]

    def get_queryset(self):
        qs = CustomFieldDefinition.objects.all()

        entity = (self.request.query_params.get("entity") or "").strip()
        if entity:
            qs = qs.filter(entity=entity)

        truthy = {"1", "true", "yes", "on"}
        active = (self.request.query_params.get("is_active") or "").lower()
        if active in truthy:
            qs = qs.filter(is_active=True)

        include_deleted = (self.request.query_params.get("include_deleted") or "").lower()
        only_deleted = (self.request.query_params.get("only_deleted") or "").lower()

        if getattr(self, "action", "") == "restore":
            include_deleted = "1"

        if only_deleted in truthy:
            return qs.filter(deleted_at__isnull=False)
        if include_deleted in truthy:
            return qs
        return qs.filter(deleted_at__isnull=True)

    def perform_destroy(self, instance):
        # soft-delete, to be consistent with the rest of the app
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at", "updated_at"])

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreCustomFieldDefinition])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
    @action(detail=False, methods=["post"], permission_classes=[CanRestoreCustomFieldDefinition])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted custom field definitions.
        Body: {"ids": [1,2,3]} (or a raw list).
        """
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

        qs = CustomFieldDefinition.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)

        return Response({"restored": restored, "count": len(restored)}, status=status.HTTP_200_OK)

