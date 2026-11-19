"""Chi può fare da tecnico ServiceNow e chi da assegnatario delle issue.

Dal 2026-11-19 lo decidono due permessi distinti, assegnati ai gruppi dalla
pagina Gruppi (prima: flag `UserProfile.is_servicenow_technician`):

- ``servicenow.be_technician`` — tecnico ServiceNow (case, statistiche,
  assenze tecnici);
- ``issues.be_assignee`` — assegnatario delle issue (e destinatario
  dell'email "nuova issue").

Il superuser NON è tecnico/assegnatario per il solo fatto di esserlo
(``include_superusers=False``; mai ``user.has_perm``, sempre vero per lui).

B-22 (QA 2026-11-15) resta valido: oltre al permesso serve una persona
interna, così un cliente del Portal a cui è stato dato il permesso per errore
non diventa assegnabile.
- tecnico: accesso ad Archie, oppure tecnico Philips o account funzionale
  (profili circoscritti a ServiceNow senza `core.access_archie`);
- assegnatario issue: accesso ad Archie.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q

TECHNICIAN_PERM = "servicenow.be_technician"
ISSUE_ASSIGNEE_PERM = "issues.be_assignee"


def _with_perm(perm: str):
    return get_user_model().objects.with_perm(perm, include_superusers=False, is_active=True).values("pk")


def _archie_users():
    return get_user_model().objects.with_perm("core.access_archie").values("pk")


def eligible_technician_q(prefix: str = "") -> Q:
    """Filtro sugli utenti (``prefix`` per il lookup da un altro modello,
    es. ``"user__"``) con il permesso tecnico e un profilo interno."""
    return Q(**{f"{prefix}pk__in": _with_perm(TECHNICIAN_PERM)}) & (
        Q(**{f"{prefix}pk__in": _archie_users()})
        | Q(**{f"{prefix}profile__is_philips": True})
        | Q(**{f"{prefix}profile__is_functional_account": True})
    )


def is_eligible_technician(user) -> bool:
    """Versione per singolo utente di :func:`eligible_technician_q`."""
    if user is None or not getattr(user, "pk", None):
        return False
    return get_user_model().objects.filter(eligible_technician_q(), pk=user.pk).exists()


def eligible_issue_assignee_q(prefix: str = "") -> Q:
    """Filtro sugli utenti assegnabili alle issue (permesso + accesso Archie)."""
    return Q(**{f"{prefix}pk__in": _with_perm(ISSUE_ASSIGNEE_PERM)}) & Q(**{f"{prefix}pk__in": _archie_users()})


def is_eligible_issue_assignee(user) -> bool:
    """Versione per singolo utente di :func:`eligible_issue_assignee_q`."""
    if user is None or not getattr(user, "pk", None):
        return False
    return get_user_model().objects.filter(eligible_issue_assignee_q(), pk=user.pk).exists()
