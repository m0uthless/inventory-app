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


# ─── Accesso portal AUSL BO ───────────────────────────────────────────────────

def _is_auslbo_user(user) -> bool:
    """True se l'utente può accedere al portal AUSL BO.

    Criterio: esiste un AuslBoUserProfile *attivo*, cioè con un customer
    non eliminato (soft delete). Un profilo il cui customer è stato
    disattivato non deve continuare a garantire accesso al portal, anche
    se il record AuslBoUserProfile esiste ancora.

    Nessun controllo su gruppi: i gruppi gestiscono i permessi
    sui singoli modelli tramite DjangoModelPermissions standard.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    try:
        from auslbo.models import AuslBoUserProfile
        return AuslBoUserProfile.objects.filter(
            user_id=user.pk,
            customer__deleted_at__isnull=True,
        ).exists()
    except Exception:
        return False


def _can_edit_auslbo(user) -> bool:
    """True se l'utente può scrivere nel portal AUSL BO.

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


def _get_auslbo_customer_id(user) -> int | None:
    try:
        from auslbo.models import AuslBoUserProfile
        profile = AuslBoUserProfile.objects.only("customer_id").get(user_id=user.pk)
        return profile.customer_id
    except Exception:
        return None


def _is_internal_user(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return _can_access_archie(user)


# ─── Permission classes DRF ───────────────────────────────────────────────────

class IsAuslBoUser(BasePermission):
    """Accesso riservato agli utenti con AuslBoUserProfile attivo."""
    message = "Accesso riservato agli utenti del portal AUSL BO."

    def has_permission(self, request, view) -> bool:
        return _is_auslbo_user(request.user)


class IsInternalUser(BasePermission):
    """Accesso riservato agli utenti interni (permesso core.access_archie)."""
    message = "Accesso riservato agli utenti interni."

    def has_permission(self, request, view) -> bool:
        return _is_internal_user(request.user)


class IsAuslBoUserOrInternal(BasePermission):
    """Accesso per utenti AUSL BO o utenti interni Archie."""
    message = "Autenticazione richiesta."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return _is_auslbo_user(user) or _can_access_archie(user)


class IsAuslBoEditor(BasePermission):
    """Scrittura riservata a chi ha il permesso device.change_device.

    Le letture (SAFE_METHODS) passano sempre; il controllo granulare
    per modello è demandato a DjangoModelPermissions nei singoli ViewSet.
    """
    message = "Operazione riservata agli editor AUSL BO."

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return _can_edit_auslbo(request.user)


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
# Per i moduli "AUSLBO_DEDICATED_APPS" (auslbo, device, vlan — vedi
# core/permission_modules.py) la UI "Utenti e Gruppi" dichiara e assegna
# esplicitamente anche i permessi `view_<model>`: questa classe li fa
# rispettare davvero, mappando GET/HEAD su `view_<model>` e sostituendo
# `IsAuslBoEditor` (che controllava solo `device.change_device` per
# QUALSIASI scrittura, ignorando add_*/delete_*/view_vlan/ecc.).
class AuslBoModelPermissions(DjangoModelPermissions):
    """DjangoModelPermissions esteso: richiede `view_<model>` anche in lettura.

    Usare SEMPRE insieme a `IsAuslBoUserOrInternal` (o `IsAuslBoUser`/
    `IsInternalUser`) nei `permission_classes`, perché questa classe da sola
    non verifica che l'utente possa accedere al portal/modulo: verifica solo
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


# ─── Matrice permessi per moduli NON dedicati AUSLBO (CRM, Inventario) ────────
#
# A differenza di device/vlan, i moduli crm e inventory sono il cuore
# dell'Archie principale: gli utenti interni li usano da sempre senza che
# gli sia richiesto un `view_<model>` esplicito (il default storico
# `IsAuthenticatedDjangoModelPermissions` lascia GET/HEAD liberi a chiunque
# sia autenticato). Applicare `AuslBoModelPermissions` a questi ViewSet
# indistintamente avrebbe potuto rompere l'accesso in lettura per il
# personale interno i cui gruppi non hanno mai avuto bisogno di
# view_customer/view_site/view_contact/view_inventory.
#
# Fix P0 6.2/6.6: qui serve solo chiudere il buco lato PORTALE AUSL BO (un
# utente portale autenticato poteva leggere/scrivere senza alcun permesso
# Django esplicito, oltre allo scope tenant di AuslBoScopedMixin). Per gli
# utenti interni il comportamento resta quello storico.
class CrmInventoryModelPermissions(BasePermission):
    """Utenti interni: comportamento storico (autenticazione basta in lettura,
    permessi Django standard add/change/delete in scrittura).
    Utenti portale AUSL BO "puri": stessa matrice R/W/D esplicita già usata
    per device/vlan (`AuslBoModelPermissions`)."""

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if _is_internal_user(user):
            return IsAuthenticatedDjangoModelPermissions().has_permission(request, view)
        return AuslBoModelPermissions().has_permission(request, view)

    def has_object_permission(self, request, view, obj) -> bool:
        user = getattr(request, "user", None)
        if _is_internal_user(user):
            return IsAuthenticatedDjangoModelPermissions().has_object_permission(request, view, obj)
        return AuslBoModelPermissions().has_object_permission(request, view, obj)


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
