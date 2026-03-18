from django.utils import timezone
from django.db import IntegrityError, transaction
from django.db.models import Exists, F, OuterRef

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from crm.models import Site
from inventory.models import Inventory
from audit.utils import log_event, to_change_value_for_field
from issues.models import Issue, IssueStatus
from core.soft_delete import apply_soft_delete_filters
from core.crypto import decrypt
from core.integrity import raise_integrity_error_as_validation
from core.permissions import CanPurgeModelPermission, CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin, CustomFieldsValidationMixin
from core.purge_policy import try_purge_instance
from core.restore_policy import get_restore_block_reason, split_restorable


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

    def _secret_fields_present_in_input(self):
        incoming = getattr(self, "initial_data", None)
        if not incoming or not hasattr(incoming, "keys"):
            return []
        return [field for field in self._secret_fields if field in incoming]

    def enforce_secret_write_permission(self) -> None:
        secret_fields_attempted = self._secret_fields_present_in_input()
        if secret_fields_attempted and not self._can_view_secrets():
            raise PermissionDenied(
                f"Non hai i permessi per modificare campi sensibili: {', '.join(secret_fields_attempted)}."
            )

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
    customer = serializers.IntegerField(source="customer_id", read_only=True)
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    has_active_issue = serializers.BooleanField(read_only=True)
    active_issue_priority = serializers.CharField(read_only=True, allow_null=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    site = serializers.IntegerField(source="site_id", read_only=True)
    site_name = serializers.CharField(source="site.name", read_only=True)
    site_display_name = serializers.CharField(source="site.display_name", read_only=True)

    status_label = serializers.CharField(source="status.label", read_only=True)

    type_key = serializers.CharField(source="type.key", read_only=True)
    type_label = serializers.CharField(source="type.label", read_only=True)

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
            "has_active_issue",
            "active_issue_priority",
        ]


class InventoryDetailSerializer(CustomFieldsValidationMixin, SecretsPermissionMixin, serializers.ModelSerializer):
    custom_fields_entity = "inventory"
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    has_active_issue = serializers.BooleanField(read_only=True)
    active_issue_priority = serializers.CharField(read_only=True, allow_null=True)
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
            "has_active_issue",
            "active_issue_priority",
        ]
        extra_kwargs = {
            # REQUIRED via API
            "customer": {"required": True, "allow_null": False},
            "status": {"required": True, "allow_null": False},
        }

    def validate(self, attrs):
        """Required fields + consistency + custom_fields validation."""
        self.enforce_secret_write_permission()

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

        # custom_fields: delegato a CustomFieldsValidationMixin.validate()
        attrs = super().validate(attrs)
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


class InventoryViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
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
    purge_permission = "inventory.delete_inventory"

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


    def get_queryset(self):
        qs = Inventory.objects.select_related("customer", "site", "status", "type")

        # Aliases for frontend ordering fields
        active_issue_qs = Issue.objects.filter(
            inventory_id=OuterRef("pk"),
            deleted_at__isnull=True,
            status__in=[IssueStatus.OPEN, IssueStatus.IN_PROGRESS],
        )

        # Priority ordering: critical > high > medium > low
        from django.db.models import Case, Value, When, IntegerField
        priority_order = Case(
            When(priority="critical", then=Value(4)),
            When(priority="high",     then=Value(3)),
            When(priority="medium",   then=Value(2)),
            When(priority="low",      then=Value(1)),
            default=Value(0),
            output_field=IntegerField(),
        )

        from django.db.models import Subquery, CharField as DjCharField
        top_priority_qs = (
            Issue.objects.filter(
                inventory_id=OuterRef("pk"),
                deleted_at__isnull=True,
                status__in=[IssueStatus.OPEN, IssueStatus.IN_PROGRESS],
            )
            .annotate(prio_order=priority_order)
            .order_by("-prio_order")
            .values("priority")[:1]
        )

        qs = qs.annotate(
            customer_name=F("customer__name"),
            site_name=F("site__name"),
            type_label=F("type__label"),
            status_label=F("status__label"),
            has_active_issue=Exists(active_issue_qs),
            active_issue_priority=Subquery(top_priority_qs, output_field=DjCharField()),
        )

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    @action(detail=True, methods=['post'], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        inv = self.get_object()
        reason = get_restore_block_reason(inv)
        if reason:
            return Response({'detail': reason}, status=status.HTTP_409_CONFLICT)
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
    @action(detail=False, methods=['post'], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted inventory records.
        Body: {"ids": [1,2,3]} (or a raw list).
        """
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        qs = list(Inventory.objects.select_related('customer', 'site').filter(id__in=ids, deleted_at__isnull=False))
        restorable, blocked = split_restorable(qs)
        restored_ids = [obj.id for obj in restorable]
        if restored_ids:
            now = timezone.now()
            Inventory.objects.filter(id__in=restored_ids).update(
                deleted_at=None,
                updated_by=request.user,
                updated_at=now,
            )

        # Log a single audit event (content_type is nullable by design when instance=None).
        log_event(
            actor=request.user,
            action='restore',
            instance=None,
            changes={'ids': restored_ids},
            request=request,
            subject=f"bulk restore Inventory: {restored_ids}",
        )

        return Response({'restored': restored_ids, 'count': len(restored_ids), 'blocked': blocked, 'blocked_count': len(blocked)}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[CanPurgeModelPermission])
    def purge(self, request, pk=None):
        inv = Inventory.objects.filter(pk=pk, deleted_at__isnull=False).first()
        if inv is None:
            return Response({'detail': 'Elemento non trovato nel cestino.'}, status=status.HTTP_404_NOT_FOUND)
        ok, reason, blockers = try_purge_instance(inv)
        if not ok:
            return Response({'detail': reason, 'blocked': blockers}, status=status.HTTP_409_CONFLICT)
        log_event(actor=request.user, action='delete', instance=None, request=request, metadata={'purge': True}, subject=f'purge Inventory #{pk}')
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], permission_classes=[CanPurgeModelPermission])
    def bulk_purge(self, request):
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        purged = []
        blocked = []
        for obj in Inventory.objects.filter(id__in=ids, deleted_at__isnull=False):
            obj_id = obj.id
            ok, reason, blockers = try_purge_instance(obj)
            if ok:
                purged.append(obj_id)
            else:
                blocked.append({'id': obj.id, 'reason': reason, 'blocked': blockers})

        log_event(
            actor=request.user,
            action='delete',
            instance=None,
            changes={'ids': purged},
            request=request,
            metadata={'purge': True, 'blocked_count': len(blocked)},
            subject=f'bulk purge Inventory: {purged}',
        )

        return Response({'purged': purged, 'count': len(purged), 'blocked': blocked, 'blocked_count': len(blocked)}, status=status.HTTP_200_OK)

