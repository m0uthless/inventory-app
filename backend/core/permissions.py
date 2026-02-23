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
    """Allow access to staff/superusers OR users in the `admin` group.

    Useful for endpoints that are not tied to a model/queryset (e.g. API docs).
    """

    admin_group_name = "admin"

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False

        if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
            return True

        return bool(user.groups.filter(name=self.admin_group_name).exists())
