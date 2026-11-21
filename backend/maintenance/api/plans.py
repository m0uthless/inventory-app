"""maintenance/api/plans.py — MaintenancePlan serializer + ViewSet."""
from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import CanRestoreModelPermission, CanPurgeModelPermission
from core.mixins import SoftDeleteAuditMixin, CustomFieldsValidationMixin, RestoreActionMixin, PurgeActionMixin
from core.soft_delete import apply_soft_delete_filters
from core.purge_policy import try_purge_instance
from core.restore_policy import get_restore_block_reason, split_restorable
from audit.utils import log_event

from django.db.models import OuterRef, Subquery, Count, DateField, Q
from django.db.models.functions import TruncYear
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from core.models import InventoryType
from maintenance.visibility import can_edit_plan, visible_plans_q
from maintenance.models import MaintenancePlan, MaintenanceEvent, Tech
from maintenance.api.helpers import compute_next_due_date

class MaintenancePlanSerializer(CustomFieldsValidationMixin, serializers.ModelSerializer):
    custom_fields_entity = "maintenance_plan"
    customer_code = serializers.CharField(source="customer.code",    read_only=True)
    customer_name = serializers.CharField(source="customer.name",    read_only=True)
    area_label    = serializers.CharField(source="area.label", read_only=True, default=None)
    can_edit      = serializers.SerializerMethodField()

    def get_can_edit(self, obj) -> bool:
        request = self.context.get("request")
        return can_edit_plan(getattr(request, "user", None), obj)

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
    # Manutenzioni ancora da fare / scadute nel ciclo corrente (stessa regola di todo); solo in elenco.
    todo_count = serializers.SerializerMethodField()
    overdue_count = serializers.SerializerMethodField()

    # Data dell'ultimo rapportino eseguito — annotata su list, None su retrieve.
    last_done_date = serializers.DateField(read_only=True, allow_null=True)

    def get_inventory_type_labels(self, obj):
        # Usa la cache del prefetch_related già impostato nel queryset
        # (obj.inventory_types.all() non genera una nuova query se prefetchato).
        return [t.label for t in obj.inventory_types.all()]

    def get_todo_count(self, obj):
        return getattr(obj, "_todo_count", None)

    def get_overdue_count(self, obj):
        return getattr(obj, "_overdue_count", None)

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
            "area",
            "area_label",
            "can_edit",
            "inventory_types",
            "inventory_type_labels",
            "covered_count",
            "completed_count",
            "todo_count",
            "overdue_count",
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
            .select_related("customer", "area")
            .prefetch_related("inventory_types")
            .filter(visible_plans_q(self.request.user))
        )
        # ?area=<id> oppure ?area=none (senza area)
        area_param = self.request.query_params.get("area")
        if area_param == "none":
            qs = qs.filter(area__isnull=True)
        elif area_param and area_param.isdigit():
            qs = qs.filter(area_id=int(area_param))

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
            # completed_count: numero di rapportini ok/ko/partial nell'anno solare
            # di next_due_date. Usiamo un range [inizio anno, next_due_date] perché
            # OuterRef non supporta trasformazioni __year.
            completed_count_sq = (
                MaintenanceEvent.objects
                .filter(
                    plan=OuterRef("pk"),
                    result__in=("ok", "ko", "partial"),
                    deleted_at__isnull=True,
                    performed_at__gte=OuterRef("_year_start"),
                    performed_at__lte=OuterRef("next_due_date"),
                )
                .values("plan")
                .annotate(cnt=Count("id"))
                .values("cnt")[:1]
            )

            qs = qs.annotate(
                _year_start=TruncYear("next_due_date", output_field=DateField()),
            )
            qs = qs.annotate(
                last_done_date=Subquery(last_event_sq),
                completed_count=Subquery(completed_count_sq),
            )

        # Filtro per tipo inventario (multi: ?inventory_type=1&inventory_type=2)
        inv_types = self.request.query_params.getlist("inventory_type")
        if inv_types:
            qs = qs.filter(inventory_types__id__in=inv_types).distinct()

        # Filtro stato: active | overdue | completed (piani in corso) · archived
        # (archiviato = scadenza prima dell'anno corrente oppure non attivo).
        today = timezone.localdate()
        year_start = today.replace(month=1, day=1)
        state = (self.request.query_params.get("state") or "").strip().lower()
        if state == "archived":
            qs = qs.filter(Q(next_due_date__lt=year_start) | Q(is_active=False))
        elif state in ("active", "overdue", "completed"):
            qs = qs.filter(next_due_date__gte=year_start, is_active=True)

        # Filtro scadenza
        due   = (self.request.query_params.get("due") or "").strip().lower()
        if due == "overdue":
            qs = qs.filter(next_due_date__lt=today)
        elif due == "next7":
            qs = qs.filter(next_due_date__gte=today, next_due_date__lte=today + timedelta(days=7))
        elif due == "next30":
            qs = qs.filter(next_due_date__gte=today, next_due_date__lte=today + timedelta(days=30))

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    def _compute_covered_count_map(self, plans: list[MaintenancePlan]) -> dict[int, int]:
        if not plans:
            return {}
        from inventory.models import Inventory
        from core.models import InventoryStatus

        customer_ids = {plan.customer_id for plan in plans}
        type_ids = {inv_type.id for plan in plans for inv_type in plan.inventory_types.all()}
        if not customer_ids or not type_ids:
            return {plan.id: 0 for plan in plans}

        active_status_ids = list(
            InventoryStatus.objects.filter(
                key__in=("in_use", "maintenance", "repair"),
                deleted_at__isnull=True,
            ).values_list("id", flat=True)
        )
        inventory_counts = {
            (row["customer_id"], row["type_id"]): row["cnt"]
            for row in (
                Inventory.objects.filter(
                    customer_id__in=customer_ids,
                    type_id__in=type_ids,
                    status_id__in=active_status_ids,
                    deleted_at__isnull=True,
                )
                .values("customer_id", "type_id")
                .annotate(cnt=Count("id"))
            )
        }

        return {
            plan.id: sum(inventory_counts.get((plan.customer_id, inv_type.id), 0) for inv_type in plan.inventory_types.all())
            for plan in plans
        }

    def _plan_todo_counts(self, request):
        """{plan_id: (da fare, scadute)} dalle stesse righe di todo."""
        rows, _done = self._todo_rows(request)
        today_iso = timezone.localdate().isoformat()
        counts: dict = {}
        for r in rows:
            t, o = counts.get(r["plan_id"], (0, 0))
            counts[r["plan_id"]] = (t + 1, o + (1 if (r["next_due_date"] or "") < today_iso else 0))
        return counts

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        counts = self._plan_todo_counts(request)
        state = (request.query_params.get("state") or "").strip().lower()
        if state == "overdue":
            queryset = queryset.filter(id__in=[pid for pid, (_t, o) in counts.items() if o])
        elif state == "completed":
            candidates = list(queryset.prefetch_related("inventory_types"))
            covered = self._compute_covered_count_map(candidates)
            queryset = queryset.filter(id__in=[p.id for p in candidates if covered.get(p.id) and not counts.get(p.id)])

        def decorate(plans):
            covered_count_map = self._compute_covered_count_map(plans)
            for plan in plans:
                plan._covered_count = covered_count_map.get(plan.id, 0)
                t, o = counts.get(plan.id, (0, 0))
                plan._todo_count, plan._overdue_count = t, o

        page = self.paginate_queryset(queryset)
        if page is not None:
            plans = list(page)
            decorate(plans)
            serializer = self.get_serializer(plans, many=True)
            return self.get_paginated_response(serializer.data)

        plans = list(queryset)
        decorate(plans)
        serializer = self.get_serializer(plans, many=True)
        return Response(serializer.data)

    # MaintenancePlan non ha created_by/updated_by sul modello: override senza userstamp.
    def perform_create(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        self._check_plan_area(serializer.instance)
        instance = serializer.save()
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)

    def perform_destroy(self, instance):
        self._check_plan_area(instance)
        super().perform_destroy(instance)

    def _check_plan_area(self, plan):
        """I piani con un'area li modificano solo i membri di quell'area (o il superuser)."""
        if not can_edit_plan(self.request.user, plan):
            raise PermissionDenied("Puoi modificare solo i piani della tua area.")

    @action(detail=True, methods=["post"], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        obj = self.get_object()
        self._check_plan_area(obj)
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
            .filter(visible_plans_q(request.user))
        )
        qs = [p for p in qs if can_edit_plan(request.user, p)]
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
        obj = MaintenancePlan.objects.filter(pk=pk, deleted_at__isnull=False).filter(visible_plans_q(request.user)).first()
        if obj is None:
            return Response({"detail": "Elemento non trovato nel cestino."}, status=404)
        self._check_plan_area(obj)
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
        for obj in MaintenancePlan.objects.filter(id__in=ids, deleted_at__isnull=False).filter(visible_plans_q(request.user)):
            if not can_edit_plan(request.user, obj):
                blocked.append({"id": obj.id, "reason": "Piano di un'altra area.", "blocked": []})
                continue
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


    def _todo_rows(self, request):
        """Righe (piano, inventory) ancora da fare nel ciclo corrente, con l'ultima
        esecuzione. Ritorna anche quante coppie sono già completate (per la copertura).
        Filtri di base: ?customer ?site ?plan."""
        from inventory.models import Inventory

        plans = (
            MaintenancePlan.objects
            .filter(deleted_at__isnull=True, is_active=True, next_due_date__isnull=False)
            # Visibilità per area; i job di sistema (senza utente) vedono tutto.
            .filter(visible_plans_q(getattr(request, "user", None)))
            .select_related("customer", "area")
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
            return [], 0

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

        # Pivot index: (plan_id, inventory_id) → MaintenancePlanInventory
        # Carica tutti i record pivot attivi per i piani correnti in una sola query.
        from maintenance.models import MaintenancePlanInventory
        pivot_qs = (
            MaintenancePlanInventory.objects
            .filter(
                plan_id__in=[p.id for p in plans_list],
                deleted_at__isnull=True,
            )
            .only("id", "plan_id", "inventory_id", "due_date_override")
        )
        pivot_index: dict = {(piv.plan_id, piv.inventory_id): piv for piv in pivot_qs}

        rows = []
        for plan in plans_list:
            type_ids = set(plan.inventory_types.values_list("id", flat=True))
            for type_id in type_ids:
                for inv in inv_index.get((plan.customer_id, type_id), []):
                    # Usa l'override dalla pivot se esiste, altrimenti la data del piano
                    pivot = pivot_index.get((plan.id, inv.id))
                    effective_due_date = (
                        str(pivot.due_date_override)
                        if pivot and pivot.due_date_override
                        else str(plan.next_due_date)
                    )
                    rows.append({
                        "plan_id":               plan.id,
                        "plan_title":            plan.title,
                        "plan_area_id":          plan.area_id,
                        "plan_area_label":       plan.area.label if plan.area_id else None,
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
                        "next_due_date":         effective_due_date,
                        "due_date_override":     str(pivot.due_date_override) if pivot and pivot.due_date_override else None,
                        "plan_next_due_date":    str(plan.next_due_date),
                        "plan_inventory_id":     pivot.id if pivot else None,
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

        total_pairs = len(rows)
        rows = [r for r in rows if (r["plan_id"], r["inventory_id"]) not in completed_pairs]

        # Ultima esecuzione registrata per ogni coppia (piano, inventory), qualunque ciclo.
        last: dict = {}
        if rows:
            for ev in (
                MEvent.objects
                .filter(
                    plan_id__in={r["plan_id"] for r in rows},
                    inventory_id__in={r["inventory_id"] for r in rows},
                    deleted_at__isnull=True,
                )
                .order_by("-performed_at", "-id")
                .values("plan_id", "inventory_id", "performed_at", "result")
            ):
                last.setdefault((ev["plan_id"], ev["inventory_id"]), ev)
        for r in rows:
            ev = last.get((r["plan_id"], r["inventory_id"]))
            r["last_result"] = ev["result"] if ev else None
            r["last_date"] = ev["performed_at"].isoformat() if ev else None
        return rows, total_pairs - len(rows)


    @staticmethod
    def _due_state(row, today_iso, in30_iso):
        d = row["next_due_date"] or ""
        if d < today_iso:
            return "overdue"
        if d <= in30_iso:
            return "next30"
        return "later"

    @action(detail=False, methods=["get"])
    def todo(self, request):
        """
        Una riga per ogni (piano, inventory) da fare nel ciclo corrente.
        Filtri: ?customer ?site ?plan ?type (etichetta del tipo)
        ?due=overdue|next30|later|override ?due_before ?due_from&due_to ?year ?search
        Ogni riga riporta anche last_result / last_date (ultima esecuzione).
        """
        rows, _done = self._todo_rows(request)
        today_iso = timezone.localdate().isoformat()
        in30_iso = (timezone.localdate() + timedelta(days=30)).isoformat()
        type_param = request.query_params.get("type")
        if type_param:
            rows = [r for r in rows if (r["type_label"] or "") == type_param]
        due = request.query_params.get("due")
        if due == "override":
            rows = [r for r in rows if r["due_date_override"]]
        elif due in ("overdue", "next30", "later"):
            rows = [r for r in rows if self._due_state(r, today_iso, in30_iso) == due]

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
        page_size = min(int(request.query_params.get("page_size", 25)), 500)
        page_num  = max(int(request.query_params.get("page", 1)), 1)
        paginator = Paginator(rows, page_size)
        page_obj  = paginator.get_page(page_num)

        return Response({
            "count":    paginator.count,
            "next":     None,
            "previous": None,
            "results":  list(page_obj),
        })

    @action(detail=False, methods=["get"], url_path="todo-stats")
    def todo_stats(self, request):
        """Indicatori della pagina Scadenze: conteggi per stato, copertura del ciclo,
        prossime uscite (cliente · sito), carico dei prossimi 12 mesi, rapportini del
        mese e KO/parziali recenti, scelte per i filtri. Stessi filtri di base di todo."""
        from collections import Counter, defaultdict
        from datetime import date as date_cls

        rows, done = self._todo_rows(request)
        today = timezone.localdate()
        today_iso = today.isoformat()
        in30_iso = (today + timedelta(days=30)).isoformat()
        states = Counter(self._due_state(r, today_iso, in30_iso) for r in rows)

        overdue_by_customer = Counter((r["customer_id"], r["customer_name"]) for r in rows if self._due_state(r, today_iso, in30_iso) == "overdue")
        visits: dict = {}
        for r in rows:
            key = (r["customer_id"], r["site_id"])
            v = visits.setdefault(key, {"customer_id": r["customer_id"], "customer_name": r["customer_name"], "site_id": r["site_id"], "site_name": r["site_name"], "count": 0, "first_due": r["next_due_date"]})
            v["count"] += 1
            v["first_due"] = min(v["first_due"], r["next_due_date"])

        # Carico mese per mese: il mese corrente include le scadute.
        months = []
        y, m = today.year, today.month
        for _ in range(12):
            key = f"{y:04d}-{m:02d}"
            in_month = [r for r in rows if (r["next_due_date"] or "").startswith(key)]
            if (y, m) == (today.year, today.month):
                in_month += [r for r in rows if (r["next_due_date"] or "") < f"{key}-01"]
            c = Counter(self._due_state(r, today_iso, in30_iso) for r in in_month)
            months.append({"month": key, "overdue": c["overdue"], "next30": c["next30"], "later": c["later"]})
            m += 1
            if m > 12:
                y, m = y + 1, 1

        ev_qs = MaintenanceEvent.objects.filter(deleted_at__isnull=True)
        customer_param = request.query_params.get("customer")
        if customer_param:
            ev_qs = ev_qs.filter(plan__customer_id=customer_param)
        month_start = date_cls(today.year, today.month, 1)

        total = len(rows) + done
        return Response({
            "total": len(rows),
            "overdue": states["overdue"],
            "next30": states["next30"],
            "later": states["later"],
            "override": sum(1 for r in rows if r["due_date_override"]),
            "first_next30": min((r["next_due_date"] for r in rows if self._due_state(r, today_iso, in30_iso) == "next30"), default=None),
            "next30_customers": len({r["customer_id"] for r in rows if self._due_state(r, today_iso, in30_iso) == "next30"}),
            "coverage": {"done": done, "total": total},
            "overdue_by_customer": [{"customer_id": cid, "customer_name": name, "count": n} for (cid, name), n in overdue_by_customer.most_common(5)],
            "next_visits": sorted(visits.values(), key=lambda v: (v["first_due"], v["customer_name"] or ""))[:6],
            "months": months,
            "events_this_month": ev_qs.filter(performed_at__gte=month_start).count(),
            "follow_up": ev_qs.filter(result__in=("ko", "partial"), performed_at__gte=today - timedelta(days=60)).count(),
            "customers": [{"id": i, "name": n} for i, n in sorted({(r["customer_id"], r["customer_name"]) for r in rows}, key=lambda x: x[1] or "")],
            "plans": [{"id": i, "title": t} for i, t in sorted({(r["plan_id"], r["plan_title"]) for r in rows}, key=lambda x: x[1] or "")],
            "types": sorted({r["type_label"] for r in rows if r["type_label"]}),
        })

    @action(detail=False, methods=["get"], url_path="plan-stats")
    def plan_stats(self, request):
        """Indicatori della pagina Piani: piani in corso, completati, con scadute,
        archiviati e copertura del ciclo (fatte / coperte), con la regola di todo."""
        today = timezone.localdate()
        year_start = today.replace(month=1, day=1)
        base = MaintenancePlan.objects.filter(deleted_at__isnull=True).filter(visible_plans_q(request.user))
        customer_param = request.query_params.get("customer")
        if customer_param:
            base = base.filter(customer_id=customer_param)
        active = list(base.filter(next_due_date__gte=year_start, is_active=True).prefetch_related("inventory_types"))
        covered = self._compute_covered_count_map(active)
        counts = self._plan_todo_counts(request)
        total = sum(covered.values())
        todo = sum(min(counts.get(p.id, (0, 0))[0], covered.get(p.id, 0)) for p in active)
        return Response({
            "active": len(active),
            "customers": len({p.customer_id for p in active}),
            "covered": total,
            "done": total - todo,
            "with_overdue": sum(1 for p in active if counts.get(p.id, (0, 0))[1]),
            "completed": sum(1 for p in active if covered.get(p.id) and not counts.get(p.id)),
            "archived": base.filter(Q(next_due_date__lt=year_start) | Q(is_active=False)).count(),
        })


def todo_rows_for_jobs() -> list[dict]:
    """Righe (piano, inventory) da fare, per i job di sistema (cron) senza utente.

    Stesso calcolo di `MaintenancePlanViewSet.todo` senza filtri, ma senza passare
    dall'API: una chiamata alla vista senza utente risponde 401 (barriera Archie).
    """
    from django.http import QueryDict

    class _JobRequest:
        query_params = QueryDict("")

    rows, _done = MaintenancePlanViewSet()._todo_rows(_JobRequest())
    return rows
