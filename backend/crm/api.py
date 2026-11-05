import io
import datetime
import re

from django.utils import timezone
from django.http import HttpResponse
from django.db import IntegrityError, transaction
from django.db.models import OuterRef, Subquery, F, Exists, Count, IntegerField, Q, Sum, CharField, DateField
from django.db.models import TextField
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce

import django_filters as filters

from rest_framework import serializers, viewsets, status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework.response import Response

from crm.models import Customer, Site, Contact, CustomerVpnAccess
# Import a livello di modulo: inventory.models e issues.models importano
# crm.models (non crm.api), quindi non si crea alcun ciclo.
from inventory.models import Inventory
from issues.models import IssueStatus
from core.crypto import decrypt
from audit.utils import build_changes, log_event, to_change_value_for_field, to_primitive
from core.soft_delete import apply_soft_delete_filters
from core.integrity import raise_integrity_error_as_validation
from core.permissions import CanPurgeModelPermission, CanRestoreModelPermission
from core.mixins import SoftDeleteAuditMixin, CustomFieldsValidationMixin, RestoreActionMixin, PurgeActionMixin
from core.restore_policy import split_restorable  # usato in ContactViewSet.bulk_restore()
from portal.mixins import PortalScopedMixin, PortalTenantWriteMixin
from portal.permissions import (
    IsPortalUserOrInternal, CrmInventoryModelPermissions,
    _is_portal_user, _is_internal_user,
)
from rest_framework.exceptions import PermissionDenied

# -------------------------
# Customers
# -------------------------


class CustomerFilter(filters.FilterSet):
    """Customer filters used by the list UI.

    Notes:
    - "city" is stored inside custom_fields (JSONField). We filter by casting the JSON to text.
      This is intentionally pragmatic (works even if the key name varies), and is good enough for
      an interactive UI filter.
    """

    city = filters.CharFilter(method="filter_city")
    # province è ora una colonna reale (crm/migrations/0010_customer_province.py):
    # filtro diretto, niente hack JSON come per city.
    province = filters.CharFilter(field_name="province", lookup_expr="icontains")
    # Filtri sulle annotazioni di CustomerViewSet.get_queryset (has_vpn,
    # primary_contact_id): il filterset gira dopo get_queryset, quindi le
    # annotazioni sono gia' presenti.
    has_vpn = filters.BooleanFilter(field_name="has_vpn")
    has_contact = filters.BooleanFilter(method="filter_has_contact")

    # Ricerca per singola colonna (riga di ricerca del restyle) e viste.
    code_q = filters.CharFilter(field_name="code", lookup_expr="icontains")
    name_q = filters.CharFilter(method="filter_name_q")
    city_q = filters.CharFilter(method="filter_city_q")
    contact_q = filters.CharFilter(method="filter_contact_q")
    vat_q = filters.CharFilter(field_name="vat_number", lookup_expr="icontains")
    has_open_issues = filters.BooleanFilter(method="filter_has_open_issues")
    contract_expiring = filters.BooleanFilter(method="filter_contract_expiring")
    incomplete = filters.BooleanFilter(method="filter_incomplete")

    class Meta:
        model = Customer
        fields = ["status", "city", "province", "has_vpn", "has_contact"]

    def filter_name_q(self, queryset, name, value):
        v = (value or "").strip()
        return queryset.filter(Q(name__icontains=v) | Q(display_name__icontains=v)) if v else queryset

    def filter_city_q(self, queryset, name, value):
        v = (value or "").strip()
        return queryset.filter(Q(city__icontains=v) | Q(province__icontains=v)) if v else queryset

    def filter_contact_q(self, queryset, name, value):
        v = (value or "").strip()
        return queryset.filter(Q(primary_contact_name__icontains=v) | Q(primary_contact_phone__icontains=v) | Q(primary_contact_email__icontains=v)) if v else queryset

    def filter_has_open_issues(self, queryset, name, value):
        if value is None:
            return queryset
        return queryset.filter(open_issues_count__gt=0) if value else queryset.filter(open_issues_count=0)

    def filter_contract_expiring(self, queryset, name, value):
        if value is None:
            return queryset
        limit = timezone.localdate() + datetime.timedelta(days=CONTRACT_EXPIRING_DAYS)
        cond = Q(next_contract_end__isnull=False, next_contract_end__lte=limit)
        return queryset.filter(cond) if value else queryset.exclude(cond)

    def filter_incomplete(self, queryset, name, value):
        if value is None:
            return queryset
        cond = Q(primary_contact_id__isnull=True) | Q(vat_number__isnull=True) | Q(vat_number="")
        return queryset.filter(cond) if value else queryset.exclude(cond)

    def filter_has_contact(self, queryset, name, value):
        if value is None:
            return queryset
        return queryset.filter(primary_contact_id__isnull=not value)

    def filter_city(self, queryset, name, value):
        v = (value or "").strip()
        if not v:
            return queryset
        # Usa KeyTextTransform sulle stesse chiavi annotate nel queryset
        # per evitare falsi positivi (Cast serializza l'intera colonna JSON)
        # e per permettere l'uso di indici GIN sul JSONField.
        from django.db.models import Q
        from django.db.models.fields.json import KeyTextTransform
        return queryset.filter(
            Q(city__icontains=v)  # usa l'annotazione già presente nel queryset
        )

# Finestra di "contratto in scadenza" per la vista e l'indicatore della pagina Clienti.
CONTRACT_EXPIRING_DAYS = 60


def _count_subquery(related_qs, *, distinct=False, group_field="customer_id"):
    """Conta le righe di `related_qs` per la entita' corrente, come subquery.

    Raggruppa per `group_field` (default "customer_id") e prende il singolo
    valore aggregato. Coalesce a 0 perche' un'entita' senza righe correlate
    produce NULL, non 0, e il frontend si aspetta un numero.

    `distinct=True` va usato quando `related_qs` contiene un filtro su una
    relazione che moltiplica le righe (es. inventory filtrati per issue: un
    inventory con 2 issue produce 2 righe dopo il join). Senza, Count conterebbe
    le righe post-join (le issue), non le entita' distinte (gli inventory).
    """
    aggregated = (
        related_qs
        .order_by()                       # azzera l'ordinamento di default: romperebbe il GROUP BY
        .values(group_field)
        .annotate(c=Count("pk", distinct=distinct))
        .values("c")[:1]
    )
    return Coalesce(Subquery(aggregated, output_field=IntegerField()), 0)


class CustomerSerializer(CustomFieldsValidationMixin, serializers.ModelSerializer):
    custom_fields_entity = "customer"
    status_key = serializers.CharField(source="status.key", read_only=True)
    status_label = serializers.CharField(source="status.label", read_only=True)

    # Convenience/computed fields for list UI.
    # `city` legge dall'annotazione Coalesce del queryset (unica fonte di verità).
    # Su retrieve (queryset non annotato) usa _city_from_custom_fields() come fallback
    # per non esporre None quando il dato è presente nei custom_fields.
    city = serializers.SerializerMethodField()
    primary_contact_id = serializers.IntegerField(read_only=True)
    primary_contact_name = serializers.CharField(read_only=True)
    primary_contact_email = serializers.CharField(read_only=True)
    primary_contact_phone = serializers.CharField(read_only=True)
    has_vpn = serializers.BooleanField(read_only=True, default=False)

    # Contatori annotati nel queryset (vedi _count_subquery). Su retrieve il
    # queryset e' comunque annotato, ma default=0 evita un 500 se in futuro un
    # percorso non annotato usasse questo serializer.
    assets_count = serializers.IntegerField(read_only=True, default=0)
    sites_count = serializers.IntegerField(read_only=True, default=0)
    # Numero di siti che hanno almeno un asset collegato (Site Repository nasconde
    # i siti "vuoti", quindi il badge "siti" deve contare solo questi, non il
    # totale sites_count).
    sites_with_assets_count = serializers.IntegerField(read_only=True, default=0)
    active_issue_count = serializers.IntegerField(read_only=True, default=0)
    # Numero di contatti collegati al cliente (0.9.0: mostra il bottone
    # "Contatti" nel Site Repository solo quando ce n'e' più di uno, dato
    # che il primo è già esposto via primary_contact_*).
    contacts_count = serializers.IntegerField(read_only=True, default=0)
    # Restyle pagina Clienti: issue attive del cliente (numero di issue, non di
    # inventari), contratti attivi e prossima scadenza.
    open_issues_count = serializers.IntegerField(read_only=True, default=0)
    active_contracts_count = serializers.IntegerField(read_only=True, default=0)
    next_contract_end = serializers.DateField(read_only=True, default=None)
    next_contract_title = serializers.CharField(read_only=True, default=None)

    # Chiavi riconosciute per "città" nei custom_fields (allineate con la Coalesce nel queryset).
    _CITY_KEYS = frozenset({"city", "citta", "città", "Città", "Citta"})

    def get_city(self, obj) -> str | None:
        """Restituisce la città dall'annotazione del queryset, con fallback sui custom_fields.

        La Coalesce nel queryset (`get_queryset`) è la fonte di verità unica per list,
        ordering e filtering. Questo metodo la legge direttamente quando disponibile,
        evitando qualsiasi logica duplicata.
        """
        # Percorso veloce: annotazione già presente (list, queryset annotato)
        annotated = getattr(obj, "city", None)
        if annotated is not None:
            return str(annotated).strip() or None

        # Fallback per retrieve / queryset non annotato: legge dai custom_fields
        # con le stesse chiavi usate dalla Coalesce, senza normalizzazione complessa
        # (non necessaria: le chiavi sono già in una lista esplicita).
        cf = getattr(obj, "custom_fields", None)
        if not isinstance(cf, dict):
            return None
        for key in self._CITY_KEYS:
            val = cf.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
        return None

    class Meta:
        model = Customer
        fields = [
            "id",
            "code",
            "name",
            "display_name",
            "city",
            "province",
            "primary_contact_id",
            "primary_contact_name",
            "primary_contact_email",
            "primary_contact_phone",
            "vat_number",
            "tax_code",
            "status",
            "status_key",
            "status_label",
            "notes",
            "has_vpn",
            "assets_count",
            "sites_count",
            "sites_with_assets_count",
            "active_issue_count",
            "contacts_count",
            "open_issues_count",
            "active_contracts_count",
            "next_contract_end",
            "next_contract_title",
            "tags",
            "custom_fields",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class CustomerViewSet(PortalScopedMixin, PurgeActionMixin, RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    # Fix P0 6.6: un utente Portal "puro" ora deve avere anche il
    # permesso Django esplicito (view/add/change/delete_customer), non solo
    # essere autenticato. Gli utenti interni mantengono il comportamento
    # storico (CrmInventoryModelPermissions distingue i due casi).
    permission_classes = [IsPortalUserOrInternal, CrmInventoryModelPermissions]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_class = CustomerFilter
    # La ricerca attraversa anche asset e siti del cliente: il Site Repository
    # cerca "un cliente che possiede questo hostname / IP / seriale / sito", e
    # prima lo faceva costruendo un indice di stringhe in memoria su liste
    # troncate dalla paginazione (quindi trovando solo una parte dei record).
    # DRF applica automaticamente distinct() sui lookup relazionali; i contatori
    # sono comunque calcolati via subquery, quindi restano corretti.
    search_fields = [
        "code",
        "name",
        "display_name",
        "vat_number",
        "tax_code",
        "province",
        "inventories__hostname",
        "inventories__name",
        "inventories__serial_number",
        "inventories__knumber",
        "inventories__local_ip",
        "inventories__srsa_ip",
        "sites__name",
        "sites__display_name",
        "sites__city",
        "sites__address_line1",
    ]
    ordering_fields = [
        "id",
        "code",
        "name",
        "display_name",
        "city",
        "province",
        "status_label",
        "status__label",
        "primary_contact_name",
        "primary_contact_email",
        "primary_contact_phone",
        "vat_number",
        "tax_code",
        "sites_count",
        "assets_count",
        "open_issues_count",
        "next_contract_end",
        "updated_at",
        "created_at",
        "deleted_at",
    ]
    ordering = ["name"]
    purge_permission = "crm.delete_customer"

    def _block_portal_write(self, request):
        """Fix P0 6.2: Customer rappresenta il tenant stesso, quindi non ha un
        campo `customer` su cui applicare PortalTenantWriteMixin. Un utente
        Portal (non interno) non deve poter creare/eliminare
        clienti, nemmeno il proprio, indipendentemente dai permessi Django
        che un gruppo gli assegni per errore sul modulo CRM."""
        user = getattr(request, "user", None)
        if _is_portal_user(user) and not _is_internal_user(user):
            raise PermissionDenied("Gli utenti del Portal non possono creare o eliminare clienti.")

    def create(self, request, *args, **kwargs):
        """Convert DB integrity errors into 400 ValidationError."""
        self._block_portal_write(request)
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError as e:
            raise_integrity_error_as_validation(
                e,
                constraint_map={
                    "ux_customers_code_active": {"code": "Codice cliente già presente su un cliente attivo."},
                    "ux_customers_vat_active": {"vat_number": "Partita IVA già presente su un cliente attivo."},
                    "ux_customers_tax_active": {"tax_code": "Codice fiscale già presente su un cliente attivo."},
                },
            )

    def update(self, request, *args, **kwargs):
        """Convert DB integrity errors into 400 ValidationError."""
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError as e:
            raise_integrity_error_as_validation(
                e,
                constraint_map={
                    "ux_customers_code_active": {"code": "Codice cliente già presente su un cliente attivo."},
                    "ux_customers_vat_active": {"vat_number": "Partita IVA già presente su un cliente attivo."},
                    "ux_customers_tax_active": {"tax_code": "Codice fiscale già presente su un cliente attivo."},
                },
            )

    def perform_destroy(self, instance):
        self._block_portal_write(self.request)
        super().perform_destroy(instance)

    def get_queryset(self):
        qs = Customer.objects.select_related("status")

        # Annotate city for ordering/filtering (best-effort: supports common keys)
        qs = qs.annotate(
            status_label=F("status__label"),
            city=Coalesce(
                KeyTextTransform("city", "custom_fields"),
                KeyTextTransform("citta", "custom_fields"),
                KeyTextTransform("Città", "custom_fields"),
                KeyTextTransform("Citta", "custom_fields"),
            )
        )

        # Primary contact for the customer with "site" empty (NULL)
        primary_qs = Contact.objects.filter(
            customer_id=OuterRef("pk"),
            site__isnull=True,
            is_primary=True,
            deleted_at__isnull=True,
        ).order_by("-updated_at", "id")

        qs = qs.annotate(
            primary_contact_id=Subquery(primary_qs.values("id")[:1]),
            primary_contact_name=Subquery(primary_qs.values("name")[:1]),
            primary_contact_email=Subquery(primary_qs.values("email")[:1]),
            primary_contact_phone=Subquery(primary_qs.values("phone")[:1]),
            has_vpn=Exists(
                CustomerVpnAccess.objects.filter(customer_id=OuterRef("pk"))
            ),
        )

        # ── Contatori per la card cliente (Site Repository) ───────────────────
        # Prima venivano calcolati nel frontend scaricando TUTTI gli inventory e
        # TUTTI i siti in memoria e contandoli lato client: numeri sbagliati non
        # appena la lista veniva paginata.
        #
        # Si usano Subquery e non Count(...) con join: annotare piu' Count su
        # relazioni diverse nella stessa query produce un prodotto cartesiano fra
        # i join (inventories x sites), gonfiando i conteggi. Le subquery sono
        # indipendenti fra loro e immuni al problema, e restano corrette anche
        # quando SearchFilter applica distinct() per i lookup relazionali.
        qs = qs.annotate(
            assets_count=_count_subquery(
                Inventory.objects.filter(
                    customer_id=OuterRef("pk"), deleted_at__isnull=True,
                )
            ),
            sites_count=_count_subquery(
                Site.objects.filter(
                    customer_id=OuterRef("pk"), deleted_at__isnull=True,
                )
            ),
            # Siti con almeno un asset collegato (usato per il badge "siti" nel
            # Site Repository, che nasconde i siti privi di asset). distinct=True
            # perche' il join con inventories moltiplica le righe per sito.
            # inventories__isnull=False serve: da solo, inventories__deleted_at__isnull
            # passa anche per i siti SENZA asset (la LEFT JOIN da' deleted_at NULL),
            # e il badge contava tutti i siti attivi. Nella stessa filter() le due
            # condizioni si applicano alla stessa join.
            sites_with_assets_count=_count_subquery(
                Site.objects.filter(
                    customer_id=OuterRef("pk"), deleted_at__isnull=True,
                    inventories__isnull=False,
                    inventories__deleted_at__isnull=True,
                ),
                distinct=True,
            ),
            # Numero di ASSET che hanno almeno una issue attiva (non numero di
            # issue): alimenta il badge "segnale" ed e' la stessa semantica del
            # vecchio conteggio client-side, che contava gli inventory con
            # has_active_issue.
            active_issue_count=_count_subquery(
                Inventory.objects.filter(
                    customer_id=OuterRef("pk"),
                    deleted_at__isnull=True,
                    issues__deleted_at__isnull=True,
                    issues__status__in=[IssueStatus.OPEN, IssueStatus.IN_PROGRESS],
                ),
                # Il join su issues moltiplica la riga inventory per ogni issue:
                # distinct=True conta gli inventory, non le issue.
                distinct=True,
            ),
            # Contatti collegati al cliente (qualunque site, incluso NULL):
            # alimenta il bottone "Contatti" nel Site Repository.
            contacts_count=_count_subquery(
                Contact.objects.filter(
                    customer_id=OuterRef("pk"), deleted_at__isnull=True,
                )
            ),
        )

        qs = self._annotate_restyle(qs)
        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    @staticmethod
    def _annotate_restyle(qs):
        from django.apps import apps
        from issues.models import Issue
        Contract = apps.get_model("contracts", "Contract")
        today = timezone.localdate()
        active_contracts = Contract.objects.filter(customer_id=OuterRef("pk"), deleted_at__isnull=True, status="attivo")
        next_qs = active_contracts.filter(end_date__gte=today).order_by("end_date", "id")
        return qs.annotate(
            open_issues_count=_count_subquery(
                Issue.objects.filter(
                    customer_id=OuterRef("pk"), deleted_at__isnull=True,
                    status__in=[IssueStatus.OPEN, IssueStatus.IN_PROGRESS, IssueStatus.WAITING],
                )
            ),
            active_contracts_count=_count_subquery(active_contracts.filter(end_date__gte=today)),
            next_contract_end=Subquery(next_qs.values("end_date")[:1], output_field=DateField()),
            next_contract_title=Subquery(next_qs.values("title")[:1], output_field=CharField()),
        )

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Indicatori della pagina Clienti (clienti attivi, non cestinati)."""
        qs = self.get_queryset().filter(deleted_at__isnull=True).order_by()
        limit = timezone.localdate() + datetime.timedelta(days=CONTRACT_EXPIRING_DAYS)
        agg = qs.aggregate(
            total=Count("id"),
            sites=Sum("sites_count"),
            inventories=Sum("assets_count"),
            with_open_issues=Count("id", filter=Q(open_issues_count__gt=0)),
            open_issues=Sum("open_issues_count"),
            contracts_expiring=Count("id", filter=Q(next_contract_end__isnull=False, next_contract_end__lte=limit)),
            incomplete=Count("id", filter=Q(primary_contact_id__isnull=True) | Q(vat_number__isnull=True) | Q(vat_number="")),
        )
        top3 = list(qs.filter(open_issues_count__gt=0).order_by("-open_issues_count", "name").values("id", "name", "display_name", "open_issues_count")[:3])
        top = top3[0] if top3 else None
        expiring = list(qs.filter(next_contract_end__isnull=False, next_contract_end__lte=limit).order_by("next_contract_end").values("id", "display_name", "name", "next_contract_end", "next_contract_title")[:12])
        nearest = expiring[0] if expiring else None
        by_vendor = list(qs.values("status__key", "status__label").annotate(n=Count("id")).order_by("-n", "status__label"))
        extra = qs.aggregate(
            under_contract=Count("id", filter=Q(active_contracts_count__gt=0)),
            with_vpn=Count("id", filter=Q(has_vpn=True)),
            missing_vat=Count("id", filter=Q(vat_number__isnull=True) | Q(vat_number="")),
            missing_contact=Count("id", filter=Q(primary_contact_id__isnull=True)),
        )
        # Crescita: clienti esistenti alla fine di ciascuno degli ultimi 12 mesi.
        today = timezone.localdate()
        months = []
        y, m = today.year, today.month
        for _ in range(12):
            months.append((y, m))
            y, m = (y - 1, 12) if m == 1 else (y, m - 1)
        months.reverse()
        created = list(qs.values_list("created_at", flat=True))
        growth = []
        for (yy, mm) in months:
            end = datetime.date(yy + (mm // 12), (mm % 12) + 1, 1)
            growth.append({"month": f"{yy}-{mm:02d}", "count": sum(1 for c in created if c and timezone.localtime(c).date() < end)})
        return Response({
            "total": agg["total"] or 0,
            "sites": agg["sites"] or 0,
            "inventories": agg["inventories"] or 0,
            "with_open_issues": agg["with_open_issues"] or 0,
            "open_issues": agg["open_issues"] or 0,
            "top_open_issues": ({"id": top["id"], "name": top["display_name"] or top["name"], "count": top["open_issues_count"]} if top else None),
            "contracts_expiring": agg["contracts_expiring"] or 0,
            "expiring_days": CONTRACT_EXPIRING_DAYS,
            "nearest_expiry": ({"id": nearest["id"], "name": nearest["display_name"] or nearest["name"], "date": nearest["next_contract_end"], "title": nearest["next_contract_title"]} if nearest else None),
            "incomplete": agg["incomplete"] or 0,
            "missing_vat": extra["missing_vat"] or 0,
            "missing_contact": extra["missing_contact"] or 0,
            "under_contract": extra["under_contract"] or 0,
            "with_vpn": extra["with_vpn"] or 0,
            "top_open_issues_list": [{"id": t["id"], "name": t["display_name"] or t["name"], "count": t["open_issues_count"]} for t in top3],
            "expiring": [{"id": e["id"], "name": e["display_name"] or e["name"], "date": e["next_contract_end"], "title": e["next_contract_title"], "days": (e["next_contract_end"] - today).days} for e in expiring],
            "growth": growth,
            "by_vendor": [{"key": v["status__key"], "label": v["status__label"], "count": v["n"]} for v in by_vendor],
        })

    # ── Export Excel flat (cliente → siti → inventory) ─────────────────────
    # Export scoped a UN SOLO cliente (azione detail=True): "Esporta Excel"
    # nel menu contestuale del cliente in Site Repository. Un'unica riga per
    # asset di inventario (denormalizzato: colonne cliente/sito ripetute su
    # ogni riga), pensato per essere aperto/filtrato/pivotato direttamente in
    # Excel. Le credenziali dell'asset (os_pwd/app_pwd/vnc_pwd) NON vengono
    # mai incluse, indipendentemente dal permesso view_secrets: un file xlsx
    # gira via email/chat molto più facilmente di una schermata in-app.
    @action(detail=True, methods=["get"], url_path="export-site-repository")
    def export_site_repository(self, request, pk=None):
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font
            from openpyxl.utils import get_column_letter
        except Exception as e:
            return Response({"detail": f"Excel export dependency missing: {e}"}, status=status.HTTP_501_NOT_IMPLEMENTED)

        customer = self.get_object()

        sites = list(
            Site.objects.filter(customer=customer, deleted_at__isnull=True)
            .select_related("status")
            .order_by("name")
        )
        site_by_id = {s.id: s for s in sites}

        inventories = list(
            Inventory.objects.filter(customer=customer, deleted_at__isnull=True)
            .select_related("status", "type", "site")
            .order_by("site__name", "name")
        )

        headers = [
            "Cliente codice", "Cliente nome", "Cliente città", "Cliente provincia", "Cliente stato",
            "Sito nome", "Sito indirizzo", "Sito città", "Sito provincia", "Sito stato",
            "Asset nome", "Asset tipo", "K-Number", "Numero seriale", "Hostname",
            "IP locale", "IP SRSA", "Produttore", "Modello", "Asset stato",
            "Scadenza garanzia", "Note",
        ]

        wb = Workbook()
        ws = wb.active
        ws.title = "Site Repository"
        ws.append(headers)
        for cell in ws[1]:
            cell.font = Font(bold=True)
        ws.freeze_panes = "A2"

        def site_cols(site):
            if site is None:
                return ["", "", "", "", ""]
            return [
                site.name or "",
                site.address_line1 or "",
                site.city or "",
                site.province or "",
                site.status.label if site.status_id else "",
            ]

        customer_cols = [
            customer.code or "",
            customer.name or "",
            customer.city or "",  # annotato da get_queryset() (Coalesce su custom_fields), presente anche via get_object()
            customer.province or "",
            customer.status.label if customer.status_id else "",
        ]

        if inventories:
            for inv in inventories:
                ws.append(customer_cols + site_cols(inv.site) + [
                    inv.name or "",
                    inv.type.label if inv.type_id else "",
                    inv.knumber or "",
                    inv.serial_number or "",
                    inv.hostname or "",
                    inv.local_ip or "",
                    inv.srsa_ip or "",
                    inv.manufacturer or "",
                    inv.model or "",
                    inv.status.label if inv.status_id else "",
                    inv.warranty_end_date.isoformat() if inv.warranty_end_date else "",
                    inv.notes or "",
                ])
        else:
            # Nessun asset: almeno una riga per cliente/sito, altrimenti il
            # cliente sparirebbe del tutto dall'export.
            for site in sites or [None]:
                ws.append(customer_cols + site_cols(site) + ["", "", "", "", "", "", "", "", "", "", "", ""])

        for i, _ in enumerate(headers, start=1):
            ws.column_dimensions[get_column_letter(i)].width = 18

        buf = io.BytesIO()
        wb.save(buf)

        filename = re.sub(r"[^A-Za-z0-9._-]+", "_", f"site_repository_{customer.code or customer.id}_{timezone.now():%Y%m%d}.xlsx")
        resp = HttpResponse(
            buf.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp




# -------------------------
# Sites
# -------------------------

class SiteSerializer(CustomFieldsValidationMixin, serializers.ModelSerializer):
    custom_fields_entity = "site"
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    status_key = serializers.CharField(source="status.key", read_only=True)
    status_label = serializers.CharField(source="status.label", read_only=True)

    primary_contact_id    = serializers.IntegerField(read_only=True, allow_null=True)
    primary_contact_name  = serializers.CharField(read_only=True, allow_null=True)
    primary_contact_email = serializers.CharField(read_only=True, allow_null=True)
    primary_contact_phone = serializers.CharField(read_only=True, allow_null=True)
    # Numero di contatti collegati al sito: mostra il bottone "Contatti" nel
    # Site Repository solo quando ce n'è più di uno (il primo è già esposto
    # via primary_contact_*), stessa semantica di Customer.contacts_count.
    contacts_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Site
        fields = [
            "id",
            "customer",
            "customer_code",
            "customer_name",
            "name",
            "display_name",
            "city",
            "address_line1",
            "postal_code",
            "province",
            "country",
            "status",
            "status_key",
            "status_label",
            "primary_contact_id",
            "primary_contact_name",
            "primary_contact_email",
            "primary_contact_phone",
            "contacts_count",
            "notes",
            "custom_fields",
            "created_at",
            "updated_at",
            "deleted_at",
        ]


class SiteViewSet(PortalTenantWriteMixin, PortalScopedMixin, PurgeActionMixin, RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = SiteSerializer
    # Fix P0 6.6: view/add/change/delete_site espliciti per il Portal
    # (gli utenti interni mantengono il comportamento storico).
    permission_classes = [IsPortalUserOrInternal, CrmInventoryModelPermissions]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    # Fix P0 6.2: per utenti portale "puri" forza customer=proprio tenant
    # in create/update (tenant_owned_field="customer" è già il default).
    filterset_fields = ["customer", "status"]
    search_fields = ["name", "display_name", "city", "address_line1", "postal_code"]
    ordering_fields = [
        "name",
        "display_name",
        # Aliases used by frontend (annotated in get_queryset)
        "customer_display_name",
        "status_label",
        "city",
        "postal_code",
        "deleted_at",
        "updated_at",
        "created_at",
        # Backward-compatible ORM paths
        "customer__name",
        "customer__display_name",
        "status__label",
    ]
    ordering = ["name"]
    purge_permission = "crm.delete_site"

    def get_queryset(self):
        qs = Site.objects.select_related("customer", "status")

        # Primary contact for this site (site FK matches, is_primary=True)
        primary_contact_qs = Contact.objects.filter(
            site_id=OuterRef("pk"),
            is_primary=True,
            deleted_at__isnull=True,
        ).order_by("-updated_at", "id")

        qs = qs.annotate(
            customer_display_name=Coalesce(F("customer__display_name"), F("customer__name")),
            status_label=F("status__label"),
            primary_contact_id=Subquery(primary_contact_qs.values("id")[:1]),
            primary_contact_name=Subquery(primary_contact_qs.values("name")[:1]),
            primary_contact_email=Subquery(primary_contact_qs.values("email")[:1]),
            primary_contact_phone=Subquery(primary_contact_qs.values("phone")[:1]),
            contacts_count=_count_subquery(
                Contact.objects.filter(site_id=OuterRef("pk"), deleted_at__isnull=True),
                group_field="site_id",
            ),
        )

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))



# -------------------------
# Contacts
# -------------------------

class ContactSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    site_name = serializers.CharField(source="site.name", read_only=True)
    site_display_name = serializers.CharField(source="site.display_name", read_only=True)

    def validate(self, attrs):
        customer = attrs.get("customer") if "customer" in attrs else getattr(self.instance, "customer", None)
        site = attrs.get("site") if "site" in attrs else getattr(self.instance, "site", None)

        if site is not None and customer is not None and site.customer_id != customer.id:
            raise serializers.ValidationError({
                "site": ["Il sito selezionato non appartiene al cliente del contatto."]
            })

        return attrs

    class Meta:
        model = Contact
        fields = [
            "id",
            "customer", "customer_code", "customer_name",
            "site", "site_name", "site_display_name",
            "name", "email", "phone", "department",
            "is_primary", "notes",
            "created_at", "updated_at", "deleted_at",
        ]



class ContactViewSet(PortalTenantWriteMixin, PortalScopedMixin, PurgeActionMixin, RestoreActionMixin, SoftDeleteAuditMixin, viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    # Fix P0 6.6: view/add/change/delete_contact espliciti per il portale
    # Portal (gli utenti interni mantengono il comportamento storico).
    permission_classes = [IsPortalUserOrInternal, CrmInventoryModelPermissions]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    # Fix P0 6.2: forza customer=proprio tenant per utenti portale "puri" e
    # verifica che il site scelto appartenga allo stesso tenant.
    tenant_related_fields = ("site",)

    filterset_fields = ["customer", "site", "is_primary"]
    search_fields = ["name", "email", "phone", "department", "notes"]
    ordering_fields = [
        "name",
        "email",
        "phone",
        # Aliases used by frontend (annotated in get_queryset)
        "customer_display_name",
        "site_display_name",
        "is_primary",
        "deleted_at",
        "updated_at",
        "created_at",
        # Backward-compatible ORM paths
        "customer__name",
        "customer__display_name",
        "site__name",
        "site__display_name",
    ]
    ordering = ["-is_primary", "name"]

    _PRIMARY_CONSTRAINT_MAP = {
        # 0.9.1 (DATA-003): backstop per il raro caso di due richieste
        # concorrenti che impostano is_primary=True per lo STESSO
        # customer/site quando ancora NESSUN primario esiste — in quel
        # caso _demote_other_primaries non ha nulla da demuovere/da cui
        # serializzarsi (0 righe interessate da entrambe le UPDATE), e
        # sono i due INSERT successivi a competere: il vincolo DB
        # respinge il secondo con IntegrityError, che altrimenti
        # diventerebbe un 500 invece di un 400 comprensibile.
        "ux_contact_one_primary_per_customer_no_site": {
            "is_primary": "Esiste già un contatto primario per questo cliente (senza sito specifico)."
        },
        "ux_contact_one_primary_per_customer_site": {
            "is_primary": "Esiste già un contatto primario per questo cliente/sito."
        },
    }

    def create(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError as e:
            raise_integrity_error_as_validation(e, constraint_map=self._PRIMARY_CONSTRAINT_MAP)

    def update(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError as e:
            raise_integrity_error_as_validation(e, constraint_map=self._PRIMARY_CONSTRAINT_MAP)

    def get_queryset(self):
        qs = Contact.objects.select_related("customer", "site")

        qs = qs.annotate(
            customer_display_name=Coalesce(F("customer__display_name"), F("customer__name")),
            site_display_name=Coalesce(F("site__display_name"), F("site__name")),
        )

        return apply_soft_delete_filters(qs, request=self.request, action_name=getattr(self, "action", ""))

    @action(detail=True, methods=['post'], permission_classes=[CanRestoreModelPermission])
    def restore(self, request, pk=None):
        # 0.9.1 (DATA-003): demote PRIMA del restore, non dopo — stesso
        # motivo di perform_create/perform_update sopra (il vincolo DB non
        # deve mai essere violato nemmeno transitoriamente).
        obj = self.get_object()
        from core.restore_policy import get_restore_block_reason
        reason = get_restore_block_reason(obj)
        if reason:
            return Response({'detail': reason}, status=status.HTTP_409_CONFLICT)
        with transaction.atomic():
            if obj.is_primary:
                self._demote_other_primaries(obj.customer, obj.site, exclude_id=obj.id)
            self._restore_obj(obj, request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], permission_classes=[CanRestoreModelPermission])
    def bulk_restore(self, request):
        """Restore multiple soft-deleted Contact objects.
        Body: {"ids": [1,2,3]} (or a raw list).
        Uses QuerySet.update() to avoid N+1; demote PRIMA del restore
        bulk (0.9.1, DATA-003), non dopo — stesso motivo di restore().
        """
        from django.utils import timezone as tz
        payload = request.data
        ids = payload.get('ids') if isinstance(payload, dict) else payload
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

        qs = list(Contact.objects.select_related('customer', 'site').filter(id__in=ids, deleted_at__isnull=False))
        restorable, blocked = split_restorable(qs)
        restored_ids = [obj.id for obj in restorable]
        if restored_ids:
            now = tz.now()
            with transaction.atomic():
                for obj in restorable:
                    if obj.is_primary:
                        self._demote_other_primaries(obj.customer, obj.site, exclude_id=obj.id)
                Contact.objects.filter(id__in=restored_ids).update(
                    deleted_at=None, updated_by=request.user, updated_at=now
                )

        log_event(
            actor=request.user, action='restore', instance=None,
            changes={'ids': restored_ids}, request=request,
            subject=f'bulk restore Contact: {restored_ids}',
        )
        return Response({'restored': restored_ids, 'count': len(restored_ids), 'blocked': blocked, 'blocked_count': len(blocked)}, status=status.HTTP_200_OK)


    def _demote_other_primaries(self, customer, site, *, exclude_id=None):
        """Demuove eventuali altri contatti primari per lo stesso
        customer/site, PRIMA di salvare il nuovo/aggiornato contatto
        primario, nella stessa transazione atomica (0.9.1, DATA-003).

        Rimpiazza il vecchio _enforce_primary, che girava DOPO il save in
        una query separata non atomica — con il nuovo vincolo DB
        (ux_contact_one_primary_per_customer_*) un save "nuovo primario
        prima, demote dopo" violerebbe il constraint nell'istante tra i
        due passi. Invertendo l'ordine (demote prima, poi save) il
        constraint non viene mai violato nemmeno transitoriamente, e la
        UPDATE stessa (che prende un lock riga per riga) serializza le
        richieste concorrenti sullo stesso customer/site: la seconda
        richiesta a committare vede lo stato aggiornato dalla prima ed è
        lei stessa a fare l'ultima demote, quindi resta un solo primario
        anche sotto concorrenza — "ultimo che scrive vince", mai zero né
        due primari.
        """
        qs = Contact.objects.filter(
            customer=customer,
            site=site,
            deleted_at__isnull=True,
            is_primary=True,
        )
        if exclude_id is not None:
            qs = qs.exclude(id=exclude_id)
        qs.update(is_primary=False)

    def perform_create(self, serializer):
        is_primary = serializer.validated_data.get('is_primary', False)
        customer = serializer.validated_data.get('customer')
        site = serializer.validated_data.get('site')
        with transaction.atomic():
            if is_primary:
                self._demote_other_primaries(customer, site)
            instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        changes = {
            k: {'from': None, 'to': to_change_value_for_field(k, v)}
            for k, v in (serializer.validated_data or {}).items()
        }
        log_event(actor=self.request.user, action='create', instance=instance, changes=changes, request=self.request)

    def perform_update(self, serializer):
        instance_before = serializer.instance
        changes = self._changes_from_validated(instance_before, serializer.validated_data)
        is_primary = serializer.validated_data.get('is_primary', instance_before.is_primary)
        customer = serializer.validated_data.get('customer', instance_before.customer)
        site = serializer.validated_data.get('site', instance_before.site)
        with transaction.atomic():
            if is_primary:
                self._demote_other_primaries(customer, site, exclude_id=instance_before.id)
            instance = serializer.save(updated_by=self.request.user)
        log_event(actor=self.request.user, action='update', instance=instance, changes=changes or None, request=self.request)

# -------------------------
# Customer VPN Access
# -------------------------

class VpnSecretsPermissionMixin:
    """Nasconde la password se l'utente non ha il permesso view_vpn_secrets."""

    def _can_view_vpn_secrets(self) -> bool:
        request = self.context.get("request") if hasattr(self, "context") else None
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return bool(
            getattr(user, "is_superuser", False)
            or user.has_perm("crm.view_vpn_secrets")
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self._can_view_vpn_secrets():
            self.fields.pop("password", None)


class CustomerVpnAccessSerializer(VpnSecretsPermissionMixin, serializers.ModelSerializer):
    customer = serializers.IntegerField(source="customer_id", read_only=True)
    # Restituisce la password decifrata (solo se l'utente ha il permesso)
    password = serializers.SerializerMethodField()
    # Campo write-only per ricevere la password in chiaro dal client
    password_input = serializers.CharField(
        write_only=True, required=False, allow_blank=True, allow_null=True
    )

    def get_password(self, obj):
        if not self._can_view_vpn_secrets():
            return None
        try:
            return decrypt(obj.password) if obj.password else None
        except Exception:
            return None

    def validate(self, attrs):
        # Sposta password_input -> password (il model.save() la cifra)
        pwd = attrs.pop("password_input", None)
        if pwd is not None:
            attrs["password"] = pwd
        return attrs

    class Meta:
        model = CustomerVpnAccess
        fields = [
            "id",
            "customer",
            "applicativo",
            "utenza",
            "password",
            "password_input",
            "remote_address",
            "porta",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "customer", "created_at", "updated_at"]


class CustomerVpnAccessViewSet(viewsets.ViewSet):
    """
    GET    /api/customers/{customer_pk}/vpn/  → restituisce l'accesso VPN (o 404)
    POST   /api/customers/{customer_pk}/vpn/  → crea l'accesso VPN
    PATCH  /api/customers/{customer_pk}/vpn/  → aggiorna l'accesso VPN
    DELETE /api/customers/{customer_pk}/vpn/  → elimina l'accesso VPN
    """

    # Necessario affinché IsAuthenticatedDjangoModelPermissions possa
    # ricavare il modello e controllare i permessi crm.{add,change,delete}_customervpnaccess.
    queryset = CustomerVpnAccess.objects.none()

    def _get_customer(self, customer_pk):
        return Customer.objects.filter(pk=customer_pk, deleted_at__isnull=True).first()

    def _serializer(self, instance=None, data=None, partial=False, request=None):
        ctx = {"request": request}
        if data is not None:
            return CustomerVpnAccessSerializer(instance, data=data, partial=partial, context=ctx)
        return CustomerVpnAccessSerializer(instance, context=ctx)

    def retrieve(self, request, customer_pk=None):
        customer = self._get_customer(customer_pk)
        if not customer:
            return Response({"detail": "Cliente non trovato."}, status=status.HTTP_404_NOT_FOUND)
        try:
            vpn = customer.vpn_access
        except CustomerVpnAccess.DoesNotExist:
            return Response({"detail": "Nessun accesso VPN configurato."}, status=status.HTTP_404_NOT_FOUND)
        serializer = self._serializer(vpn, request=request)
        return Response(serializer.data)

    def create(self, request, customer_pk=None):
        customer = self._get_customer(customer_pk)
        if not customer:
            return Response({"detail": "Cliente non trovato."}, status=status.HTTP_404_NOT_FOUND)
        if CustomerVpnAccess.objects.filter(customer=customer).exists():
            return Response(
                {"detail": "Accesso VPN già configurato. Usa PATCH per modificarlo."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self._serializer(data=request.data, request=request)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        instance = serializer.save(customer=customer, created_by=request.user, updated_by=request.user)
        log_event(
            actor=request.user, action="create", instance=instance,
            changes={k: {"from": None, "to": v} for k, v in (serializer.validated_data or {}).items()},
            request=request,
        )
        return Response(self._serializer(instance, request=request).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, customer_pk=None):
        customer = self._get_customer(customer_pk)
        if not customer:
            return Response({"detail": "Cliente non trovato."}, status=status.HTTP_404_NOT_FOUND)
        try:
            instance = customer.vpn_access
        except CustomerVpnAccess.DoesNotExist:
            return Response({"detail": "Nessun accesso VPN configurato."}, status=status.HTTP_404_NOT_FOUND)
        serializer = self._serializer(instance, data=request.data, partial=True, request=request)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        before = {f: getattr(instance, f, None) for f in serializer.validated_data}
        instance = serializer.save(updated_by=request.user)
        # 0.9.1 (bug trovato durante il fix SEC-001, non collegato alla
        # sanitizzazione: `before` veniva calcolato e mai usato, quindi il
        # PATCH non registrava alcun diff nell'audit — solo l'evento
        # "update" senza changes). log_event/_sanitize_changes maschera
        # ora centralmente i campi sensibili, quindi è sicuro loggare il
        # diff reale anche per un campo come "password".
        after = {f: getattr(instance, f, None) for f in serializer.validated_data}
        log_event(
            actor=request.user, action="update", instance=instance,
            changes=build_changes(before, after),
            request=request,
        )
        return Response(self._serializer(instance, request=request).data)

    def destroy(self, request, customer_pk=None):
        customer = self._get_customer(customer_pk)
        if not customer:
            return Response({"detail": "Cliente non trovato."}, status=status.HTTP_404_NOT_FOUND)
        try:
            instance = customer.vpn_access
        except CustomerVpnAccess.DoesNotExist:
            return Response({"detail": "Nessun accesso VPN configurato."}, status=status.HTTP_404_NOT_FOUND)
        log_event(actor=request.user, action="delete", instance=instance, request=request)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
