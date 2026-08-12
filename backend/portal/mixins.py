from __future__ import annotations

from rest_framework import serializers

from portal.permissions import _is_portal_user, _is_internal_user, _get_portal_customer_id

# Mappa: basename del router → campo (anche con lookup "__") verso Customer.
# Aggiorna questa mappa quando aggiungi nuovi modelli accessibili dal portale.
_CUSTOMER_FIELD_MAP: dict[str, str] = {
    # crm
    "customer":  "id",           # Customer stesso: filtra per pk
    "site":      "customer_id",
    "contact":   "customer_id",
    # inventory
    "inventory": "customer_id",
    # device
    "device":         "customer_id",
    "device-wifi":    "device__customer_id",     # DeviceWifi non ha customer diretto
    "device-rispacs": "device__customer_id",     # tabella associativa Device<->Rispacs
    # vlan
    "vlan":             "customer_id",
    "vlan-ip-request":  "customer_id",
}


class PortalScopedMixin:
    """Mixin da aggiungere ai ViewSet che devono rispettare lo scope Portal.

    Usa filter_queryset() invece di get_queryset() perché i ViewSet esistenti
    costruiscono il queryset da zero senza chiamare super(), quindi un override
    di get_queryset() nel mixin non riceverebbe mai il queryset finale.

    filter_queryset() viene invocato da DRF *dopo* get_queryset() su ogni
    action (list, retrieve, ecc.), quindi il filtro viene sempre applicato
    sul queryset già costruito dal ViewSet.

    Comportamento (deciso SOLO da identità/permessi server-side, MAI da un
    header inviato dal client — vedi fix 2.1 audit 2026-07):
    - utente con accesso interno Archie (`core.access_archie` o superuser)
      → nessuno scope, vede tutto, anche se ha anche un profilo Portal;
    - utente Portal "puro" (profilo attivo, nessun accesso interno)
      → SEMPRE scopato sul proprio customer, indipendentemente da qualunque
        header presente o assente nella richiesta;
    - qualunque altro utente autenticato → queryset invariato (la view a
      monte decide se può accedervi tramite le proprie permission class).
    """

    def filter_queryset(self, queryset):
        # Prima applica tutti i filter backend DRF standard (search, ordering, ecc.)
        qs = super().filter_queryset(queryset)

        user = getattr(self.request, "user", None)
        if not _is_portal_user(user):
            return qs

        # Utente con accesso interno Archie (anche se ha pure un profilo
        # Portal): non viene scopato. Questa decisione è presa SOLO in base
        # ai permessi Django reali dell'utente, mai da un header client.
        if _is_internal_user(user):
            return qs

        customer_id = _get_portal_customer_id(self.request)
        if customer_id is None:
            return qs.none()

        basename = getattr(self, "basename", "") or ""
        field = _CUSTOMER_FIELD_MAP.get(basename)

        if field == "id":
            return qs.filter(pk=customer_id)
        elif field:
            return qs.filter(**{field: customer_id})
        else:
            # Modello non mappato: per sicurezza restituisce vuoto
            return qs.none()


class PortalTenantWriteMixin:
    """Mixin da aggiungere ai ViewSet insieme a `PortalScopedMixin` per
    vincolare le SCRITTURE (create/update) al tenant dell'utente portale.

    `PortalScopedMixin` filtra solo le letture (list/retrieve): senza questo
    mixin nulla impedisce a un utente portale con permesso di scrittura di
    inviare un `customer` (o un `site`/`vlan`/`device` di un altro cliente)
    diverso dal proprio nel payload (fix 2.2 audit 2026-07).

    Configurazione per sottoclasse:
        tenant_owned_field: nome del campo FK diretto verso Customer sul
            modello (default "customer"). Impostare a None se il modello
            non ha un customer proprio ma lo eredita da una relazione
            (es. DeviceWifi → device.customer).
        tenant_related_fields: altri campi FK il cui `.customer_id` deve
            combaciare con quello dell'utente portale (es. "site", "vlan",
            "device").

    Per gli utenti con accesso interno (`_is_internal_user`) il mixin non
    applica alcun vincolo: possono scrivere su qualunque customer, come oggi.
    """

    tenant_owned_field: str | None = "customer"
    tenant_related_fields: tuple[str, ...] = ()

    def _portal_customer_id(self):
        user = getattr(self.request, "user", None)
        if not _is_portal_user(user) or _is_internal_user(user):
            return None
        return _get_portal_customer_id(self.request)

    def perform_create(self, serializer):
        self._enforce_tenant(serializer)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self._enforce_tenant(serializer)
        super().perform_update(serializer)

    def _enforce_tenant(self, serializer) -> None:
        customer_id = self._portal_customer_id()
        if customer_id is None:
            return  # utente interno: nessun vincolo di tenant

        if self.tenant_owned_field:
            serializer.validated_data[f"{self.tenant_owned_field}_id"] = customer_id
            serializer.validated_data.pop(self.tenant_owned_field, None)

        for field_name in self.tenant_related_fields:
            related = serializer.validated_data.get(field_name)
            if related is None and serializer.instance is not None:
                # In update parziale (PATCH) il campo potrebbe non essere
                # nel payload: verifica comunque il valore già sull'istanza.
                related = getattr(serializer.instance, field_name, None)
            related_customer_id = getattr(related, "customer_id", None)
            if related is not None and related_customer_id is not None and related_customer_id != customer_id:
                raise serializers.ValidationError(
                    {field_name: "La risorsa selezionata non appartiene al tuo cliente."}
                )
