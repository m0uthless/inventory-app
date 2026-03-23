"""maintenance/api/events.py — MaintenanceEvent serializer + ViewSet."""
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

from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from maintenance.models import MaintenanceEvent, MaintenancePlan, Tech
from maintenance.api.helpers import compute_next_due_date

class MaintenanceEventSerializer(serializers.ModelSerializer):
    # Da piano → customer
    customer_code = serializers.CharField(source="plan.customer.code", read_only=True)
    customer_name = serializers.CharField(source="plan.customer.name", read_only=True)

    # Da inventory (nullable site)
    site_name          = serializers.SerializerMethodField()
    inventory_hostname = serializers.CharField(source="inventory.hostname", read_only=True, allow_null=True)
    inventory_knumber  = serializers.CharField(source="inventory.knumber",  read_only=True, allow_null=True)
    inventory_name     = serializers.CharField(source="inventory.name",     read_only=True)

    plan_title         = serializers.CharField(source="plan.title",            read_only=True)
    created_by_username = serializers.CharField(source="created_by.username",  read_only=True, allow_null=True)
    tech_name  = serializers.SerializerMethodField()

    def get_tech_name(self, obj):
        if obj.tech_id is None:
            return None
        return str(obj.tech)
    pdf_url    = serializers.SerializerMethodField()
    # Campo scrivibile per il caricamento diretto del PDF durante create/update.
    # Separato da pdf_url (read-only, URL assoluto) per evitare ambiguità.
    pdf_file   = serializers.FileField(required=False, allow_null=True, write_only=False)

    def get_site_name(self, obj):
        return obj.inventory.site.name if obj.inventory.site_id and obj.inventory.site else None

    def get_pdf_url(self, obj):
        if not obj.pdf_file:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.pdf_file.url) if request else obj.pdf_file.url

    def validate(self, attrs):
        # tech è obbligatorio per tutti i result tranne not_planned
        result = attrs.get("result", getattr(self.instance, "result", None))
        tech   = attrs.get("tech",   getattr(self.instance, "tech",   None))
        if result != "not_planned" and not tech:
            raise serializers.ValidationError({"tech": "Il tecnico è obbligatorio."})
        return attrs

    class Meta:
        model  = MaintenanceEvent
        fields = [
            "id",
            "plan",
            "plan_title",
            "inventory",
            "inventory_name",
            "inventory_hostname",
            "inventory_knumber",
            "customer_code",
            "customer_name",
            "site_name",
            "performed_at",
            "result",
            "tech",
            "tech_name",
            "created_by",
            "created_by_username",
            "notes",
            "pdf_file",
            "pdf_url",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class MaintenanceEventViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class  = MaintenanceEventSerializer
    filter_backends   = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    parser_classes    = [MultiPartParser, FormParser, JSONParser]

    filterset_fields = ["inventory", "plan", "tech", "result", "plan__customer"]
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
                "created_by",
            )
        )

        customer = self.request.query_params.get("customer")
        if customer:
            qs = qs.filter(plan__customer_id=customer)

        year = self.request.query_params.get("performed_at__year")
        if year and year.isdigit() and len(year) == 4:
            qs = qs.filter(performed_at__year=int(year))

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    def perform_create(self, serializer):
        """Salva l'evento e ricalcola automaticamente next_due_date del piano.
        Per result=not_planned non si avanza la data: la manutenzione non è stata eseguita."""
        event = serializer.save(created_by=self.request.user)
        if event.result != "not_planned":
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


    @action(detail=True, methods=["post"], url_path="upload-pdf",
            parser_classes=[MultiPartParser, FormParser])
    def upload_pdf(self, request, pk=None):
        """Carica o sostituisce il PDF allegato senza toccare gli altri campi."""
        event = self.get_object()
        pdf_file = request.FILES.get("pdf_file")
        if not pdf_file:
            return Response({"detail": "Nessun file inviato."}, status=400)
        # Rimuovi vecchio file se presente
        if event.pdf_file:
            event.pdf_file.delete(save=False)
        event.pdf_file = pdf_file
        event.save(update_fields=["pdf_file", "updated_at"])
        log_event(actor=request.user, action="update", instance=event, request=request,
                  changes={"pdf_file": pdf_file.name})
        return Response(self.get_serializer(event).data)

    @action(detail=True, methods=["delete"], url_path="delete-pdf")
    def delete_pdf(self, request, pk=None):
        event = self.get_object()
        if not event.pdf_file:
            return Response({"detail": "Nessun PDF allegato."}, status=400)
        if not (request.user.is_superuser or event.created_by_id == request.user.id):
            return Response({"detail": "Non sei autorizzato a eliminare questo PDF."}, status=403)
        old_name = str(event.pdf_file)
        event.pdf_file.delete(save=True)
        log_event(actor=request.user, action="update", instance=event, request=request,
                  changes={"pdf_file": [old_name, None]})
        return Response({"detail": "PDF eliminato."})

    @action(detail=True, methods=["patch"], url_path="set-not-planned")
    def set_not_planned(self, request, pk=None):
        event = self.get_object()
        if event.pdf_file:
            event.pdf_file.delete(save=False)
        event.result = "not_planned"
        event.tech = None
        event.pdf_file = None
        event.save(update_fields=["result", "tech", "pdf_file", "updated_at"])
        log_event(actor=request.user, action="update", instance=event, request=request,
                  changes={"result": "not_planned"})
        return Response(self.get_serializer(event).data)

    @action(detail=True, methods=["post"], url_path="reset",
            permission_classes=[CanPurgeModelPermission])
    def reset_maintenance(self, request, pk=None):
        """Hard-delete del rapportino (+ PDF se presente).
        L'inventory torna nella lista scadenze poiché non esiste più un evento
        ok/ko/not_planned che lo esclude dal todo.
        """
        event = self.get_object()
        if event.pdf_file:
            event.pdf_file.delete(save=False)
        log_event(
            actor=request.user, action="delete", instance=event, request=request,
            metadata={"hard_delete": True},
            subject=f"reset maintenance event {event.id}",
        )
        event.delete()  # hard delete — rimuove definitivamente il record
        return Response(status=204)

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


