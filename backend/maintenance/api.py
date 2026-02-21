import calendar
from datetime import date, timedelta

from django.db.models import Count, Max, Q
from django.utils import timezone

from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.models import InventoryType
from core.permissions import CanRestoreModelPermission
from maintenance.models import (
    Tech,
    MaintenancePlan,
    MaintenanceEvent,
    MaintenanceNotification,
)


_TRUTHY = {"1", "true", "yes", "on"}


def _apply_deleted_filters(qs, request, action_name: str | None = None):
    include_deleted = (request.query_params.get("include_deleted") or "").lower()
    only_deleted    = (request.query_params.get("only_deleted") or "").lower()

    if (action_name or "") == "restore":
        include_deleted = "1"

    if only_deleted in _TRUTHY:
        return qs.filter(deleted_at__isnull=False)
    if include_deleted in _TRUTHY:
        return qs
    return qs.filter(deleted_at__isnull=True)


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
        return _apply_deleted_filters(
            Tech.objects.all(), self.request, getattr(self, "action", None)
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
        # Usa annotazione se siamo in list() (evita N+1); fallback per retrieve singolo
        if hasattr(obj, "_covered_count_ann"):
            return obj._covered_count_ann
        return obj.covered_inventories().count()

    def get_last_done_date(self, obj):
        # Usa annotazione se siamo in list() (evita N+1); fallback per retrieve singolo
        if hasattr(obj, "_last_done_date_ann"):
            v = obj._last_done_date_ann
            return str(v) if v else None
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
            .annotate(
                _last_done_date_ann=Max(
                    "events__performed_at",
                    filter=Q(events__deleted_at__isnull=True),
                )
            )
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

        return _apply_deleted_filters(qs, self.request, getattr(self, "action", None))

    # ------------------------------------------------------------------
    # covered_count bulk annotation (evita N+1 sulla lista)
    # ------------------------------------------------------------------

    @staticmethod
    def _annotate_covered_count(plans):
        """
        Calcola covered_count per una pagina di piani con al massimo 2 query
        aggiuntive (invece di 1 query per piano).
        Imposta obj._covered_count_ann su ogni istanza.
        """
        from collections import defaultdict
        from inventory.models import Inventory

        if not plans:
            return

        customer_ids = list({p.customer_id for p in plans})
        type_ids_by_plan = {
            p.id: set(p.inventory_types.values_list("id", flat=True))
            for p in plans
        }

        # Unica query: conta inventory attivi per (customer, type)
        rows = (
            Inventory.objects
            .filter(customer_id__in=customer_ids, deleted_at__isnull=True)
            .values("customer_id", "type_id")
            .annotate(n=Count("id"))
        )
        counts: dict = defaultdict(lambda: defaultdict(int))
        for row in rows:
            counts[row["customer_id"]][row["type_id"]] = row["n"]

        for p in plans:
            p._covered_count_ann = sum(
                counts[p.customer_id].get(t, 0)
                for t in type_ids_by_plan.get(p.id, set())
            )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Annotiamo covered_count sulla stessa pagina già caricata da super()
        qs_filtered = self.filter_queryset(self.get_queryset())
        paginator = self.paginator
        if paginator is not None:
            page = paginator.paginate_queryset(qs_filtered, request, view=self)
            if page is not None:
                self._annotate_covered_count(page)
        return response

    # ------------------------------------------------------------------

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
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class MaintenanceEventViewSet(viewsets.ModelViewSet):
    serializer_class = MaintenanceEventSerializer
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]

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

        return _apply_deleted_filters(qs, self.request, getattr(self, "action", None))

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

        return _apply_deleted_filters(qs, self.request, getattr(self, "action", None))

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
