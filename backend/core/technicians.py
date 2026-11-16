"""Chi può fare da tecnico (case ServiceNow, issue, assenze tecnici).

B-22 (QA 2026-11-15): il flag `UserProfile.is_servicenow_technician` nasceva
True per ogni utente, clienti del Portal compresi, che così risultavano
assegnabili ai case e destinatari dell'email "nuova issue". Oltre al flag,
un tecnico deve essere una persona interna: accesso ad Archie, oppure tecnico
Philips o account funzionale (profili circoscritti a ServiceNow che per
scelta non hanno `core.access_archie`).
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q


def eligible_technician_q(prefix: str = "") -> Q:
    """Filtro sugli utenti (``prefix`` per il lookup da un altro modello,
    es. ``"user__"``) con il flag tecnico e un profilo interno."""
    users_with_archie = get_user_model().objects.with_perm("core.access_archie").values("pk")
    return Q(**{f"{prefix}profile__is_servicenow_technician": True}) & (
        Q(**{f"{prefix}pk__in": users_with_archie})
        | Q(**{f"{prefix}profile__is_philips": True})
        | Q(**{f"{prefix}profile__is_functional_account": True})
    )


def is_eligible_technician(user) -> bool:
    """Versione per singolo utente di :func:`eligible_technician_q`."""
    if user is None:
        return False
    profile = getattr(user, "profile", None)
    if profile is None or not profile.is_servicenow_technician:
        return False
    if profile.is_philips or profile.is_functional_account:
        return True
    from portal.permissions import _can_access_archie

    return _can_access_archie(user)
