from rest_framework.exceptions import NotAuthenticated
from rest_framework.permissions import BasePermission, DjangoModelPermissions


class IsAuthenticatedDjangoModelPermissions(DjangoModelPermissions):
    """Like DjangoModelPermissions, but unauthenticated users get 401 (not 403)."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            raise NotAuthenticated()
        return super().has_permission(request, view)


class CanRestoreModelPermission(BasePermission):
    """Permission for `restore` actions.

    Uses the model behind the viewset and checks for the standard Django
    `change_<model>` permission.

    This avoids DRF's default mapping where POST would require `add_<model>`.
    """

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        model = None
        qs = getattr(view, "queryset", None)
        if qs is not None and getattr(qs, "model", None) is not None:
            model = qs.model
        else:
            try:
                model = view.get_queryset().model
            except Exception:
                model = None

        if model is None:
            return False

        perm = f"{model._meta.app_label}.change_{model._meta.model_name}"
        return bool(user.has_perm(perm))
