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
    PurchaseOrderDocument,
    PurchaseOrderDocumentKind,
    PurchaseOrderEntry,
    PurchaseOrderStatus,
    PurchaseOrderType,
)

DOCUMENT_MAX_BYTES = 15 * 1024 * 1024  # 15 MB
DOCUMENT_ALLOWED_EXTENSIONS = ["pdf"]
DOCUMENT_ALLOWED_CONTENT_TYPES = ["application/pdf"]

# Stato raggiunto -> kind del documento creato da quella transizione, e campo
# timestamp popolato. Punto 9: ogni transizione crea una nuova riga
# PurchaseOrderDocument (append), non sovrascrive più un campo singolo.
STATUS_DOCUMENT_KIND = {
    PurchaseOrderStatus.INVIATO:   PurchaseOrderDocumentKind.OFFER,
    PurchaseOrderStatus.RICEVUTO:  PurchaseOrderDocumentKind.PO,
    PurchaseOrderStatus.FATTURATO: PurchaseOrderDocumentKind.INVOICE,
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


# ─── PurchaseOrderDocument serializer ────────────────────────────────────────

class PurchaseOrderDocumentSerializer(serializers.ModelSerializer):
    kind_label           = serializers.CharField(source="get_kind_display", read_only=True)
    filename             = serializers.SerializerMethodField()
    url                  = serializers.SerializerMethodField()
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True, default=None)

    class Meta:
        model = PurchaseOrderDocument
        fields = [
            "id", "kind", "kind_label", "filename", "url",
            "uploaded_at", "uploaded_by", "uploaded_by_username",
        ]
        read_only_fields = fields

    def get_filename(self, obj):
        if obj.original_filename:
            return obj.original_filename
        return obj.file.name.rsplit("/", 1)[-1] if obj.file else None

    def get_url(self, obj):
        return build_action_url(
            request=self.context.get("request"),
            relative_path=f"/api/purchase-order-entries/{obj.entry_id}/documents/{obj.pk}/",
        )


# ─── Serializer ──────────────────────────────────────────────────────────────

class PurchaseOrderEntrySerializer(serializers.ModelSerializer):
    customer_name       = serializers.SerializerMethodField()
    customer_code       = serializers.CharField(source="customer.code", read_only=True, default=None)
    kind_label          = serializers.CharField(source="get_kind_display",        read_only=True)
    amount_mode_label   = serializers.CharField(source="get_amount_mode_display", read_only=True)
    status_label        = serializers.CharField(source="get_status_display",      read_only=True)
    created_by_username = serializers.CharField(source="created_by.username",   read_only=True, default=None)
    is_invoiced         = serializers.BooleanField(read_only=True)
    is_editable         = serializers.BooleanField(read_only=True)
    is_customer_placeholder = serializers.BooleanField(read_only=True)

    # Punto 9: lista di documenti (0..N per tipo), non più un singolo file per
    # tipo. Sola lettura qui: l'upload passa dall'azione dedicata `documents`.
    documents = PurchaseOrderDocumentSerializer(many=True, read_only=True)

    class Meta:
        model  = PurchaseOrderEntry
        fields = [
            "id",
            "offer_date",
            "description",
            "client_name",
            "customer", "customer_name", "customer_code", "customer_placeholder", "is_customer_placeholder",
            "purchase_order",
            "invoice_number", "is_invoiced",
            "kind", "kind_label",
            "status", "status_label", "is_editable",
            "sent_at", "received_at", "invoiced_at",
            "documents",
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
            "is_customer_placeholder",
            "documents",
            "created_by", "created_by_username",
            "created_at", "updated_at", "deleted_at",
        ]

    def get_customer_name(self, obj):
        """Nome del cliente collegato: il testo libero (customer_placeholder)
        ha priorità se presente — è mutuamente esclusivo col cliente vero e
        proprio (vedi validate()). Altrimenti display_name del cliente reale
        (fallback su name), o None se non c'è nessun collegamento."""
        if obj.customer_placeholder:
            return obj.customer_placeholder
        if not obj.customer_id:
            return None
        return obj.customer.display_name or obj.customer.name

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

        # Cliente collegato: `customer` (anagrafica) e `customer_placeholder`
        # (testo libero) sono mutuamente esclusivi — stesso concetto del
        # pattern in issues.models, ma senza sentinella perché qui `customer`
        # resta nullable.
        placeholder = attrs.get("customer_placeholder", getattr(self.instance, "customer_placeholder", "")) or ""
        if placeholder.strip() and customer:
            raise serializers.ValidationError({
                "customer_placeholder": "Non puoi indicare sia un cliente collegato che un testo libero: scegli uno dei due.",
            })

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
    può essere caricato dopo (o in aggiunta) tramite POST multipart su
    `documents` (Punto 9: multi-PDF per tipo, un upload = una nuova riga, mai
    una sostituzione). Download e cancellazione del singolo PDF passano da
    `documents/{doc_id}` (GET per scaricare, DELETE per rimuovere).
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
        "customer_placeholder",
    ]
    ordering_fields  = [
        "offer_date", "created_at", "updated_at", "amount",
        "client_name", "kind", "amount_mode", "status", "deleted_at",
        # Punto 8 (fix): mancavano queste colonne, cliccare il loro header
        # nel datagrid non ordinava (ricadeva silenziosamente sul default).
        "description", "purchase_order", "costs_incurred",
        # "is_invoiced"/"customer_name" non sono campi DB reali (property e
        # SerializerMethodField): il frontend li traduce nei campi veri
        # sottostanti prima di inviare il parametro `ordering` (vedi
        # PurchaseOrders.tsx, orderingMap passato a buildDrfListParams).
        "invoice_number", "customer__display_name",
    ]
    ordering = ["-offer_date"]

    def get_queryset(self):
        qs = PurchaseOrderEntry.objects.select_related("customer", "created_by", "updated_by").prefetch_related(
            "documents", "documents__uploaded_by",
        )
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

        `?kind=` (opzionale, ordinario/extra) filtra i KPI per tipo di PO,
        in coerenza col filtro di tipo del datagrid — se assente/valore non
        valido i KPI restano calcolati su tutti i tipi.
        """
        base_qs = PurchaseOrderEntry.objects.filter(deleted_at__isnull=True)

        kind_param = request.query_params.get("kind")
        if kind_param in PurchaseOrderType.values:
            base_qs = base_qs.filter(kind=kind_param)

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

        Body multipart opzionale: `document` (PDF) viene aggiunto come nuovo
        PurchaseOrderDocument del kind corrispondente allo stato di
        destinazione (Punto 9: non sovrascrive documenti già caricati).
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
            PurchaseOrderDocument.objects.create(
                entry=obj,
                kind=STATUS_DOCUMENT_KIND[new_status],
                file=uploaded,
                original_filename=uploaded.name,
                uploaded_by=request.user,
            )

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

    # ── Documenti PDF (Punto 9: multi-PDF per tipo) ───────────────────────────

    @action(detail=True, methods=["get", "post"], url_path="documents")
    def documents(self, request, pk=None):
        """GET: lista documenti dell'entry. POST (multipart): carica un nuovo
        PDF — `kind` (offer/po/invoice) + `file`. Si aggiunge alla lista,
        non sostituisce eventuali documenti dello stesso kind già presenti.
        """
        obj = self.get_object()

        if request.method == "GET":
            qs = obj.documents.select_related("uploaded_by")
            return Response(PurchaseOrderDocumentSerializer(qs, many=True, context={"request": request}).data)

        if not self._has_change_perm(request):
            return Response({"detail": "Permesso negato."}, status=status.HTTP_403_FORBIDDEN)

        kind = (request.data.get("kind") or "").strip()
        if kind not in PurchaseOrderDocumentKind.values:
            return Response({"kind": "Tipo documento non valido."}, status=status.HTTP_400_BAD_REQUEST)

        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"file": "Nessun file caricato."}, status=status.HTTP_400_BAD_REQUEST)
        uploaded = _validate_document(uploaded)

        doc = PurchaseOrderDocument.objects.create(
            entry=obj, kind=kind, file=uploaded,
            original_filename=uploaded.name, uploaded_by=request.user,
        )
        log_event(
            actor=request.user, action="update", instance=obj,
            changes={"document_added": {"from": None, "to": f"{kind}: {uploaded.name}"}},
            request=request,
        )
        return Response(
            PurchaseOrderDocumentSerializer(doc, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get", "delete"], url_path=r"documents/(?P<doc_pk>\d+)")
    def document_detail(self, request, pk=None, doc_pk=None):
        """GET: scarica il PDF (inline). DELETE: rimuove il singolo documento."""
        obj = self.get_object()
        try:
            doc = obj.documents.get(pk=doc_pk)
        except PurchaseOrderDocument.DoesNotExist:
            return Response({"detail": "Documento non trovato."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "GET":
            filename = doc.original_filename or (doc.file.name.rsplit("/", 1)[-1] if doc.file else None)
            return protected_media_response(file_field=doc.file, disposition="inline", filename=filename)

        if not self._has_change_perm(request):
            return Response({"detail": "Permesso negato."}, status=status.HTTP_403_FORBIDDEN)

        filename = doc.original_filename or doc.file.name
        kind = doc.kind
        doc.delete()
        log_event(
            actor=request.user, action="update", instance=obj,
            changes={"document_removed": {"from": f"{kind}: {filename}", "to": None}},
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
