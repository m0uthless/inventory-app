"""maintenance/api/plans.py — MaintenancePlan serializer + ViewSet."""
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

from django.db.models import OuterRef, Subquery, Count
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from core.models import InventoryType
from maintenance.models import MaintenancePlan, MaintenanceEvent, Tech
from maintenance.api.helpers import compute_next_due_date

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
    # Calcolata nel serializer: conta gli inventory attivi del cliente coperti dal piano.
    covered_count = serializers.SerializerMethodField()

    # Quanti rapportini ok/ko sono stati eseguiti nel ciclo corrente — annotato su list.
    completed_count = serializers.IntegerField(read_only=True, allow_null=True, default=None)

    # Data dell'ultimo rapportino eseguito — annotata su list, None su retrieve.
    last_done_date = serializers.DateField(read_only=True, allow_null=True)

    def get_inventory_type_labels(self, obj):
        # Usa la cache del prefetch_related già impostato nel queryset
        # (obj.inventory_types.all() non genera una nuova query se prefetchato).
        return [t.label for t in obj.inventory_types.all()]

    def get_covered_count(self, obj):
        # Usa il valore annotato nel queryset (se presente) per evitare N+1.
        # Il queryset di MaintenancePlanViewSet annota covered_count su list.
        annotated = getattr(obj, "_covered_count", None)
        if annotated is not None:
            return annotated
        # Fallback per retrieve/destroy (singola istanza): query diretta accettabile.
        from inventory.models import Inventory
        from core.models import InventoryStatus
        type_ids = [t.id for t in obj.inventory_types.all()]
        if not type_ids:
            return 0
        active_status_ids = list(
            InventoryStatus.objects.filter(
                key__in=("in_use", "maintenance", "repair"),
                deleted_at__isnull=True,
            ).values_list("id", flat=True)
        )
        return Inventory.objects.filter(
            customer_id=obj.customer_id,
            type_id__in=type_ids,
            status_id__in=active_status_ids,
            deleted_at__isnull=True,
        ).count()

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
            "completed_count",
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
        qs = (
            MaintenancePlan.objects
            .select_related("customer")
            .prefetch_related("inventory_types")
        )

        # last_done_date: annotata solo su list per evitare query extra su retrieve/destroy.
        # covered_count: annotata tramite Subquery per eliminare N+1 nel serializer.
        action = getattr(self, "action", "list")
        if action == "list":
            last_event_sq = (
                MaintenanceEvent.objects
                .filter(plan=OuterRef("pk"), deleted_at__isnull=True)
                .order_by("-performed_at")
                .values("performed_at")[:1]
            )
            # completed_count: numero di rapportini ok/ko/partial nel ciclo corrente.
            # Il ciclo corrente va da (next_due_date - 1 anno) a next_due_date.
            # Approssimazione annuale: safe per intervalli <= 1 anno; per piani pluriennali
            # potrebbe sovrastimare, ma è comunque indicativa e coerente con il frontend.
            completed_count_sq = (
                MaintenanceEvent.objects
                .filter(
                    plan=OuterRef("pk"),
                    result__in=("ok", "ko", "partial"),
                    deleted_at__isnull=True,
                    performed_at__year=OuterRef("next_due_date__year"),
                )
                .values("plan")
                .annotate(cnt=Count("id"))
                .values("cnt")[:1]
            )

            # covered_count: inventory attivi del cliente coperti dal piano.
            # Non si può usare OuterRef("inventory_types") direttamente su M2M;
            # usiamo la through table implicita di Django per recuperare i type_id
            # del piano corrente all'interno della Subquery.
            from django.db.models import IntegerField
            from django.db.models.functions import Coalesce
            from inventory.models import Inventory
            from core.models import InventoryStatus

            active_status_ids = list(
                InventoryStatus.objects.filter(
                    key__in=("in_use", "maintenance", "repair"),
                    deleted_at__isnull=True,
                ).values_list("id", flat=True)
            )

            # Subquery: inventorytype_id per il piano corrente (through table)
            plan_type_ids_sq = (
                MaintenancePlan.inventory_types.through.objects
                .filter(maintenanceplan_id=OuterRef(OuterRef("pk")))
                .values("inventorytype_id")
            )

            covered_sq = (
                Inventory.objects
                .filter(
                    customer_id=OuterRef("customer_id"),
                    type_id__in=plan_type_ids_sq,
                    status_id__in=active_status_ids,
                    deleted_at__isnull=True,
                )
                .values("customer_id")
                .annotate(cnt=Count("id", distinct=True))
                .values("cnt")[:1]
            )
            qs = qs.annotate(
                last_done_date=Subquery(last_event_sq),
                completed_count=Subquery(completed_count_sq),
                _covered_count=Coalesce(Subquery(covered_sq, output_field=IntegerField()), 0),
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
        plan_param     = request.query_params.get("plan")
        if customer_param:
            plans = plans.filter(customer_id=customer_param)
        if plan_param:
            plans = plans.filter(id=plan_param)

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

        from core.models import InventoryStatus as _InvStatus
        active_status_ids = list(
            _InvStatus.objects.filter(
                key__in=("in_use", "maintenance", "repair"),
                deleted_at__isnull=True,
            ).values_list("id", flat=True)
        )
        inv_qs = (
            Inventory.objects
            .filter(
                customer_id__in=customer_ids,
                type_id__in=all_type_ids,
                status_id__in=active_status_ids,
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
                        "plan_id":               plan.id,
                        "plan_title":            plan.title,
                        "plan_alert_days_before": plan.alert_days_before,
                        "inventory_id":          inv.id,
                        "inventory_name":        inv.name,
                        "customer_id":           plan.customer_id,
                        "customer_code":         plan.customer.code,
                        "customer_name":         plan.customer.name,
                        "site_id":               inv.site_id,
                        "site_name":             (inv.site.display_name or inv.site.name) if inv.site else None,
                        "type_label":            inv.type.label if inv.type_id else None,
                        "knumber":               inv.knumber,
                        "hostname":              inv.hostname,
                        "next_due_date":         str(plan.next_due_date),
                        "schedule_type":         plan.schedule_type,
                        "interval_value":        plan.interval_value,
                        "interval_unit":         plan.interval_unit,
                        "fixed_month":           plan.fixed_month,
                        "fixed_day":             plan.fixed_day,
                    })

        # Escludi le coppie (plan, inventory) già completate (ok/ko) nel ciclo corrente.
        # Le righe con result='partial' rimangono visibili.
        # Il "ciclo corrente" è [subtract_cycle(next_due_date), next_due_date].
        import calendar
        from datetime import date as date_cls
        from maintenance.models import MaintenanceEvent as MEvent

        def subtract_cycle(ndd, plan):
            """Ritorna la data di inizio del ciclo corrente (stdlib puro, no dateutil)."""
            if plan.schedule_type == "interval" and plan.interval_value and plan.interval_unit:
                val  = plan.interval_value
                unit = plan.interval_unit
                if unit == "days":
                    return ndd - timedelta(days=val)
                if unit == "weeks":
                    return ndd - timedelta(weeks=val)
                if unit == "months":
                    total_months = ndd.month - (val % 12)
                    year = ndd.year - (val // 12)
                    if total_months <= 0:
                        total_months += 12
                        year -= 1
                    day = min(ndd.day, calendar.monthrange(year, total_months)[1])
                    return date_cls(year, total_months, day)
                if unit == "years":
                    try:
                        return date_cls(ndd.year - val, ndd.month, ndd.day)
                    except ValueError:
                        return date_cls(ndd.year - val, ndd.month, 28)
            # fixed_date o fallback → ciclo annuale
            try:
                return date_cls(ndd.year - 1, ndd.month, ndd.day)
            except ValueError:
                return date_cls(ndd.year - 1, ndd.month, 28)

        today_date = date_cls.today()
        two_years_ago = date_cls(today_date.year - 2, today_date.month, today_date.day)
        plan_map = {p.id: p for p in plans_list}

        recent_ok_ko = (
            MEvent.objects
            .filter(
                plan_id__in=[r["plan_id"] for r in rows],
                result__in=("ok", "ko", "not_planned"),
                performed_at__gte=two_years_ago,
                deleted_at__isnull=True,
            )
            .values("plan_id", "inventory_id", "performed_at")
        )

        completed_pairs: set = set()
        for ev in recent_ok_ko:
            plan = plan_map.get(ev["plan_id"])
            if not plan or not plan.next_due_date:
                continue
            ndd         = plan.next_due_date
            cycle_start = subtract_cycle(ndd, plan)
            if cycle_start <= ev["performed_at"] <= ndd:
                completed_pairs.add((ev["plan_id"], ev["inventory_id"]))

        rows = [r for r in rows if (r["plan_id"], r["inventory_id"]) not in completed_pairs]

        # ── Due date filters ──────────────────────────────────────────────────
        due_before = request.query_params.get("due_before")
        due_from   = request.query_params.get("due_from")
        due_to     = request.query_params.get("due_to")
        year_param = request.query_params.get("year")
        if due_before:
            rows = [r for r in rows if (r["next_due_date"] or "") < due_before]
        if due_from and due_to:
            rows = [r for r in rows if due_from <= (r["next_due_date"] or "") <= due_to]
        if year_param and year_param.isdigit() and len(year_param) == 4:
            rows = [r for r in rows if (r["next_due_date"] or "").startswith(year_param)]

        # ── Search ────────────────────────────────────────────────────────────
        search = request.query_params.get("search", "").strip().lower()
        if search:
            rows = [
                r for r in rows
                if search in (r["customer_name"] or "").lower()
                or search in (r["plan_title"] or "").lower()
                or search in (r["inventory_name"] or "").lower()
                or search in (r["hostname"] or "").lower()
                or search in (r["knumber"] or "").lower()
                or search in (r["site_name"] or "").lower()
            ]

        # ── Ordering ──────────────────────────────────────────────────────────
        ordering = request.query_params.get("ordering", "next_due_date")
        reverse  = ordering.startswith("-")
        field    = ordering.lstrip("-")
        SORT_KEY = {
            "next_due_date": lambda r: (r["next_due_date"] or "", r["customer_name"] or ""),
            "customer_name": lambda r: (r["customer_name"] or "", r["next_due_date"] or ""),
        }
        rows.sort(key=SORT_KEY.get(field, SORT_KEY["next_due_date"]), reverse=reverse)

        # ── Pagination ────────────────────────────────────────────────────────
        from django.core.paginator import Paginator
        page_size = min(int(request.query_params.get("page_size", 25)), 200)
        page_num  = max(int(request.query_params.get("page", 1)), 1)
        paginator = Paginator(rows, page_size)
        page_obj  = paginator.get_page(page_num)

        return Response({
            "count":    paginator.count,
            "next":     None,
            "previous": None,
            "results":  list(page_obj),
        })


