"""maintenance/api/plan_inventories.py — API per la pivot MaintenancePlanInventory.

Endpoint: /api/maintenance-plan-inventories/

Operazioni principali:
  GET    list   → tutti i record (filtrabili per piano, inventory, customer, scadenza)
  GET    retrieve
  POST   create → aggiunge un inventory a un piano (con eventuale override data)
  PATCH  update → imposta/rimuove due_date_override
  DELETE destroy → rimuove l'inventory dal piano (soft delete ereditato)

Endpoint aggiuntivo:
  POST /api/maintenance-plan-inventories/sync/
    → popola automaticamente la pivot per uno o più piani partendo da
      inventory_types + inventory attivi del cliente.
"""
from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.mixins import SoftDeleteAuditMixin
from core.soft_delete import apply_soft_delete_filters
from core.models import InventoryStatus
from audit.utils import log_event
from inventory.models import Inventory
from maintenance.models import MaintenancePlan, MaintenancePlanInventory


# ─────────────────────────────────────────────────────────────────────────────
# Serializer
# ─────────────────────────────────────────────────────────────────────────────

class MaintenancePlanInventorySerializer(serializers.ModelSerializer):
    # Campi read-only denormalizzati utili al frontend (evitano join lato client)
    inventory_name    = serializers.CharField(source="inventory.name",       read_only=True)
    inventory_knumber = serializers.CharField(source="inventory.knumber",    read_only=True, allow_null=True)
    inventory_hostname = serializers.CharField(source="inventory.hostname",  read_only=True, allow_null=True)
    inventory_type_label = serializers.CharField(source="inventory.type.label", read_only=True, allow_null=True)
    site_id           = serializers.IntegerField(source="inventory.site_id", read_only=True, allow_null=True)
    site_name         = serializers.SerializerMethodField()
    customer_id       = serializers.IntegerField(source="plan.customer_id",  read_only=True)

    # Data effettiva: override se presente, altrimenti quella del piano
    effective_due_date = serializers.SerializerMethodField()

    # Data del piano (comodo averla inline per il frontend)
    plan_next_due_date = serializers.DateField(source="plan.next_due_date",  read_only=True)

    def get_effective_due_date(self, obj):
        d = obj.due_date_override or obj.plan.next_due_date
        return d.isoformat() if d else None

    def get_site_name(self, obj):
        site = obj.inventory.site if obj.inventory_id else None
        if not site:
            return None
        return getattr(site, "display_name", None) or site.name

    class Meta:
        model  = MaintenancePlanInventory
        fields = [
            "id",
            "plan",
            "inventory",
            # denormalizzati
            "inventory_name",
            "inventory_knumber",
            "inventory_hostname",
            "inventory_type_label",
            "site_id",
            "site_name",
            "customer_id",
            "plan_next_due_date",
            # core
            "due_date_override",
            "effective_due_date",
            "notes",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = ["created_at", "updated_at", "deleted_at"]
        # Disabilita il UniqueTogetherValidator auto-generato dal constraint con
        # condition=Q(deleted_at__isnull=True): cerca 'deleted_at' in attrs ma
        # quel campo è read_only e non è presente durante il PATCH → KeyError.
        # L'unicità è gestita manualmente in validate() qui sotto.
        validators = []

    def validate(self, data):
        """
        1. Verifica che l'inventory appartenga allo stesso cliente del piano.
        2. Verifica unicità (plan, inventory) tra i record attivi,
           escludendo l'istanza corrente in caso di update.
        """
        plan      = data.get("plan")      or (self.instance.plan      if self.instance else None)
        inventory = data.get("inventory") or (self.instance.inventory if self.instance else None)

        if plan and inventory and inventory.customer_id != plan.customer_id:
            raise serializers.ValidationError(
                {"inventory": "L'inventory non appartiene al cliente del piano."}
            )

        # Unicità manuale: esclude il record corrente (update) e i soft-deleted
        if plan and inventory:
            qs = MaintenancePlanInventory.objects.filter(
                plan=plan,
                inventory=inventory,
                deleted_at__isnull=True,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"inventory": "Questo inventory è già associato al piano."}
                )

        return data


# ─────────────────────────────────────────────────────────────────────────────
# ViewSet
# ─────────────────────────────────────────────────────────────────────────────

class MaintenancePlanInventoryViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = MaintenancePlanInventorySerializer
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["plan", "inventory"]
    search_fields    = [
        "inventory__name", "inventory__knumber", "inventory__hostname",
        "plan__title", "plan__customer__name", "plan__customer__code",
    ]
    ordering_fields  = ["due_date_override", "plan__next_due_date", "created_at", "updated_at"]
    ordering         = ["created_at"]

    def get_queryset(self):
        qs = (
            MaintenancePlanInventory.objects
            .select_related(
                "plan", "plan__customer",
                "inventory", "inventory__site", "inventory__type",
            )
        )

        # Filtri extra non coperti da filterset_fields
        customer = self.request.query_params.get("customer")
        if customer:
            qs = qs.filter(plan__customer_id=customer)

        site = self.request.query_params.get("site")
        if site:
            qs = qs.filter(inventory__site_id=site)

        # Filtro scadenza — lavora su effective_due_date:
        # se c'è un override usa quello, altrimenti la data del piano.
        due   = (self.request.query_params.get("due") or "").strip().lower()
        today = timezone.localdate()
        if due == "overdue":
            qs = qs.filter(
                Q(due_date_override__lt=today) |
                Q(due_date_override__isnull=True, plan__next_due_date__lt=today)
            )
        elif due == "next7":
            qs = qs.filter(
                Q(due_date_override__gte=today, due_date_override__lte=today + timedelta(days=7)) |
                Q(due_date_override__isnull=True,
                  plan__next_due_date__gte=today,
                  plan__next_due_date__lte=today + timedelta(days=7))
            )
        elif due == "next30":
            qs = qs.filter(
                Q(due_date_override__gte=today, due_date_override__lte=today + timedelta(days=30)) |
                Q(due_date_override__isnull=True,
                  plan__next_due_date__gte=today,
                  plan__next_due_date__lte=today + timedelta(days=30))
            )

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    def perform_create(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)

    # ── Action: reset override ────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="reset-override")
    def reset_override(self, request, pk=None):
        """Rimuove il due_date_override: il record torna ad ereditare la data del piano."""
        obj = self.get_object()
        obj.due_date_override = None
        obj.save(update_fields=["due_date_override", "updated_at"])
        log_event(actor=request.user, action="update", instance=obj, request=request,
                  changes={"due_date_override": None})
        return Response(self.get_serializer(obj).data)

    # ── Action: sync ─────────────────────────────────────────────────────────

    @action(detail=False, methods=["post"])
    def sync(self, request):
        """
        Popola/aggiorna automaticamente la pivot per uno o più piani.

        Body (JSON):
          { "plan_ids": [1, 2, 3] }   → sincronizza solo quei piani
          { "plan_ids": [] }           → sincronizza TUTTI i piani attivi

        Per ogni piano:
          - trova tutti gli inventory attivi del cliente compatibili con
            inventory_types del piano
          - crea i record pivot mancanti (skip su quelli già esistenti,
            compresi i soft-deleted per non perdere gli override)
          - NON cancella record pivot esistenti (la rimozione è esplicita)

        Risposta:
          { "created": 12, "skipped": 5, "plans_processed": 3 }
        """
        plan_ids = request.data.get("plan_ids", [])

        plans_qs = (
            MaintenancePlan.objects
            .filter(deleted_at__isnull=True, is_active=True)
            .prefetch_related("inventory_types")
        )
        if plan_ids:
            plans_qs = plans_qs.filter(id__in=plan_ids)

        active_status_ids = list(
            InventoryStatus.objects.filter(
                key__in=("in_use", "maintenance", "repair"),
                deleted_at__isnull=True,
            ).values_list("id", flat=True)
        )

        created = 0
        skipped = 0
        plans_processed = 0

        with transaction.atomic():
            for plan in plans_qs:
                plans_processed += 1
                type_ids = list(plan.inventory_types.values_list("id", flat=True))
                if not type_ids:
                    continue

                inventories = Inventory.objects.filter(
                    customer_id=plan.customer_id,
                    type_id__in=type_ids,
                    status_id__in=active_status_ids,
                    deleted_at__isnull=True,
                )

                # Inventory già presenti nella pivot (anche soft-deleted: non li ricreiamo)
                existing_inv_ids = set(
                    MaintenancePlanInventory.objects
                    .filter(plan=plan, inventory_id__in=inventories.values_list("id", flat=True))
                    .values_list("inventory_id", flat=True)
                )

                to_create = [
                    MaintenancePlanInventory(plan=plan, inventory=inv)
                    for inv in inventories
                    if inv.id not in existing_inv_ids
                ]
                if to_create:
                    MaintenancePlanInventory.objects.bulk_create(to_create, ignore_conflicts=True)
                    created += len(to_create)
                skipped += len(existing_inv_ids)

        return Response({
            "created": created,
            "skipped": skipped,
            "plans_processed": plans_processed,
        }, status=status.HTTP_200_OK)
