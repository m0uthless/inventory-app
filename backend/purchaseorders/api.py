from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from django_filters import rest_framework as filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from audit.utils import log_event
from core.media import build_action_url, protected_media_response
from core.mixins import RestoreActionMixin, SoftDeleteAuditMixin
from core.soft_delete import apply_soft_delete_filters
from core.uploads import validate_upload

from .models import (
    LOCKED_WHEN_NOT_INSERITO,
    PURCHASE_ORDER_STATUS_ORDER,
    PurchaseOrderAmountMode,
    PurchaseOrderEntry,
    PurchaseOrderStatus,
    PurchaseOrderType,
)

DOCUMENT_MAX_BYTES = 15 * 1024 * 1024  # 15 MB
DOCUMENT_ALLOWED_EXTENSIONS = ["pdf"]
DOCUMENT_ALLOWED_CONTENT_TYPES = ["application/pdf"]

# Stato raggiunto -> (campo file, campo timestamp) popolati da quella transizione.
STATUS_DOCUMENT_FIELD = {
    PurchaseOrderStatus.INVIATO:   "offer_document",
    PurchaseOrderStatus.RICEVUTO:  "po_document",
    PurchaseOrderStatus.FATTURATO: "invoice_document",
}
STATUS_TIMESTAMP_FIELD = {
    PurchaseOrderStatus.INVIATO:   "sent_at",
    PurchaseOrderStatus.RICEVUTO:  "received_at",
    PurchaseOrderStatus.FATTURATO: "invoiced_at",
}


def _validate_document(value):
    return validate_upload(
        value,
        label="documento",
        max_bytes=DOCUMENT_MAX_BYTES,
        allowed_extensions=DOCUMENT_ALLOWED_EXTENSIONS,
        allowed_content_types=DOCUMENT_ALLOWED_CONTENT_TYPES,
        strict_real_mime=True,
    )


# ─── Serializer ──────────────────────────────────────────────────────────────

class PurchaseOrderEntrySerializer(serializers.ModelSerializer):
    customer_name       = serializers.CharField(source="customer.name", read_only=True, default=None)
    customer_code       = serializers.CharField(source="customer.code", read_only=True, default=None)
    kind_label          = serializers.CharField(source="get_kind_display",        read_only=True)
    amount_mode_label   = serializers.CharField(source="get_amount_mode_display", read_only=True)
    status_label        = serializers.CharField(source="get_status_display",      read_only=True)
    created_by_username = serializers.CharField(source="created_by.username",   read_only=True, default=None)
    is_invoiced         = serializers.BooleanField(read_only=True)
    is_editable         = serializers.BooleanField(read_only=True)

    offer_document_name   = serializers.SerializerMethodField()
    offer_document_url    = serializers.SerializerMethodField()
    po_document_name      = serializers.SerializerMethodField()
    po_document_url       = serializers.SerializerMethodField()
    invoice_document_name = serializers.SerializerMethodField()
    invoice_document_url  = serializers.SerializerMethodField()

    class Meta:
        model  = PurchaseOrderEntry
        fields = [
            "id",
            "offer_date",
            "description",
            "client_name",
            "customer", "customer_name", "customer_code",
            "purchase_order",
            "invoice_number", "is_invoiced",
            "kind", "kind_label",
            "status", "status_label", "is_editable",
            "sent_at", "received_at", "invoiced_at",
            "offer_document", "offer_document_name", "offer_document_url",
            "po_document", "po_document_name", "po_document_url",
            "invoice_document", "invoice_document_name", "invoice_document_url",
            "amount_mode", "amount_mode_label",
            "days", "daily_rate", "amount",
            "costs_incurred",
            "notes",
            "created_by", "created_by_username",
            "created_at", "updated_at", "deleted_at",
        ]
        read_only_fields = [
            "id",
            "customer_name", "customer_code",
            "kind_label", "amount_mode_label",
            "status", "status_label", "is_editable",
            "sent_at", "received_at", "invoiced_at",
            "is_invoiced",
            "created_by", "created_by_username",
            "created_at", "updated_at", "deleted_at",
        ]
        extra_kwargs = {
            "offer_document":   {"write_only": True, "required": False, "allow_null": True},
            "po_document":      {"write_only": True, "required": False, "allow_null": True},
            "invoice_document": {"write_only": True, "required": False, "allow_null": True},
        }

    def validate_offer_document(self, value):
        return _validate_document(value)

    def validate_po_document(self, value):
        return _validate_document(value)

    def validate_invoice_document(self, value):
        return _validate_document(value)

    def _document_name(self, file_field):
        if not file_field:
            return None
        return file_field.name.rsplit("/", 1)[-1]

    def _document_url(self, obj, file_field, action_name):
        if not file_field:
            return None
        return build_action_url(
            request=self.context.get("request"),
            relative_path=f"/api/purchase-order-entries/{obj.pk}/{action_name}/",
        )

    def get_offer_document_name(self, obj):
        return self._document_name(obj.offer_document)

    def get_offer_document_url(self, obj):
        return self._document_url(obj, obj.offer_document, "offer-document")

    def get_po_document_name(self, obj):
        return self._document_name(obj.po_document)

    def get_po_document_url(self, obj):
        return self._document_url(obj, obj.po_document, "po-document")

    def get_invoice_document_name(self, obj):
        return self._document_name(obj.invoice_document)

    def get_invoice_document_url(self, obj):
        return self._document_url(obj, obj.invoice_document, "invoice-document")

    def validate(self, attrs):
        # ── Blocco campi descrizione/importo fuori dallo stato INSERITO ───────
        # (status è read-only quindi non può essere cambiato da qui: cambia
        # solo tramite le action advance()/revert() del ViewSet.)
        if self.instance is not None and self.instance.status != PurchaseOrderStatus.INSERITO:
            locked_errors = {}
            for field in LOCKED_WHEN_NOT_INSERITO:
                if field in attrs and attrs[field] != getattr(self.instance, field):
                    locked_errors[field] = (
                        "Non modificabile con lo stato attuale. "
                        "Riporta il Purchase Order in stato 'Inserito' per modificarlo."
                    )
            if locked_errors:
                raise serializers.ValidationError(locked_errors)

        mode = attrs.get("amount_mode", getattr(self.instance, "amount_mode", PurchaseOrderAmountMode.FISSO))

        if mode == PurchaseOrderAmountMode.GIORNATE:
            days = attrs.get("days", getattr(self.instance, "days", None))
            rate = attrs.get("daily_rate", getattr(self.instance, "daily_rate", None))
            errors = {}
            if days is None:
                errors["days"] = "Le giornate sono obbligatorie in modalità 'Giornate × tariffa'."
            if rate is None:
                errors["daily_rate"] = "La tariffa/giorno è obbligatoria in modalità 'Giornate × tariffa'."
            if errors:
                raise serializers.ValidationError(errors)
        else:
            amount = attrs.get("amount", getattr(self.instance, "amount", None))
            if amount is None:
                raise serializers.ValidationError({"amount": "L'importo è obbligatorio in modalità 'Valore fisso'."})
            # In modalità fisso, giornate/tariffa non sono usate: le azzeriamo
            # per evitare valori residui inconsistenti da un cambio modalità.
            attrs.setdefault("days", None)
            attrs.setdefault("daily_rate", None)

        customer = attrs.get("customer", getattr(self.instance, "customer", None))
        client_name = attrs.get("client_name", getattr(self.instance, "client_name", None))
        if not customer and not (client_name or "").strip():
            raise serializers.ValidationError({"client_name": "Indica il committente (testo libero o cliente collegato)."})

        return attrs


# ─── Filters ─────────────────────────────────────────────────────────────────

class PurchaseOrderEntryFilter(filters.FilterSet):
    kind             = filters.MultipleChoiceFilter(choices=PurchaseOrderType.choices)
    status           = filters.MultipleChoiceFilter(choices=PurchaseOrderStatus.choices)
    amount_mode      = filters.CharFilter(field_name="amount_mode")
    customer         = filters.NumberFilter(field_name="customer_id")
    invoiced         = filters.BooleanFilter(method="filter_invoiced")
    year             = filters.NumberFilter(field_name="offer_date", lookup_expr="year")
    offer_date_after  = filters.DateFilter(field_name="offer_date", lookup_expr="gte")
    offer_date_before = filters.DateFilter(field_name="offer_date", lookup_expr="lte")

    class Meta:
        model  = PurchaseOrderEntry
        fields = ["kind", "status", "amount_mode", "customer", "invoiced", "year"]

    def filter_invoiced(self, queryset, name, value):
        if value is True:
            return queryset.exclude(invoice_number="")
        if value is False:
            return queryset.filter(invoice_number="")
        return queryset


# ─── ViewSet ─────────────────────────────────────────────────────────────────

class PurchaseOrderEntryViewSet(RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    """ViewSet per PurchaseOrderEntry.

    Eredita da RestoreActionMixin + SoftDeleteAuditMixin (vedi core.mixins):
    perform_create/perform_update/perform_destroy standard con audit log,
    più l'azione `restore`/`bulk_restore`. Nessun override necessario perché
    il modello ha created_by/updated_by come tutti gli altri moduli CRUD.

    Workflow (`advance`/`revert`): SEMPRE un passo alla volta, in entrambe le
    direzioni (deciso in chat). Il PDF è opzionale in `advance` — se assente
    può essere caricato dopo con un PATCH multipart sul campo corrispondente
    (offer_document/po_document/invoice_document), servito poi dalle action
    `offer-document`/`po-document`/`invoice-document`.
    """

    # RestoreActionMixin: nessuna personalizzazione necessaria (created_by/
    # updated_by presenti come negli altri moduli CRUD standard).

    serializer_class = PurchaseOrderEntrySerializer
    parser_classes   = [MultiPartParser, FormParser, JSONParser]
    filter_backends  = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class  = PurchaseOrderEntryFilter
    search_fields    = [
        "description", "client_name", "purchase_order",
        "invoice_number", "customer__name", "customer__display_name",
    ]
    ordering_fields  = [
        "offer_date", "created_at", "updated_at", "amount",
        "client_name", "kind", "amount_mode", "status", "deleted_at",
    ]
    ordering = ["-offer_date"]

    def get_queryset(self):
        qs = PurchaseOrderEntry.objects.select_related("customer", "created_by", "updated_by")
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    def _has_change_perm(self, request) -> bool:
        return bool(request.user and request.user.has_perm("purchaseorders.change_purchaseorderentry"))

    # ── KPI ──────────────────────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Conteggi/totali per i KPI in testata pagina, filtrati per anno (`?year=`).

        `total_amount` è la somma degli importi di TUTTI i Purchase Order,
        indipendentemente dallo stato workflow (deciso in chat). `to_send` e
        `waiting` sono invece conteggi filtrati per stato:
          - to_send: stato INSERITO (offerta non ancora inviata)
          - waiting: stato INVIATO o RICEVUTO (in attesa di riscontro dal cliente)

        Include anche il confronto con l'anno precedente (`previous_year`,
        `previous_year_amount`, `yoy_delta_pct`) per il KPI di variazione
        annua del totale in Euro (deciso in chat). `yoy_delta_pct` è `None`
        quando l'anno precedente non ha importi da confrontare (evita
        divisioni per zero / percentuali fuorvianti).
        """
        base_qs = PurchaseOrderEntry.objects.filter(deleted_at__isnull=True)

        year_param = request.query_params.get("year")
        try:
            year = int(year_param) if year_param else None
        except (TypeError, ValueError):
            year = None

        qs = base_qs.filter(offer_date__year=year) if year else base_qs

        total_amount = qs.aggregate(total=Sum("amount"))["total"] or Decimal("0")
        to_send = qs.filter(status=PurchaseOrderStatus.INSERITO).count()
        waiting = qs.filter(status__in=[PurchaseOrderStatus.INVIATO, PurchaseOrderStatus.RICEVUTO]).count()

        previous_year = (year - 1) if year else None
        previous_year_amount = None
        yoy_delta_pct = None
        if previous_year:
            prev_total = base_qs.filter(offer_date__year=previous_year).aggregate(total=Sum("amount"))["total"] or Decimal("0")
            previous_year_amount = str(prev_total)
            if prev_total:
                yoy_delta_pct = float((total_amount - prev_total) / prev_total * 100)

        return Response({
            "total_amount": str(total_amount),
            "to_send": to_send,
            "waiting": waiting,
            "previous_year": previous_year,
            "previous_year_amount": previous_year_amount,
            "yoy_delta_pct": yoy_delta_pct,
        })

    # ── Workflow: advance / revert ────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="advance", permission_classes=[permissions.IsAuthenticated])
    def advance(self, request, pk=None):
        """Avanza di UN passo lo stato (inserito->inviato->ricevuto->fatturato).

        Body multipart opzionale: `document` (PDF) viene salvato nel campo
        corrispondente allo stato di destinazione.
        """
        if not self._has_change_perm(request):
            return Response({"detail": "Permesso negato."}, status=status.HTTP_403_FORBIDDEN)

        obj = self.get_object()
        idx = PURCHASE_ORDER_STATUS_ORDER.index(obj.status)
        if idx >= len(PURCHASE_ORDER_STATUS_ORDER) - 1:
            return Response(
                {"detail": "Il Purchase Order è già nello stato finale (Fatturato)."},
                status=status.HTTP_409_CONFLICT,
            )
        new_status = PURCHASE_ORDER_STATUS_ORDER[idx + 1]
        before_status = obj.status

        # PO/Fattura: opzionali, inviabili insieme al PDF quando si avanza
        # rispettivamente a "ricevuto"/"fatturato" (deciso in chat).
        po_number = (request.data.get("purchase_order") or "").strip()
        if po_number:
            obj.purchase_order = po_number
        invoice_num = (request.data.get("invoice_number") or "").strip()
        if invoice_num:
            obj.invoice_number = invoice_num

        uploaded = request.FILES.get("document")
        if uploaded:
            uploaded = _validate_document(uploaded)
            field_name = STATUS_DOCUMENT_FIELD[new_status]
            setattr(obj, field_name, uploaded)

        obj.status = new_status
        setattr(obj, STATUS_TIMESTAMP_FIELD[new_status], timezone.now())
        obj.updated_by = request.user
        obj.save()

        log_event(
            actor=request.user, action="update", instance=obj,
            changes={"status": {"from": before_status, "to": new_status}},
            request=request,
        )
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"], url_path="revert", permission_classes=[permissions.IsAuthenticated])
    def revert(self, request, pk=None):
        """Torna indietro di UN passo. Azzera il timestamp dello step lasciato
        (il documento eventualmente già caricato resta, non viene cancellato)."""
        if not self._has_change_perm(request):
            return Response({"detail": "Permesso negato."}, status=status.HTTP_403_FORBIDDEN)

        obj = self.get_object()
        idx = PURCHASE_ORDER_STATUS_ORDER.index(obj.status)
        if idx == 0:
            return Response(
                {"detail": "Il Purchase Order è già in stato 'Inserito'."},
                status=status.HTTP_409_CONFLICT,
            )
        before_status = obj.status
        new_status = PURCHASE_ORDER_STATUS_ORDER[idx - 1]

        ts_field = STATUS_TIMESTAMP_FIELD.get(before_status)
        obj.status = new_status
        update_fields = ["status", "updated_by", "updated_at"]
        if ts_field:
            setattr(obj, ts_field, None)
            update_fields.append(ts_field)
        obj.updated_by = request.user
        obj.save(update_fields=update_fields)

        log_event(
            actor=request.user, action="update", instance=obj,
            changes={"status": {"from": before_status, "to": new_status}},
            request=request,
        )
        return Response(self.get_serializer(obj).data)

    # ── Documenti PDF ─────────────────────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="offer-document")
    def offer_document_file(self, request, pk=None):
        obj = self.get_object()
        filename = obj.offer_document.name.rsplit("/", 1)[-1] if obj.offer_document else None
        return protected_media_response(file_field=obj.offer_document, disposition="inline", filename=filename)

    @action(detail=True, methods=["get"], url_path="po-document")
    def po_document_file(self, request, pk=None):
        obj = self.get_object()
        filename = obj.po_document.name.rsplit("/", 1)[-1] if obj.po_document else None
        return protected_media_response(file_field=obj.po_document, disposition="inline", filename=filename)

    @action(detail=True, methods=["get"], url_path="invoice-document")
    def invoice_document_file(self, request, pk=None):
        obj = self.get_object()
        filename = obj.invoice_document.name.rsplit("/", 1)[-1] if obj.invoice_document else None
        return protected_media_response(file_field=obj.invoice_document, disposition="inline", filename=filename)
