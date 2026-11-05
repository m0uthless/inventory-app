from django.utils import timezone
from django.db import IntegrityError, transaction
import datetime

import django_filters as filters
from django.db.models import Count, Exists, F, OuterRef, Q

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
from portal.mixins import PortalScopedMixin, PortalTenantWriteMixin
from portal.permissions import IsPortalUserOrInternal, CrmInventoryModelPermissions


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
            "model",
            "serial_number",
            "type_key",
            "type_label",
            "status_key",
            "status_label",
            "local_ip",
            "srsa_ip",
            "location",
            "telefono",
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
            "location",
            "telefono",

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

        # NOTA DATA-002 (0.9.1, archie-dataconstraints, confermato con Fede):
        # il knumber NON è univoco per design — un host fisico e le sue
        # macchine virtuali possono legittimamente condividere lo stesso
        # K-number. Coerente con la rimozione deliberata del vincolo DB
        # (migration 0007/0008) e con la migration 0013 che ha reintrodotto
        # SOLO il vincolo su serial_number. Blocco applicativo rimosso.

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


# Stati "non operativi": il sistema c'è ma non lavora (dismessi esclusi).
INV_NOT_OPERATIONAL = ("to_install", "maintenance", "repair")
# Inventario "da completare": senza sito o senza IP locale.
INV_INCOMPLETE = Q(site__isnull=True) | Q(local_ip__isnull=True) | Q(local_ip="")


class InventoryFilter(filters.FilterSet):
    """Filtri della lista inventari: ricerca per colonna (restyle) e viste."""
    name_q = filters.CharFilter(field_name="name", lookup_expr="icontains")
    hostname_q = filters.CharFilter(field_name="hostname", lookup_expr="icontains")
    customer_q = filters.CharFilter(method="filter_customer_q")
    site_q = filters.CharFilter(method="filter_site_q")
    ip_q = filters.CharFilter(method="filter_ip_q")
    code_q = filters.CharFilter(method="filter_code_q")
    has_active_issue = filters.BooleanFilter(field_name="has_active_issue")
    not_operational = filters.BooleanFilter(method="filter_not_operational")
    incomplete = filters.BooleanFilter(method="filter_incomplete")

    class Meta:
        model = Inventory
        fields = ["customer", "site", "status", "type"]

    def filter_customer_q(self, queryset, name, value):
        v = (value or "").strip()
        return queryset.filter(Q(customer__name__icontains=v) | Q(customer__display_name__icontains=v)) if v else queryset

    def filter_site_q(self, queryset, name, value):
        v = (value or "").strip()
        return queryset.filter(Q(site__name__icontains=v) | Q(site__display_name__icontains=v) | Q(location__icontains=v)) if v else queryset

    def filter_ip_q(self, queryset, name, value):
        v = (value or "").strip()
        return queryset.filter(Q(local_ip__icontains=v) | Q(srsa_ip__icontains=v)) if v else queryset

    def filter_code_q(self, queryset, name, value):
        v = (value or "").strip()
        return queryset.filter(Q(knumber__icontains=v) | Q(serial_number__icontains=v)) if v else queryset

    def filter_not_operational(self, queryset, name, value):
        if value is None:
            return queryset
        cond = Q(status__key__in=INV_NOT_OPERATIONAL)
        return queryset.filter(cond) if value else queryset.exclude(cond)

    def filter_incomplete(self, queryset, name, value):
        if value is None:
            return queryset
        return queryset.filter(INV_INCOMPLETE) if value else queryset.exclude(INV_INCOMPLETE)


class InventoryViewSet(PortalTenantWriteMixin, PortalScopedMixin, PurgeActionMixin, RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = InventoryWriteSerializer
    # Fix P0 6.6: view/add/change/delete_inventory espliciti per il portale
    # Portal (gli utenti interni mantengono il comportamento storico).
    permission_classes = [IsPortalUserOrInternal, CrmInventoryModelPermissions]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    # Fix P0 6.2: forza customer=proprio tenant per utenti portale "puri" e
    # verifica che il site scelto appartenga allo stesso tenant.
    tenant_related_fields = ("site",)

    filterset_class = InventoryFilter

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

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Indicatori della pagina Inventari (non cestinati, stesso perimetro della lista)."""
        qs = self.get_queryset().filter(deleted_at__isnull=True).order_by()
        agg = qs.aggregate(
            total=Count("id"),
            customers=Count("customer_id", distinct=True),
            in_use=Count("id", filter=Q(status__key="in_use")),
            retired=Count("id", filter=Q(status__key="retired")),
            to_install=Count("id", filter=Q(status__key="to_install")),
            maintenance=Count("id", filter=Q(status__key="maintenance")),
            repair=Count("id", filter=Q(status__key="repair")),
            not_operational=Count("id", filter=Q(status__key__in=INV_NOT_OPERATIONAL)),
            with_issue=Count("id", filter=Q(has_active_issue=True)),
            incomplete=Count("id", filter=INV_INCOMPLETE),
            missing_site=Count("id", filter=Q(site__isnull=True)),
            missing_ip=Count("id", filter=Q(local_ip__isnull=True) | Q(local_ip="")),
        )
        by_priority = {p["active_issue_priority"]: p["n"] for p in qs.filter(has_active_issue=True).values("active_issue_priority").annotate(n=Count("id"))}
        by_type = list(qs.values("type_id", "type__key", "type__label").annotate(n=Count("id")).order_by("-n", "type__label"))
        today = timezone.localdate()
        months = []
        y, m = today.year, today.month
        for _ in range(12):
            months.append((y, m))
            y, m = (y - 1, 12) if m == 1 else (y, m - 1)
        months.reverse()
        created = list(qs.values_list("created_at", flat=True))
        growth = []
        for (yy, mm) in months:
            end = datetime.date(yy + (mm // 12), (mm % 12) + 1, 1)
            growth.append({"month": f"{yy}-{mm:02d}", "count": sum(1 for c in created if c and timezone.localtime(c).date() < end)})
        return Response({
            **{k: (v or 0) for k, v in agg.items()},
            "issue_priority": {k: by_priority.get(k, 0) for k in ("critical", "high", "medium", "low")},
            "by_type": [{"id": t["type_id"], "key": t["type__key"], "label": t["type__label"], "count": t["n"]} for t in by_type],
            "growth": growth,
        })


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


class MonitorViewSet(PurgeActionMixin, RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
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
    purge_permission = "inventory.delete_monitor"

    def get_queryset(self):
        qs = Monitor.objects.select_related("inventory", "inventory__site")
        return apply_soft_delete_filters(
            qs,
            request=self.request,
            action_name=self.action,
        )
