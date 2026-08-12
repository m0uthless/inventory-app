from __future__ import annotations

from rest_framework.permissions import BasePermission, DjangoModelPermissions, SAFE_METHODS

from core.permissions import IsAuthenticatedDjangoModelPermissions


# ─── Accesso Archie ────────────────────────────────────────────────────────────

def _can_access_archie(user) -> bool:
    """True se l'utente può accedere al frontend Archie principale.

    Criteri (OR):
    - is_superuser  → override di sistema
    - permesso custom `core.access_archie` assegnato tramite gruppo Django Admin
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    return bool(user.has_perm("core.access_archie"))


# ─── Accesso Portal ───────────────────────────────────────────────────

def _is_portal_user(user) -> bool:
    """True se l'utente può accedere al Portal.

    Criterio: esiste un PortalUserProfile con `is_active=True`, cioè con un
    cliente di default non eliminato E ancora tra i clienti assegnati (vedi
    PortalUserProfile.is_active — 0.9.0: se un admin disattiva/rimuove il
    default dagli assegnati, l'accesso si blocca esplicitamente, nessun
    fallback silenzioso su un altro cliente).

    Nessun controllo su gruppi: i gruppi gestiscono i permessi
    sui singoli modelli tramite DjangoModelPermissions standard.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    try:
        from portal.models import PortalUserProfile
        profile = PortalUserProfile.objects.filter(user_id=user.pk).first()
        return bool(profile and profile.is_active)
    except Exception:
        return False


def _can_edit_portal(user) -> bool:
    """True se l'utente può scrivere nel Portal.

    Criteri (OR):
    - is_superuser  → override di sistema
    - permesso Django standard device.change_device

    Usato dal frontend per mostrare/nascondere controlli di modifica.
    Il controllo granulare per-endpoint è delegato a DjangoModelPermissions.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    return bool(user.has_perm("device.change_device"))


SESSION_ACTIVE_CUSTOMER_KEY = "portal_active_customer_id"


def _get_portal_customer_id(request) -> int | None:
    """Risolve il cliente ATTIVO dell'utente portale per la request corrente.

    0.9.0 (multi-cliente): il cliente attivo è tenuto in sessione
    server-side (mai header/localStorage — vedi PortalScopedMixin), con
    fallback self-healing al cliente di default se la sessione non ce l'ha
    ancora o contiene un customer_id non più tra quelli assegnati
    all'utente (es. un admin ha rimosso quel cliente nel frattempo).

    Riceve `request` (non `user`) perché la sessione vive sulla request.
    """
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return None
    try:
        from portal.models import PortalUserProfile
        profile = PortalUserProfile.objects.get(user_id=user.pk)
    except Exception:
        return None

    if not profile.is_active:
        return None

    allowed_ids = set(profile.customers.values_list("id", flat=True))
    session_id = request.session.get(SESSION_ACTIVE_CUSTOMER_KEY)

    if session_id in allowed_ids:
        return session_id

    # Self-healing: sessione assente o con un customer non più assegnato
    # → ricade sul cliente di default e lo fissa in sessione.
    request.session[SESSION_ACTIVE_CUSTOMER_KEY] = profile.customer_id
    return profile.customer_id


def _is_internal_user(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return _can_access_archie(user)


# ─── Permission classes DRF ───────────────────────────────────────────────────

class IsPortalUser(BasePermission):
    """Accesso riservato agli utenti con PortalUserProfile attivo."""
    message = "Accesso riservato agli utenti del Portal."

    def has_permission(self, request, view) -> bool:
        return _is_portal_user(request.user)


class HasPortalProfile(BasePermission):
    """Come IsPortalUser ma lascia passare anche un profilo bloccato
    (is_active=False, punto 4: cliente di default disattivato/rimosso dagli
    assegnati). Usata SOLO da PortalMeView, che poi restituisce un messaggio
    esplicito invece del generico 403 — ogni altro endpoint deve continuare
    a usare IsPortalUser/IsPortalUserOrInternal (blocco pieno)."""
    message = "Accesso riservato agli utenti del Portal."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not getattr(user, "is_authenticated", False):
            return False
        if getattr(user, "is_superuser", False):
            return True
        try:
            from portal.models import PortalUserProfile
            return PortalUserProfile.objects.filter(user_id=user.pk).exists()
        except Exception:
            return False


class IsInternalUser(BasePermission):
    """Accesso riservato agli utenti interni (permesso core.access_archie)."""
    message = "Accesso riservato agli utenti interni."

    def has_permission(self, request, view) -> bool:
        return _is_internal_user(request.user)


class IsPortalUserOrInternal(BasePermission):
    """Accesso per utenti Portal o utenti interni Archie."""
    message = "Autenticazione richiesta."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return _is_portal_user(user) or _can_access_archie(user)


class IsPortalEditor(BasePermission):
    """Scrittura riservata a chi ha il permesso device.change_device.

    Le letture (SAFE_METHODS) passano sempre; il controllo granulare
    per modello è demandato a DjangoModelPermissions nei singoli ViewSet.
    """
    message = "Operazione riservata agli editor Portal."

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return _can_edit_portal(request.user)


class IsArchieAdmin(BasePermission):
    """Operazioni riservate ai superuser o a chi ha permessi admin Archie."""
    message = "Operazione riservata agli amministratori di Archie."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not getattr(user, "is_authenticated", False):
            return False
        if getattr(user, "is_superuser", False):
            return True
        return bool(user.has_perm("core.access_archie"))


# ─── Matrice permessi R/W/D reale per Device/VLAN/Rispacs ─────────────────────
#
# `IsAuthenticatedDjangoModelPermissions` (il default globale, in core/permissions.py)
# eredita da DRF DjangoModelPermissions il cui perms_map lascia GET/HEAD senza
# alcun permesso richiesto: qualunque utente autenticato può leggere.
# Per i moduli "PORTAL_DEDICATED_APPS" (portal, device, vlan — vedi
# core/permission_modules.py) la UI "Utenti e Gruppi" dichiara e assegna
# esplicitamente anche i permessi `view_<model>`: questa classe li fa
# rispettare davvero, mappando GET/HEAD su `view_<model>` e sostituendo
# `IsPortalEditor` (che controllava solo `device.change_device` per
# QUALSIASI scrittura, ignorando add_*/delete_*/view_vlan/ecc.).
class PortalModelPermissions(DjangoModelPermissions):
    """DjangoModelPermissions esteso: richiede `view_<model>` anche in lettura.

    Usare SEMPRE insieme a `IsPortalUserOrInternal` (o `IsPortalUser`/
    `IsInternalUser`) nei `permission_classes`, perché questa classe da sola
    non verifica che l'utente possa accedere al portale/modulo: verifica solo
    che, potendoci accedere, abbia il permesso Django corretto per l'azione.
    """

    perms_map = {
        "GET":     ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": [],
        "HEAD":    ["%(app_label)s.view_%(model_name)s"],
        "POST":    ["%(app_label)s.add_%(model_name)s"],
        "PUT":     ["%(app_label)s.change_%(model_name)s"],
        "PATCH":   ["%(app_label)s.change_%(model_name)s"],
        "DELETE":  ["%(app_label)s.delete_%(model_name)s"],
    }


# ─── Matrice permessi per moduli NON dedicati Portal (CRM, Inventario) ────────
#
# A differenza di device/vlan, i moduli crm e inventory sono il cuore
# dell'Archie principale: gli utenti interni li usano da sempre senza che
# gli sia richiesto un `view_<model>` esplicito (il default storico
# `IsAuthenticatedDjangoModelPermissions` lascia GET/HEAD liberi a chiunque
# sia autenticato). Applicare `PortalModelPermissions` a questi ViewSet
# indistintamente avrebbe potuto rompere l'accesso in lettura per il
# personale interno i cui gruppi non hanno mai avuto bisogno di
# view_customer/view_site/view_contact/view_inventory.
#
# Fix P0 6.2/6.6: qui serve solo chiudere il buco lato PORTALE (un
# utente portale autenticato poteva leggere/scrivere senza alcun permesso
# Django esplicito, oltre allo scope tenant di PortalScopedMixin). Per gli
# utenti interni il comportamento resta quello storico.
class CrmInventoryModelPermissions(BasePermission):
    """Utenti interni: comportamento storico (autenticazione basta in lettura,
    permessi Django standard add/change/delete in scrittura).
    Utenti Portal "puri": stessa matrice R/W/D esplicita già usata
    per device/vlan (`PortalModelPermissions`)."""

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if _is_internal_user(user):
            return IsAuthenticatedDjangoModelPermissions().has_permission(request, view)
        return PortalModelPermissions().has_permission(request, view)

    def has_object_permission(self, request, view, obj) -> bool:
        user = getattr(request, "user", None)
        if _is_internal_user(user):
            return IsAuthenticatedDjangoModelPermissions().has_object_permission(request, view, obj)
        return PortalModelPermissions().has_object_permission(request, view, obj)


class IsInternalOrReadOnly(BasePermission):
    """Le scritture sono riservate agli utenti interni; la lettura passa a tutti
    gli utenti autorizzati dalle altre permission class della view.

    Usata per il registro RIS/PACS globale (`RispacsViewSet`): gli utenti
    portale possono solo consultarlo (tramite `CustomerRispacsViewSet` per la
    versione scoped, o in lettura qui), non crearlo/modificarlo/cancellarlo.
    """

    message = "Il registro RIS/PACS globale è modificabile solo da utenti interni."

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return _is_internal_user(request.user)
