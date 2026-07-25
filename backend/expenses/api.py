"""expenses/api.py — API Rimborso Spese.

Perimetro permessi (deciso in chat, ricalca attendance/api.py Piano Ferie):
  • Ogni utente autenticato gestisce SOLO le proprie note spese, e solo
    mentre sono in stato `bozza` o `rifiutata` (dopo l'invio non è più
    modificabile finché la Segreteria non la rifiuta).
  • Segreteria rimborsi spese (`profile.is_expense_secretary` o
    superuser): vede tutte le note, può validarle o rifiutarle (con
    motivo). Non modifica il contenuto delle note altrui.
  • Nessun vero PDF binding: niente firme digitali, il PDF esportato ha
    solo lo spazio per la firma a mano (vedi pdf_export.py).
"""
from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.db.models import Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response

from audit.utils import log_event, to_change_value_for_field
from core.media import build_action_url, protected_media_response
from core.mixins import SoftDeleteAuditMixin
from core.uploads import validate_upload

from .models import (
    EXPENSE_CATEGORY_ORDER,
    ExpenseCategory,
    ExpenseItem,
    ExpenseKmTrip,
    ExpenseReceipt,
    ExpenseReport,
    ExpenseReportStatus,
    TechnicianKmRate,
)

User = get_user_model()

EDITABLE_STATUSES = (ExpenseReportStatus.BOZZA, ExpenseReportStatus.RIFIUTATA)


# ─── Helpers permessi ─────────────────────────────────────────────────────────

def _profile(user):
    return getattr(user, "profile", None)


def is_expense_secretary(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    prof = _profile(user)
    return bool(prof and getattr(prof, "is_expense_secretary", False))


def _user_name(u) -> str:
    if u is None:
        return ""
    return f"{u.first_name} {u.last_name}".strip() or u.username


def recompute_km_amount(item: ExpenseItem) -> None:
    """Ricalcola l'importo della voce 'Rimborso chilometraggio' dalle
    trasferte collegate × tariffa €/km del dipendente. Chiamata a ogni
    create/update/delete di una ExpenseKmTrip."""
    if item.category != ExpenseCategory.RIMBORSO_KM:
        return
    total_km = item.km_trips.aggregate(total=Sum("km"))["total"] or 0
    try:
        rate = item.report.user.expense_km_rate.rate_per_km
    except TechnicianKmRate.DoesNotExist:
        rate = Decimal("0")
    item.amount = (Decimal(total_km) * rate).quantize(Decimal("0.01"))
    item.save(update_fields=["amount", "updated_at"])


# ─── TechnicianKmRate ─────────────────────────────────────────────────────────

class TechnicianKmRateSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = TechnicianKmRate
        fields = ["id", "user", "user_name", "rate_per_km", "created_at", "updated_at"]
        read_only_fields = ["id", "user_name", "created_at", "updated_at"]

    def get_user_name(self, obj):
        return _user_name(obj.user)


class TechnicianKmRatePermission(BasePermission):
    """Lettura: chiunque autenticato (vede la propria tariffa nel form).
    Scrittura: solo Segreteria/superuser."""

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return is_expense_secretary(user)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return is_expense_secretary(request.user) or obj.user_id == request.user.id
        return is_expense_secretary(request.user)


class TechnicianKmRateViewSet(viewsets.ModelViewSet):
    serializer_class = TechnicianKmRateSerializer
    permission_classes = [TechnicianKmRatePermission]
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = TechnicianKmRate.objects.filter(deleted_at__isnull=True).select_related("user")
        if not is_expense_secretary(self.request.user):
            qs = qs.filter(user=self.request.user)
        return qs.order_by("user__username")

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)


# ─── ExpenseKmTrip ────────────────────────────────────────────────────────────

class ExpenseKmTripSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseKmTrip
        fields = ["id", "item", "date", "destination", "km", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        item = attrs.get("item", getattr(self.instance, "item", None))
        if item is None:
            raise serializers.ValidationError({"item": "Campo obbligatorio."})
        if item.category != ExpenseCategory.RIMBORSO_KM:
            raise serializers.ValidationError(
                "Le trasferte sono ammesse solo sulla voce 'Rimborso chilometraggio'."
            )
        if not is_expense_secretary(actor) and item.report.user_id != actor.id:
            raise serializers.ValidationError("Puoi gestire solo le trasferte delle tue note spese.")
        if item.report.status not in EDITABLE_STATUSES:
            raise serializers.ValidationError("La nota spese non è più modificabile nello stato attuale.")
        return attrs


class ExpenseKmTripViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseKmTripSerializer
    pagination_class = None
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["item"]

    def get_queryset(self):
        qs = ExpenseKmTrip.objects.select_related("item__report")
        if not is_expense_secretary(self.request.user):
            qs = qs.filter(item__report__user=self.request.user)
        return qs.order_by("date", "id")

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        recompute_km_amount(instance.item)
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        recompute_km_amount(instance.item)
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)

    def perform_destroy(self, instance):
        item = instance.item
        instance.delete()
        recompute_km_amount(item)
        log_event(actor=self.request.user, action="delete", instance=None, request=self.request,
                  subject=f"delete ExpenseKmTrip #{instance.pk}")


# ─── ExpenseReceipt ───────────────────────────────────────────────────────────

RECEIPT_MAX_BYTES = 15 * 1024 * 1024  # 15 MB
RECEIPT_ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf", "heic"]
RECEIPT_ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/heic", "application/pdf"]


class ExpenseReceiptSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = ExpenseReceipt
        fields = [
            "id", "item", "file", "file_url", "file_name",
            "ocr_amount", "ocr_date", "created_at",
        ]
        read_only_fields = ["id", "file_url", "file_name", "ocr_amount", "ocr_date", "created_at"]
        extra_kwargs = {"file": {"write_only": True}}

    def get_file_url(self, obj):
        if not obj.file:
            return None
        return build_action_url(
            request=self.context.get("request"),
            relative_path=f"/api/expense-receipts/{obj.pk}/file/",
        )

    def get_file_name(self, obj):
        if not obj.file:
            return None
        return obj.file.name.rsplit("/", 1)[-1]

    def validate_file(self, value):
        return validate_upload(
            value,
            label="scontrino",
            max_bytes=RECEIPT_MAX_BYTES,
            allowed_extensions=RECEIPT_ALLOWED_EXTENSIONS,
            allowed_content_types=RECEIPT_ALLOWED_CONTENT_TYPES,
        )

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        item = attrs.get("item", getattr(self.instance, "item", None))
        if item is None:
            raise serializers.ValidationError({"item": "Campo obbligatorio."})
        if not is_expense_secretary(actor) and item.report.user_id != actor.id:
            raise serializers.ValidationError("Puoi allegare scontrini solo alle tue note spese.")
        if item.report.status not in EDITABLE_STATUSES:
            raise serializers.ValidationError("La nota spese non è più modificabile nello stato attuale.")
        return attrs


class ExpenseReceiptViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseReceiptSerializer
    pagination_class = None
    http_method_names = ["get", "post", "delete", "head", "options"]
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["item"]

    def get_queryset(self):
        qs = ExpenseReceipt.objects.select_related("item__report")
        if not is_expense_secretary(self.request.user):
            qs = qs.filter(item__report__user=self.request.user)
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        log_event(actor=self.request.user, action="create", instance=instance, request=self.request)

    def perform_destroy(self, instance):
        instance.delete()
        log_event(actor=self.request.user, action="delete", instance=None, request=self.request,
                  subject=f"delete ExpenseReceipt #{instance.pk}")

    @action(detail=True, methods=["get"], url_path="file")
    def file(self, request, pk=None):
        """Serve il file dello scontrino dietro autenticazione (stesso
        pattern di servicenow-cases/{id}/screenshot/)."""
        receipt = self.get_object()
        filename = receipt.file.name.rsplit("/", 1)[-1] or "scontrino"
        return protected_media_response(file_field=receipt.file, disposition="inline", filename=filename)

    @action(
        detail=False, methods=["post"], url_path="extract",
        parser_classes=[MultiPartParser, FormParser],
    )
    def extract(self, request):
        """OCR dello scontrino: NON salva nulla, restituisce solo un
        suggerimento importo/data che l'utente conferma o corregge."""
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"detail": "Nessun file caricato (campo 'file' mancante)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = (getattr(upload, "content_type", "") or "").lower()
        if content_type == "application/pdf":
            return Response(
                {"detail": "L'estrazione automatica funziona solo su immagini (jpg/png), non su PDF."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from PIL import Image
        from .ocr import extract_receipt_fields

        try:
            pil_image = Image.open(upload)
            pil_image.load()
        except Exception:
            return Response(
                {"detail": "Il file caricato non è un'immagine valida."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = extract_receipt_fields(pil_image)
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            "amount": result.amount,
            "date": result.date,
            "warnings": result.warnings,
        })


# ─── ExpenseItem ──────────────────────────────────────────────────────────────

class ExpenseItemSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    is_km_category = serializers.SerializerMethodField()
    km_trips = ExpenseKmTripSerializer(many=True, read_only=True)
    receipts = ExpenseReceiptSerializer(many=True, read_only=True)

    class Meta:
        model = ExpenseItem
        fields = [
            "id", "report", "category", "category_label", "is_km_category",
            "date", "description", "amount", "km_trips", "receipts",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "report", "category", "category_label", "is_km_category",
            "km_trips", "receipts", "created_at", "updated_at",
        ]

    def get_is_km_category(self, obj):
        return obj.category == ExpenseCategory.RIMBORSO_KM

    def validate(self, attrs):
        instance = self.instance
        if instance is None:
            raise serializers.ValidationError(
                "Le voci della nota spese vengono create automaticamente: non è possibile aggiungerne di nuove."
            )
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        if is_expense_secretary(actor) and instance.report.user_id != actor.id:
            raise serializers.ValidationError(
                "La Segreteria non modifica il contenuto delle note spese, solo valida/rifiuta."
            )
        if instance.report.user_id != actor.id:
            raise serializers.ValidationError("Puoi modificare solo le voci delle tue note spese.")
        if instance.report.status not in EDITABLE_STATUSES:
            raise serializers.ValidationError("La nota spese non è più modificabile nello stato attuale.")
        if instance.category == ExpenseCategory.RIMBORSO_KM:
            # Calcolato automaticamente dalle trasferte: ignora un eventuale importo manuale.
            attrs.pop("amount", None)
        return attrs


class ExpenseItemViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseItemSerializer
    pagination_class = None
    http_method_names = ["get", "patch", "head", "options"]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["report", "category"]

    def get_queryset(self):
        qs = (
            ExpenseItem.objects
            .select_related("report")
            .prefetch_related("km_trips", "receipts")
        )
        if not is_expense_secretary(self.request.user):
            qs = qs.filter(report__user=self.request.user)
        return qs.order_by("report", "id")

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_event(actor=self.request.user, action="update", instance=instance, request=self.request)


# ─── ExpenseReport ────────────────────────────────────────────────────────────

class ExpenseReportSerializer(serializers.ModelSerializer):
    user_name          = serializers.SerializerMethodField()
    number             = serializers.CharField(read_only=True)
    month_label        = serializers.CharField(read_only=True)
    total_expenses     = serializers.SerializerMethodField()
    total_due          = serializers.SerializerMethodField()
    status_label       = serializers.CharField(source="get_status_display", read_only=True)
    validated_by_name  = serializers.SerializerMethodField()
    items              = ExpenseItemSerializer(many=True, read_only=True)

    class Meta:
        model = ExpenseReport
        fields = [
            "id", "user", "user_name", "year", "month", "number", "month_label",
            "advances_total", "note", "status", "status_label", "rejection_reason",
            "validated_by", "validated_by_name", "validated_at",
            "total_expenses", "total_due", "items",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "user", "user_name", "number", "month_label", "status", "status_label",
            "rejection_reason", "validated_by", "validated_by_name", "validated_at",
            "total_expenses", "total_due", "items", "created_at", "updated_at",
        ]

    def get_user_name(self, obj):
        return _user_name(obj.user)

    def get_validated_by_name(self, obj):
        return _user_name(obj.validated_by) if obj.validated_by_id else None

    def get_total_expenses(self, obj):
        return str(obj.total_expenses)

    def get_total_due(self, obj):
        return str(obj.total_due)

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None)

        if self.instance is not None and self.instance.status not in EDITABLE_STATUSES:
            raise serializers.ValidationError("La nota spese non è più modificabile nello stato attuale.")

        year = attrs.get("year", getattr(self.instance, "year", None))
        month = attrs.get("month", getattr(self.instance, "month", None))
        if year and month:
            qs = ExpenseReport.objects.filter(
                user=actor, year=year, month=month, deleted_at__isnull=True,
            )
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    f"Esiste già una nota spese per {month:02d}/{year} per questo utente."
                )
        return attrs


class ExpenseReportPermission(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if is_expense_secretary(user):
            return True
        if obj.user_id != user.id:
            return False
        if request.method in SAFE_METHODS:
            return True
        return obj.status in EDITABLE_STATUSES


class ExpenseReportViewSet(SoftDeleteAuditMixin, viewsets.ModelViewSet):
    """CRUD nota spese. Creazione: genera automaticamente le 12 voci fisse
    (una per categoria). Le transizioni di stato passano dalle action
    dedicate (submit/validate/reject), non da PATCH diretto su `status`."""

    serializer_class = ExpenseReportSerializer
    permission_classes = [ExpenseReportPermission]
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "year", "month"]

    @action(detail=False, methods=["get"], url_path="meta")
    def meta(self, request):
        """Info di contesto per il frontend: ruolo Segreteria e tariffa
        km dell'utente corrente (per mostrare/nascondere le azioni giuste
        senza dover dedurle dalla lista dei report)."""
        try:
            rate = str(request.user.expense_km_rate.rate_per_km)
        except TechnicianKmRate.DoesNotExist:
            rate = None
        return Response({
            "is_secretary": is_expense_secretary(request.user),
            "user_id": request.user.id,
            "km_rate": rate,
        })

    def get_queryset(self):
        qs = (
            ExpenseReport.objects
            .filter(deleted_at__isnull=True)
            .select_related("user", "user__profile", "validated_by")
            .prefetch_related("items", "items__km_trips", "items__receipts")
        )
        if not is_expense_secretary(self.request.user):
            qs = qs.filter(user=self.request.user)
        else:
            user_param = self.request.query_params.get("user")
            if user_param:
                qs = qs.filter(user_id=user_param)
        return qs

    def perform_create(self, serializer):
        try:
            instance = serializer.save(
                user=self.request.user,
                created_by=self.request.user,
                updated_by=self.request.user,
            )
        except IntegrityError:
            raise serializers.ValidationError("Esiste già una nota spese per questo mese.")

        ExpenseItem.objects.bulk_create([
            ExpenseItem(
                report=instance, category=cat,
                created_by=self.request.user, updated_by=self.request.user,
            )
            for cat in EXPENSE_CATEGORY_ORDER
        ])

        changes = {
            k: {"from": None, "to": to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
        }
        log_event(actor=self.request.user, action="create", instance=instance,
                  changes=changes, request=self.request)

    # ── Transizioni di stato ──────────────────────────────────────────────

    def _save_status(self, obj, **fields):
        obj.updated_by = self.request.user
        for k, v in fields.items():
            setattr(obj, k, v)
        obj.save(update_fields=list(fields.keys()) + ["updated_by", "updated_at"])

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        obj = self.get_object()
        if obj.user_id != request.user.id:
            return Response({"detail": "Solo il dipendente proprietario può inviare la nota spese."}, status=403)
        if obj.status not in EDITABLE_STATUSES:
            return Response({"detail": "La nota spese è già stata inviata."}, status=409)
        if not obj.items.exclude(amount=0).exists() and obj.advances_total == 0:
            return Response({"detail": "Compila almeno una voce di spesa prima di inviare."}, status=400)
        self._save_status(
            obj, status=ExpenseReportStatus.INVIATA,
            rejection_reason="", validated_by=None, validated_at=None,
        )
        log_event(actor=request.user, action="update", instance=obj,
                  changes={"status": {"from": "bozza/rifiutata", "to": "inviata"}}, request=request)
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"], url_path="validate")
    def validate_report(self, request, pk=None):
        obj = self.get_object()
        if not is_expense_secretary(request.user):
            return Response({"detail": "Permesso negato."}, status=403)
        if obj.status != ExpenseReportStatus.INVIATA:
            return Response({"detail": "Solo le note inviate possono essere validate."}, status=409)
        self._save_status(
            obj, status=ExpenseReportStatus.VALIDATA,
            validated_by=request.user, validated_at=timezone.now(),
        )
        log_event(actor=request.user, action="update", instance=obj,
                  changes={"status": {"from": "inviata", "to": "validata"}}, request=request)
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject_report(self, request, pk=None):
        obj = self.get_object()
        if not is_expense_secretary(request.user):
            return Response({"detail": "Permesso negato."}, status=403)
        if obj.status != ExpenseReportStatus.INVIATA:
            return Response({"detail": "Solo le note inviate possono essere rifiutate."}, status=409)
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response({"detail": "Il motivo del rifiuto è obbligatorio."}, status=400)
        self._save_status(
            obj, status=ExpenseReportStatus.RIFIUTATA, rejection_reason=reason,
            validated_by=request.user, validated_at=timezone.now(),
        )
        log_event(actor=request.user, action="update", instance=obj,
                  changes={"status": {"from": "inviata", "to": "rifiutata"}, "rejection_reason": {"from": None, "to": reason}},
                  request=request)
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        from .pdf_export import build_expense_report_pdf
        obj = self.get_object()
        return build_expense_report_pdf(obj)
