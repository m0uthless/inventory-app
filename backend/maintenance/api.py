import calendar
from datetime import date, timedelta

from django.utils import timezone

from rest_framework import serializers, viewsets
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.models import InventoryType
from core.permissions import CanRestoreModelPermission
from core.soft_delete import apply_soft_delete_filters
from maintenance.models import (
    Tech,
    MaintenancePlan,
    MaintenanceEvent,
    MaintenanceNotification,
)


def _add_months(d: date, months: int) -> date:
    """Aggiunge `months` mesi a una data, clampando al last day del mese."""
    total_months = d.month - 1 + months
    year  = d.year + total_months // 12
    month = total_months % 12 + 1
    day   = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def compute_next_due_date(
    schedule_type: str,
    interval_value: int | None,
    interval_unit: str | None,
    fixed_month: int | None,
    fixed_day: int | None,
    reference_year: int | None = None,
) -> date | None:
    """
    Calcola la data prevista automaticamente.

    - interval: 01/01/<year> + interval - 1 giorno
      es. 6 mesi → 30/06  |  1 anno → 31/12  |  3 mesi → 31/03
    - fixed_date: fixed_day/fixed_month/<year>
    """
    today = date.today()
    year  = reference_year or today.year

    if schedule_type == "interval":
        if not interval_value or not interval_unit:
            return None
        start = date(year, 1, 1)
        if interval_unit == "days":
            return start + timedelta(days=interval_value) - timedelta(days=1)
        if interval_unit == "weeks":
            return start + timedelta(weeks=interval_value) - timedelta(days=1)
        if interval_unit == "months":
            return _add_months(start, interval_value) - timedelta(days=1)
        if interval_unit == "years":
            return _add_months(start, interval_value * 12) - timedelta(days=1)
        return None

    if schedule_type == "fixed_date":
        if not fixed_month or not fixed_day:
            return None
        try:
            return date(year, fixed_month, fixed_day)
        except ValueError:
            return None

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Techs
# ─────────────────────────────────────────────────────────────────────────────

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


class TechViewSet(viewsets.ModelViewSet):
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

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)
        qs = Tech.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)
        return Response({"restored": restored, "count": len(restored)}, status=200)


# ─────────────────────────────────────────────────────────────────────────────
# Plans
# ─────────────────────────────────────────────────────────────────────────────

class MaintenancePlanSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code",    read_only=True)
    customer_name = serializers.CharField(source="customer.name",    read_only=True)

    # M2M: lista degli id in input, lista label in output
    inventory_types     = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=InventoryType.objects.all(),
    )
    inventory_type_labels = serializers.SerializerMethodField()

    # Quanti inventory attivi del cliente sono coperti da questo piano
    covered_count = serializers.SerializerMethodField()

    # Data dell'ultimo rapportino eseguito (derivata dagli eventi)
    last_done_date = serializers.SerializerMethodField()

    def get_inventory_type_labels(self, obj):
        return list(obj.inventory_types.values_list("label", flat=True))

    def get_covered_count(self, obj):
        return obj.covered_inventories().count()

    def get_last_done_date(self, obj):
        last = obj.events.filter(deleted_at__isnull=True).order_by("-performed_at").first()
        return str(last.performed_at) if last else None

    class Meta:
        model  = MaintenancePlan
        fields = [
            "id",
            "customer",
            "customer_code",
            "customer_name",
            "inventory_types",
            "inventory_type_labels",
            "covered_count",
            "title",
            "schedule_type",
            "interval_unit",
            "interval_value",
            "fixed_month",
            "fixed_day",
            "next_due_date",
            "last_done_date",
            "alert_days_before",
            "is_active",
            "notes",
            "custom_fields",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class MaintenancePlanViewSet(viewsets.ModelViewSet):
    serializer_class = MaintenancePlanSerializer
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["customer", "schedule_type", "is_active"]
    search_fields    = [
        "title", "notes",
        "customer__code", "customer__name",
        "inventory_types__label",
    ]
    ordering_fields  = ["next_due_date", "title", "updated_at", "created_at", "deleted_at"]
    ordering         = ["next_due_date", "title"]

    def get_queryset(self):
        qs = (
            MaintenancePlan.objects
            .select_related("customer")
            .prefetch_related("inventory_types")
        )

        # Filtro per tipo inventario (multi: ?inventory_type=1&inventory_type=2)
        inv_types = self.request.query_params.getlist("inventory_type")
        if inv_types:
            qs = qs.filter(inventory_types__id__in=inv_types).distinct()

        # Filtro scadenza
        due   = (self.request.query_params.get("due") or "").strip().lower()
        today = timezone.localdate()
        if due == "overdue":
            qs = qs.filter(next_due_date__lt=today)
        elif due == "next7":
            qs = qs.filter(next_due_date__gte=today, next_due_date__lte=today + timedelta(days=7))
        elif due == "next30":
            qs = qs.filter(next_due_date__gte=today, next_due_date__lte=today + timedelta(days=30))

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)
        qs = MaintenancePlan.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)
        return Response({"restored": restored, "count": len(restored)}, status=200)

    @action(detail=False, methods=["get"], url_path="compute-due-date")
    def compute_due_date(self, request):
        """
        Calcola la data prevista dato il tipo di pianificazione.
        Parametri: schedule_type, interval_value, interval_unit,
                   fixed_month, fixed_day, year (opzionale)
        """
        schedule_type  = request.query_params.get("schedule_type", "")
        interval_value = request.query_params.get("interval_value")
        interval_unit  = request.query_params.get("interval_unit", "")
        fixed_month    = request.query_params.get("fixed_month")
        fixed_day      = request.query_params.get("fixed_day")
        year           = request.query_params.get("year")

        try:
            iv = int(interval_value) if interval_value else None
            fm = int(fixed_month)    if fixed_month    else None
            fd = int(fixed_day)      if fixed_day      else None
            yr = int(year)           if year           else None
        except (ValueError, TypeError):
            return Response({"detail": "Parametri non validi."}, status=400)

        result = compute_next_due_date(schedule_type, iv, interval_unit, fm, fd, yr)
        if result is None:
            return Response({"detail": "Impossibile calcolare la data con i parametri forniti."}, status=400)

        return Response({"next_due_date": result.isoformat()})


    @action(detail=False, methods=["get"])
    def todo(self, request):
        """
        Ritorna una riga per ogni (piano, inventory) con next_due_date valorizzata.
        Le righe sono ordinate per next_due_date, cliente, sito.
        Filtri: ?customer=ID  ?site=ID
        """
        plans = (
            MaintenancePlan.objects
            .filter(deleted_at__isnull=True, is_active=True, next_due_date__isnull=False)
            .select_related("customer")
            .prefetch_related("inventory_types")
        )
        customer = request.query_params.get("customer")
        if customer:
            plans = plans.filter(customer_id=customer)

        from inventory.models import Inventory
        rows = []
        for plan in plans:
            invs = (
                Inventory.objects
                .filter(
                    customer=plan.customer,
                    type_id__in=plan.inventory_types.values_list("id", flat=True),
                    deleted_at__isnull=True,
                )
                .select_related("site", "type")
            )
            site = request.query_params.get("site")
            if site:
                invs = invs.filter(site_id=site)
            for inv in invs:
                rows.append({
                    "plan_id":       plan.id,
                    "plan_title":    plan.title,
                    "inventory_id":  inv.id,
                    "customer_id":   plan.customer_id,
                    "customer_code": plan.customer.code,
                    "customer_name": plan.customer.name,
                    "site_id":       inv.site_id,
                    "site_name":     (inv.site.display_name or inv.site.name) if inv.site else None,
                    "type_label":    inv.type.label if inv.type_id else None,
                    "knumber":       inv.knumber,
                    "hostname":      inv.hostname,
                    "next_due_date": str(plan.next_due_date),
                    "schedule_type":  plan.schedule_type,
                    "interval_value": plan.interval_value,
                    "interval_unit":  plan.interval_unit,
                    "fixed_month":    plan.fixed_month,
                    "fixed_day":      plan.fixed_day,
                })
        rows.sort(key=lambda r: (
            r["next_due_date"] or "",
            r["customer_name"] or "",
            r["site_name"] or "",
        ))
        return Response(rows)


# ─────────────────────────────────────────────────────────────────────────────
# Events
# ─────────────────────────────────────────────────────────────────────────────

class MaintenanceEventSerializer(serializers.ModelSerializer):
    # Da piano → customer
    customer_code = serializers.CharField(source="plan.customer.code", read_only=True)
    customer_name = serializers.CharField(source="plan.customer.name", read_only=True)

    # Da inventory (nullable site)
    site_name         = serializers.SerializerMethodField()
    inventory_hostname = serializers.CharField(source="inventory.hostname", read_only=True)

    plan_title = serializers.CharField(source="plan.title",    read_only=True)
    tech_name  = serializers.CharField(source="tech.__str__",  read_only=True)

    def get_site_name(self, obj):
        return obj.inventory.site.name if obj.inventory.site_id and obj.inventory.site else None

    class Meta:
        model  = MaintenanceEvent
        fields = [
            "id",
            "plan",
            "plan_title",
            "inventory",
            "customer_code",
            "customer_name",
            "site_name",
            "inventory_hostname",
            "performed_at",
            "result",
            "tech",
            "tech_name",
            "notes",
            "pdf_file",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class MaintenanceEventViewSet(viewsets.ModelViewSet):
    serializer_class  = MaintenanceEventSerializer
    filter_backends   = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    parser_classes    = [MultiPartParser, FormParser]

    filterset_fields = ["inventory", "plan", "tech", "result"]
    search_fields    = [
        "notes",
        "inventory__hostname",
        "inventory__knumber",
        "inventory__serial_number",
        "plan__title",
        "plan__customer__code",
        "plan__customer__name",
        "tech__first_name",
        "tech__last_name",
    ]
    ordering_fields  = ["performed_at", "updated_at", "created_at", "deleted_at"]
    ordering         = ["-performed_at"]

    def get_queryset(self):
        qs = (
            MaintenanceEvent.objects
            .select_related(
                "plan",
                "plan__customer",
                "inventory",
                "inventory__site",
                "tech",
            )
        )

        customer = self.request.query_params.get("customer")
        if customer:
            qs = qs.filter(plan__customer_id=customer)

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])

    def perform_create(self, serializer):
        """Salva l'evento e ricalcola automaticamente next_due_date del piano."""
        event = serializer.save()
        self._recalculate_plan_due_date(event)

    def _recalculate_plan_due_date(self, event):
        """
        Dopo la creazione di un rapportino, avanza next_due_date del piano
        al prossimo ciclo basandosi su performed_at.
        """
        plan = event.plan
        next_date = compute_next_due_date(
            plan.schedule_type,
            plan.interval_value,
            plan.interval_unit,
            plan.fixed_month,
            plan.fixed_day,
            reference_year=event.performed_at.year + 1,
        )
        if next_date and next_date > plan.next_due_date:
            plan.next_due_date = next_date
            plan.save(update_fields=["next_due_date", "updated_at"])

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)
        qs = MaintenanceEvent.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)
        return Response({"restored": restored, "count": len(restored)}, status=200)


# ─────────────────────────────────────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────────────────────────────────────

class MaintenanceNotificationSerializer(serializers.ModelSerializer):
    plan_title         = serializers.CharField(source="plan.title",    read_only=True)
    customer_code      = serializers.CharField(source="plan.customer.code", read_only=True)
    customer_name      = serializers.CharField(source="plan.customer.name", read_only=True)
    inventory_hostname = serializers.CharField(source="inventory.hostname", read_only=True)

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


class MaintenanceNotificationViewSet(viewsets.ModelViewSet):
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

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        obj.deleted_at = None
        obj.save(update_fields=["deleted_at"])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)
        qs = MaintenanceNotification.objects.filter(id__in=ids, deleted_at__isnull=False)
        restored = []
        for obj in qs:
            obj.deleted_at = None
            obj.save(update_fields=["deleted_at", "updated_at"])
            restored.append(obj.id)
        return Response({"restored": restored, "count": len(restored)}, status=200)
