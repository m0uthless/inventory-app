from __future__ import annotations

from rest_framework.permissions import BasePermission, SAFE_METHODS


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

    Unico criterio: esiste un AuslBoUserProfile attivo.
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
            user_id=user.pk, is_active=True
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
