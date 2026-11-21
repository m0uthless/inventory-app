"""Chi vede e chi modifica quali piani di manutenzione (decisione di Fede del 21/11).

Come le issue (`issues.visibility`):
- superuser o `maintenance.view_all_areas` → tutti;
- utente con un'area nel profilo → quelli della sua area e quelli senza area;
- utente senza area → tutti.
Modifica: un piano con un'area solo i membri di quell'area (o il superuser).
`user=None` (job di sistema) → nessun filtro.
"""
from __future__ import annotations

from django.db.models import Q

VIEW_ALL_AREAS_PERM = "maintenance.view_all_areas"


def _user_area_id(user):
    return getattr(getattr(user, "profile", None), "leave_area_id", None)


def visible_plans_q(user, prefix: str = "") -> Q:
    """Filtro sui piani visibili (``prefix`` per i lookup da un altro modello, es. ``"plan__"``)."""
    if user is None or not getattr(user, "is_authenticated", False):
        return Q()
    if user.is_superuser or user.has_perm(VIEW_ALL_AREAS_PERM):
        return Q()
    uid = _user_area_id(user)
    if uid is None:
        return Q()
    return Q(**{f"{prefix}area_id": uid}) | Q(**{f"{prefix}area__isnull": True})


def can_edit_plan(user, plan) -> bool:
    if plan is None or plan.area_id is None or getattr(user, "is_superuser", False):
        return True
    uid = _user_area_id(user)
    return uid is not None and uid == plan.area_id
