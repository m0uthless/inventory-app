"""Helper condivisi dai test."""
from __future__ import annotations


def make_archie_user(*args, **kwargs):
    """Come ``User.objects.create_user`` ma con ``core.access_archie``, cioè
    un utente interno reale: dalla H-01 (QA 2026-11-15) la barriera
    ``IsInternalOrPortalDedicatedApp`` lo richiede per ogni sessione non-Portal."""
    from django.contrib.auth import get_user_model
    from django.contrib.auth.models import Permission

    user = get_user_model().objects.create_user(*args, **kwargs)
    user.user_permissions.add(Permission.objects.get(content_type__app_label="core", codename="access_archie"))
    return user
