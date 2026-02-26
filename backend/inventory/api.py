from django.utils import timezone
from django.db import IntegrityError, transaction
from django.db.models import F

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from crm.models import Site
from inventory.models import Inventory
from audit.utils import log_event, to_change_value_for_field, to_primitive
from custom_fields.validation import normalize_and_validate_custom_fields
from core.soft_delete import apply_soft_delete_filters
from core.crypto import decrypt
from core.integrity import raise_integrity_error_as_validation


class DecryptedSecretField(serializers.CharField):
    """Serializer field that transparently decrypts values stored encrypted in DB."""

    def to_representation(self, value):
        try:
            return decrypt(value)
        except Exception:
            # In case of misconfiguration (missing key) avoid crashing the API.
            # We prefer returning a placeholder over a 500.
            return None


class SecretsPermissionMixin:
    """Mixin per nascondere i campi sensibili (password) se l'utente non ha permesso."""

    _secret_fields = ("os_pwd", "app_pwd", "vnc_pwd")

    def _can_view_secrets(self) -> bool:
        request = self.context.get("request") if hasattr(self, "context") else None
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return bool(getattr(user, "is_superuser", False) or user.has_perm("inventory.view_secrets"))

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self._can_view_secrets():
            for f in self._secret_fields:
                self.fields.pop(f, None)


class InventoryListSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    site_name = serializers.CharField(source="site.name", read_only=True)

    status_label = serializers.CharField(source="status.label", read_only=True)

    type_key = serializers.CharField(source="type.key", read_only=True)
    type_label = serializers.CharField(source="type.label", read_only=True)

    class Meta:
        model = Inventory
        fields = [
            "id",
            "customer_code",
            "customer_name",
            "site_name",
            "hostname",
            "knumber",
            "serial_number",
            "type_key",
            "type_label",
            "status_label",
            "local_ip",
            "srsa_ip",
            "updated_at",
            "deleted_at",
        ]


class InventoryDetailSerializer(SecretsPermissionMixin, serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    site_name = serializers.CharField(source="site.name", read_only=True)
    site_display_name = serializers.CharField(source="site.display_name", read_only=True)

    status_key = serializers.CharField(source="status.key", read_only=True)
    status_label = serializers.CharField(source="status.label", read_only=True)

    type_key = serializers.CharField(source="type.key", read_only=True)
    type_label = serializers.CharField(source="type.label", read_only=True)

    # Decrypt secrets only for users who can see them (fields are removed by the mixin otherwise).
    os_pwd = DecryptedSecretField(required=False, allow_null=True)
    app_pwd = DecryptedSecretField(required=False, allow_null=True)
    vnc_pwd = DecryptedSecretField(required=False, allow_null=True)

    class Meta:
        model = Inventory
        fields = [
            "id",

            "customer",
            "customer_code",
            "customer_name",

            "site",
            "site_name",
            "site_display_name",

            "name",
            "knumber",
            "serial_number",

            "hostname",
            "local_ip",
            "srsa_ip",

            "type",
            "type_key",
            "type_label",

            "status",
            "status_key",
            "status_label",

            "os_user",
            "os_pwd",
            "app_usr",
            "app_pwd",
            "vnc_pwd",

            "manufacturer",
            "model",
            "warranty_end_date",

            "notes",
            "tags",
            "custom_fields",

            "created_at",
            "updated_at",
            "deleted_at",
        ]
        extra_kwargs = {
            # REQUIRED via API
            "customer": {"required": True, "allow_null": False},
            "status": {"required": True, "allow_null": False},
        }

    def validate(self, attrs):
        """Required fields + consistency + custom_fields validation."""
        # Normalize common "empty string" inputs coming from forms/CSV/imports.
        # These fields are nullable and have conditional unique constraints; keeping
        # them as "" would accidentally trigger uniqueness violations.
        for f in ("knumber", "serial_number"):
            if f in attrs:
                v = attrs.get(f)
                if isinstance(v, str):
                    v = v.strip()
                attrs[f] = None if v in (None, "") else v

        customer = attrs.get("customer") if "customer" in attrs else getattr(self.instance, "customer", None)
        status_obj = attrs.get("status") if "status" in attrs else getattr(self.instance, "status", None)
        site = attrs.get("site") if "site" in attrs else getattr(self.instance, "site", None)

        if customer is None:
            raise serializers.ValidationError({"customer": "Campo obbligatorio."})
        if status_obj is None:
            raise serializers.ValidationError({"status": "Campo obbligatorio."})

        if site is not None and customer is not None:
            if isinstance(site, Site) and site.customer_id != customer.id:
                raise serializers.ValidationError({"site": "Site non appartiene al customer selezionato."})

        # Pre-empt DB unique constraint errors with a friendly validation message.
        # Constraints are scoped to active (not soft-deleted) inventories.
        instance_pk = getattr(self.instance, "pk", None)

        serial_number = attrs.get("serial_number") if "serial_number" in attrs else None
        if serial_number:
            qs = Inventory.objects.filter(deleted_at__isnull=True, serial_number=serial_number)
            if instance_pk:
                qs = qs.exclude(pk=instance_pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"serial_number": "Serial number già presente su un inventario attivo."}
                )

        knumber = attrs.get("knumber") if "knumber" in attrs else None
        if knumber:
            qs = Inventory.objects.filter(deleted_at__isnull=True, knumber=knumber)
            if instance_pk:
                qs = qs.exclude(pk=instance_pk)
            if qs.exists():
                raise serializers.ValidationError({"knumber": "K-number già presente su un inventario attivo."})

        # Validate / normalize custom_fields based on definitions
        if self.instance is None:
            incoming_cf = attrs.get("custom_fields", {})
            normalized_cf = normalize_and_validate_custom_fields(
                entity="inventory",
                incoming=incoming_cf if incoming_cf is not None else {},
                existing=None,
                partial=False,
            )
            attrs["custom_fields"] = normalized_cf
        elif "custom_fields" in attrs:
            incoming_cf = attrs.get("custom_fields")
            normalized_cf = normalize_and_validate_custom_fields(
                entity="inventory",
                incoming=incoming_cf if incoming_cf is not None else {},
                existing=getattr(self.instance, "custom_fields", None) or {},
                partial=bool(getattr(self, "partial", False)),
            )
            attrs["custom_fields"] = normalized_cf

        return attrs


class InventoryWriteSerializer(InventoryDetailSerializer):
    class Meta(InventoryDetailSerializer.Meta):
        extra_kwargs = {
            **InventoryDetailSerializer.Meta.extra_kwargs,
            # Le password non devono essere esposte nelle risposte API di create/update
            "os_pwd": {"write_only": True, "required": False, "allow_null": True},
            "app_pwd": {"write_only": True, "required": False, "allow_null": True},
            "vnc_pwd": {"write_only": True, "required": False, "allow_null": True},
        }


class CanRestoreInventory(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.has_perm("inventory.change_inventory")
        )


class InventoryViewSet(viewsets.ModelViewSet):
    serializer_class = InventoryWriteSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["customer", "site", "status", "type"]

    search_fields = [
        "name",
        "knumber",
        "serial_number",
        "hostname",
        "local_ip",
        "srsa_ip",
        "notes",
        "site__name",
        "site__display_name",
        "customer__code",
        "customer__name",
    ]

    ordering_fields = [
        "name",
        "hostname",
        "knumber",
        "serial_number",
        # Aliases used by frontend (annotated in get_queryset)
        "customer_name",
        "site_name",
        "type_label",
        "status_label",
        "local_ip",
        "srsa_ip",
        "updated_at",
        "created_at",
        "deleted_at",
        # Backward-compatible ORM paths
        "customer__name",
        "site__name",
        "type__label",
        "status__label",
    ]
    ordering = ["hostname"]

    def get_serializer_class(self):
        # list: lightweight (no secrets), retrieve: full (includes secrets), write: secrets write-only
        if getattr(self, "action", "") == "list":
            return InventoryListSerializer
        if getattr(self, "action", "") == "retrieve":
            return InventoryDetailSerializer
        return InventoryWriteSerializer

    def create(self, request, *args, **kwargs):
        """Convert DB integrity errors into 400 ValidationError."""
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError as e:
            raise_integrity_error_as_validation(
                e,
                constraint_map={
                    "ux_inventories_knumber_active": {"knumber": "K-number già presente su un inventario attivo."},
                    "ux_inventories_serial_active": {"serial_number": "Serial number già presente su un inventario attivo."},
                },
            )

    def update(self, request, *args, **kwargs):
        """Convert DB integrity errors into 400 ValidationError."""
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError as e:
            raise_integrity_error_as_validation(
                e,
                constraint_map={
                    "ux_inventories_knumber_active": {"knumber": "K-number già presente su un inventario attivo."},
                    "ux_inventories_serial_active": {"serial_number": "Serial number già presente su un inventario attivo."},
                },
            )


    def _changes_from_validated(self, instance, validated):
        changes = {}
        for k, v in (validated or {}).items():
            before_raw = getattr(instance, k, None)
            after_raw = v
            if to_primitive(before_raw) != to_primitive(after_raw):
                changes[k] = {
                    "from": to_change_value_for_field(k, before_raw),
                    "to": to_change_value_for_field(k, after_raw),
                }
        return changes

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        changes = {
            k: {"from": None, "to": to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
        }
        log_event(actor=self.request.user, action="create", instance=instance, changes=changes, request=self.request)

    def perform_update(self, serializer):
        instance_before = serializer.instance
        changes = self._changes_from_validated(instance_before, serializer.validated_data)
        instance = serializer.save(updated_by=self.request.user)
        log_event(actor=self.request.user, action="update", instance=instance, changes=changes or None, request=self.request)


    def get_queryset(self):
        qs = Inventory.objects.select_related("customer", "site", "status", "type")

        # Aliases for frontend ordering fields
        qs = qs.annotate(
            customer_name=F("customer__name"),
            site_name=F("site__name"),
            type_label=F("type__label"),
            status_label=F("status__label"),
        )

        qs = apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

        # filtro customer via querystring
        customer = self.request.query_params.get("customer")
        if customer:
            qs = qs.filter(customer_id=customer)

        return qs

    def perform_destroy(self, instance):
        before = getattr(instance, 'deleted_at', None)
        instance.deleted_at = timezone.now()
        instance.updated_by = self.request.user
        instance.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
        changes = {
            'deleted_at': {
                'from': to_change_value_for_field('deleted_at', before),
                'to': to_change_value_for_field('deleted_at', instance.deleted_at),
            }
        }
        log_event(actor=self.request.user, action='delete', instance=instance, changes=changes, request=self.request)

    @action(detail=True, methods=['post'], permission_classes=[CanRestoreInventory])
    def restore(self, request, pk=None):
        inv = self.get_object()
        before = getattr(inv, 'deleted_at', None)
        inv.deleted_at = None
        inv.updated_by = request.user
        inv.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
        changes = {
            'deleted_at': {
                'from': to_change_value_for_field('deleted_at', before),
                'to': None,
            }
        }
        log_event(actor=request.user, action='restore', instance=inv, changes=changes, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)
    @action(detail=False, methods=['post'], permission_classes=[CanRestoreInventory])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted inventory records.
        Body: {"ids": [1,2,3]} (or a raw list).
        """
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Inventory.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for inv in qs:
            before = getattr(inv, 'deleted_at', None)
            inv.deleted_at = None
            inv.updated_by = request.user
            inv.save(update_fields=['deleted_at', 'updated_by', 'updated_at'])
            changes = {
                'deleted_at': {
                    'from': to_change_value_for_field('deleted_at', before),
                    'to': None,
                }
            }
            log_event(actor=request.user, action='restore', instance=inv, changes=changes, request=request)
            restored.append(inv.id)

        return Response({'restored': restored, 'count': len(restored)}, status=status.HTTP_200_OK)

