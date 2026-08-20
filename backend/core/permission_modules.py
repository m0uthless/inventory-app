"""core/permission_modules.py — Helper condivisi per il pannello "Utenti e Gruppi".

Il progetto usa il sistema permessi standard di Django (auth.Group + auth.Permission).
Ogni modello ha automaticamente 4 permessi: add_<model>, change_<model>,
delete_<model>, view_<model>. Questo modulo aggrega quei permessi "per modulo"
(= app Django) in una matrice R/W/D:

    R (view)   -> view_<model> su TUTTI i modelli dell'app
    W (write)  -> add_<model> + change_<model> su TUTTI i modelli dell'app
                  (il "change" è anche ciò che serve per il ripristino dal
                  cestino, vedi CanRestoreModelPermission)
    D (delete) -> delete_<model> su TUTTI i modelli dell'app
                  (è anche ciò che serve per la cancellazione definitiva/purge,
                  vedi CanPurgeModelPermission)

I permessi che non seguono lo schema add/change/delete/view_<model> (es.
`core.access_archie`, `core.manage_users`, `crm.view_vpn_secrets`,
`inventory.view_secrets`) sono trattati come permessi "extra" e vanno
assegnati singolarmente, non fanno parte della matrice RWD.

NOTA IMPORTANTE sui permessi diretti utente (vedi UserAdminViewSet):
i permessi assegnati direttamente a un utente (`user.user_permissions`) in
Django sono SOLO ADDITIVI rispetto a quelli del gruppo: possono aggiungere
diritti oltre a quelli del gruppo, ma non possono toglierne. Non esiste,
con questo approccio, la possibilità di negare a un singolo utente un
permesso che il suo gruppo concede. È una scelta consapevole per restare
sul meccanismo nativo di Django; se in futuro servisse un vero override
(anche in negativo) si può introdurre un permission backend custom senza
dover riscrivere il pannello.
"""
from __future__ import annotations

from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q

# app_label -> etichetta leggibile mostrata nel pannello
MODULE_LABELS: dict[str, str] = {
    "crm": "CRM & Clienti",
    "inventory": "Inventario",
    "maintenance": "Manutenzione",
    "wiki": "Wiki",
    "drive": "Drive",
    "issues": "Issue & Ticket",
    "feedback": "Feedback",
    "device": "Device",
    "vlan": "VLAN & Rete",
    "servicenow": "ServiceNow",
    "attendance": "Presenze & Ferie",
    "expenses": "Note Spese",
    "purchaseorders": "Purchase Order",
    "portal": "Portale Clienti",
    "core": "Core / Sistema",
    "custom_fields": "Campi Personalizzati",
    "audit": "Audit Log",
}

# app_label esclusivi del Portal: non hanno equivalente sul frontend
# Archie principale (vedi TODO ARCHIE punto 3: Device/VLAN restano esclusivi
# di Portal). "portal" è il modulo che rappresenta l'accesso al portal stesso.
PORTAL_DEDICATED_APPS: frozenset[str] = frozenset({"portal", "device", "vlan"})

_STANDARD_ACTIONS = ("view", "add", "change", "delete")

# action logico del pannello -> prefissi di codename Django coinvolti
_ACTION_PREFIXES = {
    "r": ("view",),
    "w": ("add", "change"),
    "d": ("delete",),
}


def _standard_action(codename: str, model: str) -> str | None:
    """Se `codename` è uno standard add/change/delete/view_<model>, ritorna
    l'azione ('add'/'change'/'delete'/'view'), altrimenti None."""
    for action in _STANDARD_ACTIONS:
        if codename == f"{action}_{model}":
            return action
    return None


def get_permission_modules() -> list[dict]:
    """Ritorna i moduli (app) con i permessi "extra" disponibili per ciascuno.

    [{"app_label": "crm", "label": "CRM & Clienti",
      "extra_permissions": [{"id": 12, "codename": "crm.view_vpn_secrets",
                              "name": "Can view VPN secrets (password)"}]}, ...]
    """
    perms = (
        Permission.objects.select_related("content_type")
        .filter(content_type__app_label__in=MODULE_LABELS.keys())
        .order_by("content_type__app_label", "name")
    )

    extras_by_app: dict[str, list[dict]] = {app: [] for app in MODULE_LABELS}
    present_apps: set[str] = set()

    for perm in perms:
        app_label = perm.content_type.app_label
        model = perm.content_type.model
        present_apps.add(app_label)
        if _standard_action(perm.codename, model) is not None:
            continue
        extras_by_app.setdefault(app_label, []).append({
            "id": perm.id,
            "codename": f"{app_label}.{perm.codename}",
            "name": perm.name,
        })

    modules = []
    for app_label, label in MODULE_LABELS.items():
        if app_label not in present_apps:
            continue
        modules.append({
            "app_label": app_label,
            "label": label,
            "extra_permissions": extras_by_app.get(app_label, []),
            "is_portal_dedicated": app_label in PORTAL_DEDICATED_APPS,
        })
    return modules


def get_permission_ids_for_module_action(app_label: str, action: str) -> list[int]:
    """Id dei Permission Django che compongono l'azione logica ('r'/'w'/'d')
    per TUTTI i modelli dell'app `app_label`."""
    prefixes = _ACTION_PREFIXES.get(action)
    if not prefixes or app_label not in MODULE_LABELS:
        return []

    q = Q()
    has_any = False
    for ct in ContentType.objects.filter(app_label=app_label):
        for prefix in prefixes:
            q |= Q(content_type=ct, codename=f"{prefix}_{ct.model}")
            has_any = True
    if not has_any:
        return []
    return list(Permission.objects.filter(q).values_list("id", flat=True))


def compute_permission_ids(module_rwd: dict, extra_permission_ids: list[int] | None = None) -> list[int]:
    """Da una matrice {app_label: {"r": bool, "w": bool, "d": bool}} + una
    lista di id di permessi extra selezionati, calcola l'insieme completo
    di id Permission da assegnare (a un Group o a user.user_permissions)."""
    ids: set[int] = set(extra_permission_ids or [])
    for app_label, rwd in (module_rwd or {}).items():
        if app_label not in MODULE_LABELS:
            continue
        for action in ("r", "w", "d"):
            if rwd.get(action):
                ids.update(get_permission_ids_for_module_action(app_label, action))
    return list(ids)


def serialize_permission_state(permission_qs) -> dict:
    """Da un queryset/iterable di Permission GIÀ assegnati (a un Group o a
    user.user_permissions), ricostruisce la matrice RWD per modulo + la
    lista dei permessi extra assegnati.

    Ritorna: {"modules": {app_label: {"r": bool, "w": bool, "d": bool}},
              "extra_permissions": ["core.access_archie", ...]}
    """
    assigned_actions_by_app: dict[str, set[str]] = {}
    extra: list[str] = []

    for perm in permission_qs.select_related("content_type"):
        app_label = perm.content_type.app_label
        model = perm.content_type.model
        action = _standard_action(perm.codename, model)
        if action:
            assigned_actions_by_app.setdefault(app_label, set()).add(action)
        else:
            extra.append(f"{app_label}.{perm.codename}")

    modules_state = {}
    for app_label in MODULE_LABELS:
        actions = assigned_actions_by_app.get(app_label, set())
        modules_state[app_label] = {
            "r": "view" in actions,
            "w": ("add" in actions and "change" in actions),
            "d": "delete" in actions,
        }

    return {"modules": modules_state, "extra_permissions": sorted(extra)}
