"""contracts/api.py — API del modulo Contratti (`/api/contracts/`, `/api/sellers/`).

Entrambi i ViewSet sono riservati agli utenti interni: lettura con
`view_<model>`, Portal sempre escluso (`IsInternalOrPortalDedicatedApp`,
`contracts` non è tra le app Portal-dedicate). Il valore economico
(`total_value`) è visibile/scrivibile solo con `contracts.view_contract_value`.
"""
from __future__ import annotations

from datetime import timedelta

from django.db.models import Count, DateField, ExpressionWrapper, F, Prefetch, Q, Sum, Value
from django.utils import timezone
from django_filters import rest_framework as filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from audit.utils import log_event
from core.media import build_action_url, protected_media_response
from core.mixins import PurgeActionMixin, RestoreActionMixin, SoftDeleteAuditMixin
from core.soft_delete import apply_soft_delete_filters
from core.uploads import validate_upload
from device.models import Device
from portal.permissions import IsInternalOrPortalDedicatedApp, PortalModelPermissions

from .models import REMINDER_DAYS_MAX, REMINDER_DAYS_MIN, Contract, ContractStatus, Seller

DOCUMENT_MAX_BYTES = 15 * 1024 * 1024  # 15 MB
DOCUMENT_ALLOWED_EXTENSIONS = ["pdf"]
DOCUMENT_ALLOWED_CONTENT_TYPES = ["application/pdf"]

VALUE_PERM = "contracts.view_contract_value"


def _validate_document(value):
    return validate_upload(
        value,
        label="documento",
        max_bytes=DOCUMENT_MAX_BYTES,
        allowed_extensions=DOCUMENT_ALLOWED_EXTENSIONS,
        allowed_content_types=DOCUMENT_ALLOWED_CONTENT_TYPES,
        strict_real_mime=True,
    )


class _InternalOnlyMixin:
    """Garantisce la barriera Portal/Archie anche sulle action che dichiarano
    proprie `permission_classes` (restore/purge dei mixin core), che
    altrimenti sostituirebbero quelle del ViewSet."""

    def get_permissions(self):
        perms = super().get_permissions()
        if not any(isinstance(p, IsInternalOrPortalDedicatedApp) for p in perms):
            perms.append(IsInternalOrPortalDedicatedApp())
        return perms


class ContractDocumentPermissions(PortalModelPermissions):
    """Azione `document`: lettura con view_contract, upload/rimozione del PDF
    sono una modifica del contratto (change_contract), non add/delete.
    In più serve sempre il permesso sul valore economico: il PDF firmato
    riporta di norma il prezzo del contratto."""

    perms_map = {
        **PortalModelPermissions.perms_map,
        "POST":   ["%(app_label)s.change_%(model_name)s"],
        "DELETE": ["%(app_label)s.change_%(model_name)s"],
    }

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.has_perm(VALUE_PERM)


# ─── Seller ──────────────────────────────────────────────────────────────────

class SellerSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True, default=None)
    # L'email che riceverà i promemoria di rinnovo (utente Archie o inserita a mano).
    reminder_email = serializers.SerializerMethodField()

    class Meta:
        model = Seller
        fields = [
            "id", "name", "email", "phone", "user", "user_username", "reminder_email", "is_active",
            "created_at", "updated_at", "deleted_at",
        ]
        read_only_fields = ["id", "user_username", "reminder_email", "created_at", "updated_at", "deleted_at"]

    def get_reminder_email(self, obj):
        if obj.user_id and obj.user.is_active and obj.user.email:
            return obj.user.email.strip().lower()
        return (obj.email or "").strip().lower() or None

    def validate(self, attrs):
        user = attrs["user"] if "user" in attrs else getattr(self.instance, "user", None)
        email = attrs["email"] if "email" in attrs else getattr(self.instance, "email", "")
        errors = {}
        if user is not None and not (user.is_active and (user.is_superuser or user.has_perm("core.access_archie"))):
            errors["user"] = "Scegli un utente di Archie attivo."
        if user is None and not (email or "").strip():
            errors["email"] = "Indica l'email del venditore o collega un utente di Archie."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class SellerViewSet(_InternalOnlyMixin, RestoreActionMixin, PurgeActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class   = SellerSerializer
    permission_classes = [PortalModelPermissions, IsInternalOrPortalDedicatedApp]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["is_active", "user"]
    search_fields      = ["name", "email"]
    ordering_fields    = ["name", "email", "is_active", "updated_at"]
    ordering           = ["name"]

    def get_queryset(self):
        qs = Seller.objects.select_related("user")
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))


# ─── Contract ────────────────────────────────────────────────────────────────

class ContractSerializer(serializers.ModelSerializer):
    customer_name       = serializers.SerializerMethodField()
    seller_name         = serializers.CharField(source="seller.name", read_only=True, default=None)
    company_label       = serializers.CharField(source="company.label", read_only=True, default=None)
    contract_type_label = serializers.CharField(source="get_contract_type_display", read_only=True)
    billing_freq_label  = serializers.CharField(source="get_billing_freq_display", read_only=True)
    status_label        = serializers.CharField(source="get_status_display", read_only=True)
    reminder_date       = serializers.DateField(read_only=True)
    reminders           = serializers.SerializerMethodField()
    expiry_state        = serializers.SerializerMethodField()
    # Opzionali: un contratto (es. assistenza) può non coprire alcun device.
    devices = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=Device.objects.filter(deleted_at__isnull=True),
    )
    devices_detail    = serializers.SerializerMethodField()
    document_url      = serializers.SerializerMethodField()
    document_filename = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = [
            "id", "code", "title",
            "customer", "customer_name",
            "contract_type", "contract_type_label",
            "seller", "seller_name",
            "company", "company_label",
            "start_date", "end_date", "reminder_days", "reminder_date", "reminders",
            "total_value", "billing_freq", "billing_freq_label",
            "status", "status_label", "expiry_state",
            "devices", "devices_detail",
            "document_url", "document_filename",
            "notes",
            "created_at", "updated_at", "deleted_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "deleted_at"]
        extra_kwargs = {"reminder_days": {"min_value": REMINDER_DAYS_MIN, "max_value": REMINDER_DAYS_MAX}}

    def get_fields(self):
        fields = super().get_fields()
        # Senza il permesso dedicato il valore economico non è né visibile
        # né scrivibile (una PATCH con total_value viene ignorata).
        request = self.context.get("request")
        user = getattr(request, "user", None)
        # Il calendario dei promemoria serve solo alla finestra del contratto.
        view = self.context.get("view")
        if getattr(view, "action", None) != "retrieve":
            fields.pop("reminders", None)
        if not (user and user.has_perm(VALUE_PERM)):
            fields.pop("total_value", None)
            # Anche il PDF (che riporta il prezzo) è riservato a chi vede i valori.
            fields.pop("document_url", None)
            fields.pop("document_filename", None)
        return fields

    def get_customer_name(self, obj):
        return obj.customer.display_name or obj.customer.name

    def get_reminders(self, obj):
        """Destinatari e calendario dei promemoria di rinnovo, con l'esito degli invii.
        Stati: sent, failed, skipped (data passata mai inviata), next, planned."""
        from contracts import reminders
        from core.app_settings import get_setting, office_emails

        every = int(get_setting("contracts.reminder_every_days"))
        to, cc = reminders.recipients(obj, office_emails())
        email = reminders.seller_email(obj)
        seller_kind = None
        if email:
            s = obj.seller
            seller_kind = "user" if (s.user_id and s.user.is_active and s.user.email) else "manual"
        history = {r.due_on: r for r in obj.reminders.all()}
        today = timezone.localdate()
        dates, next_marked = [], False
        for d in reminders.schedule(obj, every):
            r = history.get(d)
            if r is not None:
                state, error = ("sent", None) if r.ok else ("failed", r.error or None)
            elif d < today:
                state, error = "skipped", None
            elif not next_marked:
                state, error, next_marked = "next", None, True
            else:
                state, error = "planned", None
            dates.append({"date": d.isoformat(), "state": state, "error": error})
        return {"every": every, "to": to, "cc": cc, "seller_kind": seller_kind, "dates": dates}

    def get_expiry_state(self, obj):
        return obj.expiry_state_on(timezone.localdate())

    def get_devices_detail(self, obj):
        return [
            {"id": d.id, "label": str(d), "serial_number": d.serial_number}
            for d in obj.devices.all()
        ]

    def get_document_url(self, obj):
        if not obj.document:
            return None
        return build_action_url(
            request=self.context.get("request"),
            relative_path=f"/api/contracts/{obj.pk}/document/",
        )

    def get_document_filename(self, obj):
        if not obj.document:
            return None
        return obj.document_original_filename or obj.document.name.rsplit("/", 1)[-1]

    def validate(self, attrs):
        inst = self.instance
        start = attrs.get("start_date", getattr(inst, "start_date", None))
        end = attrs.get("end_date", getattr(inst, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "La data di fine non può precedere la data di inizio."})

        # I device collegati devono appartenere al cliente del contratto. Su
        # update senza `devices` nel payload si ricontrollano quelli già
        # collegati (es. cambio cliente).
        customer = attrs.get("customer", getattr(inst, "customer", None))
        if "devices" in attrs:
            devices = attrs["devices"]
        elif inst is not None and "customer" in attrs:
            devices = list(inst.devices.filter(deleted_at__isnull=True))
        else:
            devices = []
        customer_id = getattr(customer, "pk", None)
        foreign = [d.pk for d in devices if d.customer_id != customer_id]
        if foreign:
            raise serializers.ValidationError({
                "devices": f"Dispositivi non appartenenti al cliente del contratto: {foreign}.",
            })

        # Società non indicata in creazione → quella del cliente.
        if inst is None and attrs.get("company") is None and customer is not None:
            attrs["company"] = customer.status
        return attrs



def expiry_q(state: str, today) -> Q:
    """Q equivalente a `Contract.expiry_state_on(today) == state` (solo contratti attivi)."""
    # Avviso di rinnovo raggiunto: end_date - reminder_days <= today  ⇔  end_date <= today + reminder_days
    reminder_reached = Q(end_date__lte=ExpressionWrapper(Value(today) + F("reminder_days") * timedelta(days=1), output_field=DateField()))
    active = Q(status=ContractStatus.ATTIVO)
    by_state = {
        "expired": Q(end_date__lt=today),
        "renew": Q(end_date__gte=today) & reminder_reached,
        "ok": Q(end_date__gte=today) & ~reminder_reached,
    }
    return active & by_state[state]


EXPIRY_STATES = ("ok", "renew", "expired")


class ContractFilter(filters.FilterSet):
    customer = filters.NumberFilter(field_name="customer_id")
    seller   = filters.NumberFilter(field_name="seller_id")
    company  = filters.NumberFilter(field_name="company_id")
    # Contratti attivi nell'anno indicato: start_date.year <= y <= end_date.year.
    # Limitato a 1..9999 (range di datetime.date): fuori range → 400, non 500.
    year = filters.NumberFilter(method="filter_year", min_value=1, max_value=9999)
    # Stato di scadenza come Contract.expiry_state_on, tradotto in query:
    # ok | renew | expired.
    expiry = filters.ChoiceFilter(
        method="filter_expiry",
        choices=[(k, k) for k in EXPIRY_STATES],
    )

    class Meta:
        model  = Contract
        fields = ["customer", "seller", "company", "status", "contract_type", "year"]

    def filter_expiry(self, queryset, name, value):
        return queryset.filter(expiry_q(value, timezone.localdate()))

    def filter_year(self, queryset, name, value):
        if value is None:
            return queryset
        y = int(value)
        return queryset.filter(start_date__year__lte=y, end_date__year__gte=y)


class ContractOrderingFilter(OrderingFilter):
    """Senza `contracts.view_contract_value` l'ordinamento per `total_value`
    non è ammesso (rivelerebbe la graduatoria dei valori): viene ignorato
    come qualunque campo non consentito."""

    def get_valid_fields(self, queryset, view, context=None):
        fields = super().get_valid_fields(queryset, view, context or {})
        user = getattr(getattr(view, "request", None), "user", None)
        if not (user and user.has_perm(VALUE_PERM)):
            fields = [f for f in fields if f[0] != "total_value"]
        return fields


class ContractViewSet(_InternalOnlyMixin, RestoreActionMixin, PurgeActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    """ViewSet dei contratti.

    CRUD standard con soft delete/restore/purge dai mixin core. Il PDF del
    contratto (uno solo) passa dall'azione `document`: POST multipart (campo
    `file`) per caricarlo/sostituirlo, GET per scaricarlo inline, DELETE per
    rimuoverlo. Il file è servito solo via API (`protected_media_response`).
    """

    serializer_class   = ContractSerializer
    permission_classes = [PortalModelPermissions, IsInternalOrPortalDedicatedApp]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [DjangoFilterBackend, SearchFilter, ContractOrderingFilter]
    filterset_class    = ContractFilter
    search_fields      = ["code", "title", "customer__name", "customer__display_name", "seller__name"]
    ordering_fields    = [
        "code", "title", "end_date", "start_date", "total_value", "updated_at",
        "customer__display_name", "seller__name", "company__label",
    ]
    ordering = ["end_date"]
    # Il valore economico non deve mai comparire nell'audit (leggibile con il
    # solo audit.view_auditevent, senza contracts.view_contract_value).
    audit_masked_fields = ("total_value",)

    def get_queryset(self):
        qs = Contract.objects.select_related("customer", "seller", "company").prefetch_related(
            # Solo device non eliminati: coerente con il queryset scrivibile
            # del campo `devices` (un round-trip GET→PUT resta valido).
            Prefetch("devices", queryset=Device.objects.filter(deleted_at__isnull=True).select_related("type")),
        )
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    # ── Indicatori della pagina ───────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """Conteggi per stato e per scadenza, prossime scadenze e (con il permesso
        dedicato) il valore dei contratti attivi non scaduti. Accetta gli stessi
        filtri cliente/venditore/società della lista."""
        today = timezone.localdate()
        base = self.get_queryset()
        for key in ("customer", "seller", "company"):
            v = request.query_params.get(key)
            if v and v.isdigit():
                base = base.filter(**{f"{key}_id": int(v)})
        counts = base.aggregate(
            **{f"st_{s}": Count("id", filter=Q(status=s)) for s in ContractStatus.values},
            **{f"ex_{s}": Count("id", filter=expiry_q(s, today)) for s in EXPIRY_STATES},
        )
        upcoming = (
            base.filter(status=ContractStatus.ATTIVO, end_date__gte=today)
            .order_by("end_date", "id")[:6]
        )
        data = {
            "active": counts["st_attivo"],
            "by_status": {s: counts[f"st_{s}"] for s in ContractStatus.values},
            "by_expiry": {s: counts[f"ex_{s}"] for s in EXPIRY_STATES},
            "next_deadlines": [
                {
                    "id": c.id, "code": c.code, "title": c.title,
                    "customer_name": c.customer.display_name or c.customer.name,
                    "end_date": c.end_date.isoformat(), "reminder_date": c.reminder_date.isoformat(),
                    "expiry_state": c.expiry_state_on(today),
                }
                for c in upcoming
            ],
        }
        if request.user.has_perm(VALUE_PERM):
            total = base.filter(status=ContractStatus.ATTIVO, end_date__gte=today).aggregate(v=Sum("total_value"))["v"]
            data["active_value"] = f"{(total or 0):.2f}"
        return Response(data)

    # ── Documento PDF ─────────────────────────────────────────────────────────

    @action(
        detail=True, methods=["get", "post", "delete"], url_path="document",
        permission_classes=[ContractDocumentPermissions, IsInternalOrPortalDedicatedApp],
    )
    def document(self, request, pk=None):
        """GET: scarica il PDF (inline). POST (multipart, campo `file`):
        carica o sostituisce il PDF. DELETE: rimuove il PDF."""
        obj = self.get_object()

        if request.method == "GET":
            filename = obj.document_original_filename or (obj.document.name.rsplit("/", 1)[-1] if obj.document else None)
            return protected_media_response(file_field=obj.document, disposition="inline", filename=filename)

        before = obj.document_original_filename or (obj.document.name if obj.document else None)

        if request.method == "POST":
            uploaded = request.FILES.get("file")
            if not uploaded:
                return Response({"file": "Nessun file caricato."}, status=status.HTTP_400_BAD_REQUEST)
            uploaded = _validate_document(uploaded)
            if obj.document:
                obj.document.delete(save=False)
            obj.document = uploaded
            obj.document_original_filename = uploaded.name
            obj.updated_by = request.user
            obj.save()
            log_event(
                actor=request.user, action="update", instance=obj,
                changes={"document": {"from": before, "to": uploaded.name}},
                request=request,
            )
            return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED)

        # DELETE
        if obj.document:
            obj.document.delete(save=False)
        obj.document = ""
        obj.document_original_filename = ""
        obj.updated_by = request.user
        obj.save()
        log_event(
            actor=request.user, action="update", instance=obj,
            changes={"document": {"from": before, "to": None}},
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
