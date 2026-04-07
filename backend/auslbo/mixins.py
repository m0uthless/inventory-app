from __future__ import annotations

from auslbo.permissions import _is_auslbo_user, _get_auslbo_customer_id

# Mappa: basename del router → campo FK verso Customer sul modello.
# Aggiorna questa mappa quando aggiungi nuovi modelli accessibili dal portal.
_CUSTOMER_FIELD_MAP: dict[str, str] = {
    # crm
    "customer":  "id",           # Customer stesso: filtra per pk
    "site":      "customer_id",
    "contact":   "customer_id",
    # inventory
    "inventory": "customer_id",
    # device
    "device":    "customer_id",
    # vlan
    "vlan":             "customer_id",
    "vlan-ip-request":  "customer_id",
}


class AuslBoScopedMixin:
    """Mixin da aggiungere ai ViewSet che devono rispettare lo scope AUSL BO.

    Usa filter_queryset() invece di get_queryset() perché i ViewSet esistenti
    costruiscono il queryset da zero senza chiamare super(), quindi un override
    di get_queryset() nel mixin non riceverebbe mai il queryset finale.

    filter_queryset() viene invocato da DRF *dopo* get_queryset() su ogni
    action (list, retrieve, ecc.), quindi il filtro viene sempre applicato
    sul queryset già costruito dal ViewSet.

    Comportamento:
    - Se l'utente è auslbo → applica il filtro customer sul queryset
    - Se l'utente è interno → restituisce il queryset invariato
    """

    def filter_queryset(self, queryset):
        # Prima applica tutti i filter backend DRF standard (search, ordering, ecc.)
        qs = super().filter_queryset(queryset)

        user = getattr(self.request, "user", None)
        if not _is_auslbo_user(user):
            return qs

        # Il frontend AUSL BO invia sempre l'header X-Auslbo-Portal: 1.
        # Se l'header è assente la richiesta viene da Archie principale:
        # in quel caso anche gli utenti con profilo auslbo vedono tutto.
        request = getattr(self, "request", None)
        if request is not None:
            portal_header = request.META.get("HTTP_X_AUSLBO_PORTAL", "")
            if portal_header != "1":
                return qs

        customer_id = _get_auslbo_customer_id(user)
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
