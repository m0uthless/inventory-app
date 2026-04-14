from __future__ import annotations

from rest_framework.permissions import BasePermission, DjangoModelPermissions


class IsAuthenticatedDjangoModelPermissions(DjangoModelPermissions):
    """Same as DRF's DjangoModelPermissions, but requires authentication."""

    authenticated_users_only = True


class CanRestoreModelPermission(BasePermission):
    """Generic permission helper for `restore` actions.

    By default it requires the `change` permission for the view's model.
    A view can override this by defining `restore_permission`.
    """

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False

        explicit = getattr(view, "restore_permission", None)
        if explicit:
            return bool(user.has_perm(explicit))

        # Infer from queryset model (common for ModelViewSet)
        try:
            model = view.get_queryset().model
            app_label = model._meta.app_label
            model_name = model._meta.model_name
            return bool(user.has_perm(f"{app_label}.change_{model_name}"))
        except Exception:
            return False


class IsStaffOrAdminGroup(BasePermission):
    """Accesso a superuser o utenti con permesso core.access_archie.

    Usato per endpoint non legati a un modello/queryset (es. API docs).
    Il nome del gruppo non è hardcoded: il permesso viene assegnato
    liberamente a qualsiasi gruppo tramite Django Admin.
    """

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        if getattr(user, "is_superuser", False):
            return True
        return bool(user.has_perm("core.access_archie"))


class CanPurgeModelPermission(BasePermission):
    """Generic permission helper for `purge` actions (hard delete).

    By default it requires the `delete` permission for the view's model.
    A view can override this by defining `purge_permission`.
    """

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False

        explicit = getattr(view, "purge_permission", None)
        if explicit:
            return bool(user.has_perm(explicit))

        try:
            model = view.get_queryset().model
            app_label = model._meta.app_label
            model_name = model._meta.model_name
            return bool(user.has_perm(f"{app_label}.delete_{model_name}"))
        except Exception:
            return False



def user_has_model_perm(user, model, action: str) -> bool:
    """Return whether user has the Django model permission for the given action."""

    if not user or not getattr(user, "is_authenticated", False):
        return False
    app_label = model._meta.app_label
    model_name = model._meta.model_name
    return bool(user.has_perm(f"{app_label}.{action}_{model_name}"))
