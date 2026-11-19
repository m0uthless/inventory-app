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


def grant_via_group(user, perm: str):
    """Dà ``perm`` ("app.codename") a ``user`` tramite un gruppo dedicato,
    come si fa dalla pagina Gruppi."""
    from django.contrib.auth.models import Group, Permission

    app_label, codename = perm.split(".", 1)
    group, _ = Group.objects.get_or_create(name=f"test:{perm}")
    group.permissions.add(Permission.objects.get(content_type__app_label=app_label, codename=codename))
    user.groups.add(group)
    return user


def make_technician(*args, **kwargs):
    """Utente interno con il permesso di gruppo "È tecnico ServiceNow"."""
    return grant_via_group(make_archie_user(*args, **kwargs), "servicenow.be_technician")


def make_issue_assignee(*args, **kwargs):
    """Utente interno con il permesso di gruppo "Può essere assegnatario delle issue"."""
    return grant_via_group(make_archie_user(*args, **kwargs), "issues.be_assignee")
