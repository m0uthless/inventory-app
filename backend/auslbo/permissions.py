from __future__ import annotations

from rest_framework.permissions import BasePermission, SAFE_METHODS

# ─── Gruppi Archie (frontend principale) ──────────────────────────────────────
ARCHIE_GROUPS = {"admin", "editor", "user"}

# ─── Gruppi AUSL BO (portal) ──────────────────────────────────────────────────
# Include "auslbo_users" come alias legacy per compatibilità con utenti esistenti
# finché non vengono migrati al nuovo schema.
AUSLBO_GROUPS        = {"admin_auslbo", "editor_auslbo", "user_auslbo", "auslbo_users"}
AUSLBO_EDITOR_GROUPS = {"admin_auslbo", "editor_auslbo"}
AUSLBO_ADMIN_GROUPS  = {"admin_auslbo"}


def _user_groups(user) -> set[str]:
    try:
        return set(user.groups.values_list("name", flat=True))
    except Exception:
        return set()


def _can_access_archie(user) -> bool:
    """True se l'utente può accedere al frontend Archie principale.

    Criteri (OR):
    - is_staff o is_superuser  → override di sistema (backward-compat)
    - gruppo admin, editor o user
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True
    return bool(_user_groups(user) & ARCHIE_GROUPS)


def _is_auslbo_user(user) -> bool:
    """True se l'utente può accedere al portal AUSL BO.

    Criteri: almeno un gruppo AUSL BO E AuslBoUserProfile esistente.
    Supporta il gruppo legacy "auslbo_users" per compatibilità.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not (_user_groups(user) & AUSLBO_GROUPS):
        return False
    try:
        from auslbo.models import AuslBoUserProfile
        return AuslBoUserProfile.objects.filter(user_id=user.pk).exists()
    except Exception:
        return False


def _can_edit_auslbo(user) -> bool:
    """True se l'utente può scrivere nel portal AUSL BO.

    Criteri (OR):
    - is_staff o is_superuser  → override di sistema
    - gruppo admin_auslbo o editor_auslbo
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True
    return bool(_user_groups(user) & AUSLBO_EDITOR_GROUPS)


def _can_admin_archie(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True
    return "admin" in _user_groups(user)


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


class IsAuslBoUser(BasePermission):
    message = "Accesso riservato agli utenti del portal AUSL BO."

    def has_permission(self, request, view) -> bool:
        return _is_auslbo_user(request.user)


class IsInternalUser(BasePermission):
    message = "Accesso riservato agli utenti interni."

    def has_permission(self, request, view) -> bool:
        return _is_internal_user(request.user)


class IsAuslBoUserOrInternal(BasePermission):
    message = "Autenticazione richiesta."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return _is_auslbo_user(user) or _can_access_archie(user)


class IsAuslBoEditor(BasePermission):
    message = "Operazione riservata agli editor AUSL BO (editor_auslbo, admin_auslbo, is_staff o superuser)."

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return _can_edit_auslbo(request.user)


class IsArchieAdmin(BasePermission):
    message = "Operazione riservata agli amministratori di Archie."

    def has_permission(self, request, view) -> bool:
        return _can_admin_archie(request.user)
