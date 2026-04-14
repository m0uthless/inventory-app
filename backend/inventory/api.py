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
from audit.utils import log_event
from issues.models import Issue, IssueStatus
from core.soft_delete import apply_soft_delete_filters
from core.crypto import decrypt
from core.integrity import raise_integrity_error_as_validation
from core.permissions import CanPurgeModelPermission, CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin, CustomFieldsValidationMixin, RestoreActionMixin, PurgeActionMixin
from auslbo.mixins import AuslBoScopedMixin


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

    status_key   = serializers.CharField(source="status.key",   read_only=True)
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
            "status_key",
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

    status_key   = serializers.CharField(source="status.key",   read_only=True)
    status_label = serializers.CharField(source="status.label", read_only=True)

    type_key = serializers.CharField(source="type.key", read_only=True)
    type_label = serializers.CharField(source="type.label", read_only=True)

    # Decrypt secrets only for users who can see them (fields are removed by the mixin otherwise).
    os_pwd = DecryptedSecretField(required=False, allow_null=True)
    app_pwd = DecryptedSecretField(required=False, allow_null=True)
    vnc_pwd = DecryptedSecretField(required=False, allow_null=True)

    monitors = serializers.SerializerMethodField()

    def get_monitors(self, obj):
        qs = obj.monitors.filter(deleted_at__isnull=True).order_by("produttore", "modello")
        return [
            {
                "id": m.id,
                "produttore": m.produttore,
                "modello": m.modello,
                "seriale": m.seriale,
                "tipo_label": m.get_tipo_display(),
                "stato": m.stato,
                "stato_label": m.get_stato_display(),
                "radinet": m.radinet,
            }
            for m in qs
        ]

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
            "monitors",
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


class InventoryViewSet(AuslBoScopedMixin, PurgeActionMixin, RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
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
        if getattr(self, "action", "") == "retrieve":
            from inventory.models import Monitor as _Monitor
            from django.db.models import Prefetch as _Prefetch
            qs = qs.prefetch_related(
                _Prefetch("monitors", queryset=_Monitor.objects.filter(deleted_at__isnull=True).order_by("produttore", "modello"))
            )

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


# ─── Monitor ──────────────────────────────────────────────────────────────────

from inventory.models import Monitor


class MonitorSerializer(serializers.ModelSerializer):
    # Campi leggibili in sola lettura per il frontend
    inventory_name = serializers.CharField(source="inventory.name", read_only=True, default=None)
    site_name      = serializers.SerializerMethodField()
    stato_label    = serializers.CharField(source="get_stato_display", read_only=True)
    tipo_label     = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model  = Monitor
        fields = [
            "id",
            "inventory",
            "inventory_name",
            "site_name",
            "produttore",
            "modello",
            "seriale",
            "stato",
            "stato_label",
            "tipo",
            "tipo_label",
            "radinet",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = ["id", "inventory_name", "site_name", "stato_label", "tipo_label", "created_at", "updated_at", "deleted_at"]

    def get_site_name(self, obj) -> str | None:
        try:
            return obj.inventory.site.name if obj.inventory.site else None
        except Exception:
            return None

    def validate(self, attrs):
        # Ricostruisce l'istanza parziale per eseguire il clean() del modello
        instance = Monitor(**attrs)
        instance.clean()
        return attrs


class MonitorViewSet(RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    """CRUD monitor. Filtrabili per inventory, stato, tipo.

    Supporta soft-delete con cestino:
      ?include_deleted=1  -> include attivi + eliminati
      ?only_deleted=1     -> solo eliminati (cestino)
    Endpoint extra: POST /monitors/{id}/restore/
    """

    serializer_class   = MonitorSerializer
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["inventory", "stato", "tipo", "radinet"]
    search_fields      = ["produttore", "modello", "seriale"]
    ordering_fields    = ["produttore", "modello", "stato", "tipo", "created_at", "updated_at"]
    ordering           = ["produttore", "modello"]

    # Monitor non ha updated_by
    restore_has_updated_by = False

    def get_queryset(self):
        qs = Monitor.objects.select_related("inventory", "inventory__site")
        return apply_soft_delete_filters(
            qs,
            request=self.request,
            action_name=self.action,
        )
