# mypy: disable-error-code=annotation-unchecked
import calendar
from datetime import date, timedelta

from django.db.models import OuterRef, Subquery, Count
from django.utils import timezone

from rest_framework import serializers, viewsets
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.models import InventoryType
from core.permissions import CanRestoreModelPermission, CanPurgeModelPermission
from core.mixins import SoftDeleteAuditMixin, CustomFieldsValidationMixin
from core.soft_delete import apply_soft_delete_filters
from core.purge_policy import try_purge_instance
from core.restore_policy import get_restore_block_reason, split_restorable
from audit.utils import log_event
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


# ─────────────────────────────────────────────────────────────────────────────
# Plans
# ─────────────────────────────────────────────────────────────────────────────

class MaintenancePlanSerializer(CustomFieldsValidationMixin, serializers.ModelSerializer):
    custom_fields_entity = "maintenance_plan"
    customer_code = serializers.CharField(source="customer.code",    read_only=True)
    customer_name = serializers.CharField(source="customer.name",    read_only=True)

    # M2M: lista degli id in input, lista label in output
    inventory_types     = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=InventoryType.objects.all(),
    )
    inventory_type_labels = serializers.SerializerMethodField()

    # Quanti inventory attivi del cliente sono coperti da questo piano.
    # Valore annotato in get_queryset() — zero query aggiuntive per riga.
    covered_count = serializers.IntegerField(read_only=True)

    # Data dell'ultimo rapportino eseguito (derivata dagli eventi).
    # Valore annotato in get_queryset() — zero query aggiuntive per riga.
    last_done_date = serializers.DateField(read_only=True, allow_null=True)

    def get_inventory_type_labels(self, obj):
        return list(obj.inventory_types.values_list("label", flat=True))

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


class MaintenancePlanViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
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
        from inventory.models import Inventory

        # Subquery: data dell'ultimo MaintenanceEvent per piano (ordine desc performed_at).
        last_event_sq = (
            MaintenanceEvent.objects
            .filter(plan=OuterRef("pk"), deleted_at__isnull=True)
            .order_by("-performed_at")
            .values("performed_at")[:1]
        )

        # Subquery: conteggio inventory attivi coperti dal piano.
        # covered_inventories() usa inventory_types M2M; lo riscriviamo come
        # annotazione scalare per evitare N+1 (una query per piano nella lista).
        covered_sq = (
            Inventory.objects
            .filter(
                customer=OuterRef("customer"),
                type__in=OuterRef("inventory_types"),
                deleted_at__isnull=True,
            )
            .values("customer")          # raggruppa per evitare duplicati M2M
            .annotate(n=Count("id"))
            .values("n")[:1]
        )

        qs = (
            MaintenancePlan.objects
            .select_related("customer")
            .prefetch_related("inventory_types")
            .annotate(
                last_done_date=Subquery(last_event_sq),
                covered_count=Subquery(covered_sq),
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

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    # MaintenancePlan non ha created_by/updated_by sul modello: override senza userstamp.
    def perform_create(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        reason = get_restore_block_reason(obj)
        if reason:
            return Response({"detail": reason}, status=409)
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
        qs = list(
            MaintenancePlan.objects.select_related("customer")
            .filter(id__in=ids, deleted_at__isnull=False)
        )
        restorable, blocked = split_restorable(qs)
        restored_ids = [obj.id for obj in restorable]
        if restored_ids:
            now = timezone.now()
            MaintenancePlan.objects.filter(id__in=restored_ids).update(deleted_at=None, updated_at=now)
        log_event(
            actor=request.user, action="restore", instance=None,
            changes={"ids": restored_ids}, request=request,
            subject=f"bulk restore MaintenancePlan: {restored_ids}",
        )
        return Response({"restored": restored_ids, "count": len(restored_ids), "blocked": blocked, "blocked_count": len(blocked)}, status=200)

    @action(detail=True, methods=["post"], permission_classes=[CanPurgeModelPermission])
    def purge(self, request, pk=None):
        obj = MaintenancePlan.objects.filter(pk=pk, deleted_at__isnull=False).first()
        if obj is None:
            return Response({"detail": "Elemento non trovato nel cestino."}, status=404)
        ok, reason, blockers = try_purge_instance(obj)
        if not ok:
            return Response({"detail": reason, "blocked": blockers}, status=409)
        log_event(actor=request.user, action="delete", instance=None, request=request, metadata={"purge": True}, subject=f"purge MaintenancePlan #{pk}")
        return Response(status=204)

    @action(detail=False, methods=["post"], permission_classes=[CanPurgeModelPermission])
    def bulk_purge(self, request):
        payload = request.data
        ids = payload.get("ids") if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=400)
        purged = []
        blocked = []
        for obj in MaintenancePlan.objects.filter(id__in=ids, deleted_at__isnull=False):
            obj_id = obj.id
            ok, reason, blockers = try_purge_instance(obj)
            if ok:
                purged.append(obj_id)
            else:
                blocked.append({"id": obj.id, "reason": reason, "blocked": blockers})
        log_event(actor=request.user, action="delete", instance=None, changes={"ids": purged}, request=request, metadata={"purge": True, "blocked_count": len(blocked)}, subject=f"bulk purge MaintenancePlan: {purged}")
        return Response({"purged": purged, "count": len(purged), "blocked": blocked, "blocked_count": len(blocked)}, status=200)

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

        Ottimizzazione: una sola query per tutti gli inventory invece di N query
        (una per piano). Il join avviene in Python dopo aver caricato i dati.
        """
        from inventory.models import Inventory

        plans = (
            MaintenancePlan.objects
            .filter(deleted_at__isnull=True, is_active=True, next_due_date__isnull=False)
            .select_related("customer")
            .prefetch_related("inventory_types")
        )
        customer_param = request.query_params.get("customer")
        site_param     = request.query_params.get("site")
        if customer_param:
            plans = plans.filter(customer_id=customer_param)

        # Materializza i piani una volta sola
        plans_list = list(plans)
        if not plans_list:
            return Response([])

        # Raccoglie customer_id → lista di (plan, frozenset(type_ids))
        # per filtrare gli inventory con una sola query
        customer_ids = {p.customer_id for p in plans_list}
        all_type_ids = {
            t_id
            for p in plans_list
            for t_id in p.inventory_types.values_list("id", flat=True)
        }

        inv_qs = (
            Inventory.objects
            .filter(
                customer_id__in=customer_ids,
                type_id__in=all_type_ids,
                deleted_at__isnull=True,
            )
            .select_related("site", "type", "customer")
        )
        if site_param:
            inv_qs = inv_qs.filter(site_id=site_param)

        # Indice: (customer_id, type_id) → lista di inventory
        from collections import defaultdict
        inv_index: dict = defaultdict(list)
        for inv in inv_qs:
            inv_index[(inv.customer_id, inv.type_id)].append(inv)

        rows = []
        for plan in plans_list:
            type_ids = set(plan.inventory_types.values_list("id", flat=True))
            for type_id in type_ids:
                for inv in inv_index.get((plan.customer_id, type_id), []):
                    rows.append({
                        "plan_id":        plan.id,
                        "plan_title":     plan.title,
                        "inventory_id":   inv.id,
                        "customer_id":    plan.customer_id,
                        "customer_code":  plan.customer.code,
                        "customer_name":  plan.customer.name,
                        "site_id":        inv.site_id,
                        "site_name":      (inv.site.display_name or inv.site.name) if inv.site else None,
                        "type_label":     inv.type.label if inv.type_id else None,
                        "knumber":        inv.knumber,
                        "hostname":       inv.hostname,
                        "next_due_date":  str(plan.next_due_date),
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
    pdf_url    = serializers.SerializerMethodField()

    def get_site_name(self, obj):
        return obj.inventory.site.name if obj.inventory.site_id and obj.inventory.site else None

    def get_pdf_url(self, obj):
        if not obj.pdf_file:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.pdf_file.url) if request else obj.pdf_file.url

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
            "pdf_url",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class MaintenanceEventViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class  = MaintenanceEventSerializer
    filter_backends   = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    parser_classes    = [MultiPartParser, FormParser, JSONParser]

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

    def perform_create(self, serializer):
        """Salva l'evento e ricalcola automaticamente next_due_date del piano."""
        event = serializer.save()
        self._recalculate_plan_due_date(event)
        log_event(actor=self.request.user, action="create", instance=event, request=self.request)

    def perform_update(self, serializer):
        event = serializer.save()
        log_event(actor=self.request.user, action="update", instance=event, request=self.request)

    def _recalculate_plan_due_date(self, event):
        """
        Dopo la creazione di un rapportino, avanza next_due_date del piano
        alla prossima scadenza FUTURA rispetto a performed_at.

        Strategia: prova a calcolare la data partendo dall'anno di performed_at;
        se il risultato è <= performed_at, prova l'anno successivo, e così via
        fino a trovare una data strettamente futura (max 5 anni avanti per sicurezza).
        Questo è corretto anche per intervalli sub-annuali (es. semestrale).
        """
        plan = event.plan
        ref_year = event.performed_at.year
        next_date = None

        for year_offset in range(6):  # prova anno+0, anno+1, … anno+5
            candidate = compute_next_due_date(
                plan.schedule_type,
                plan.interval_value,
                plan.interval_unit,
                plan.fixed_month,
                plan.fixed_day,
                reference_year=ref_year + year_offset,
            )
            if candidate and candidate > event.performed_at:
                next_date = candidate
                break

        if next_date and next_date > plan.next_due_date:
            plan.next_due_date = next_date
            plan.save(update_fields=["next_due_date", "updated_at"])

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
            MaintenanceEvent.objects.filter(id__in=ids, deleted_at__isnull=False)
            .values_list("id", flat=True)
        )
        MaintenanceEvent.objects.filter(id__in=restored_ids).update(deleted_at=None, updated_at=now)
        log_event(
            actor=request.user, action="restore", instance=None,
            changes={"ids": restored_ids}, request=request,
            subject=f"bulk restore MaintenanceEvent: {restored_ids}",
        )
        return Response({"restored": restored_ids, "count": len(restored_ids)}, status=200)


# ─────────────────────────────────────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────────────────────────────────────

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
