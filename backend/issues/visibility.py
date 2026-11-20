"""Chi vede quali issue (spec 2026-11-19, Parte 3).

- superuser o permesso `issues.view_all_areas` → tutte;
- utente con un'area nel profilo (`UserProfile.leave_area`) → quelle della sua
  area e quelle senza area;
- utente senza area nel profilo → tutte (come il contatore della barra).

Restrizione vera: la applicano tutte le letture di issue (viewset, riepilogo,
conteggi di clienti/siti/inventari, etichette dei link Wiki). Le email
automatiche no: vanno all'assegnatario, che è dell'area per costruzione.
"""
from __future__ import annotations

from django.db.models import Q

VIEW_ALL_AREAS_PERM = "issues.view_all_areas"


def can_see_all_areas(user) -> bool:
    return bool(getattr(user, "is_superuser", False) or (user is not None and user.has_perm(VIEW_ALL_AREAS_PERM)))


def user_area_id(user):
    """Area del profilo dell'utente, o None."""
    return getattr(getattr(user, "profile", None), "leave_area_id", None)


def own_area_q(user, prefix: str = "") -> Q:
    """Issue della propria area più quelle senza area (Q vuota senza area)."""
    uid = user_area_id(user)
    if uid is None:
        return Q()
    return Q(**{f"{prefix}area_id": uid}) | Q(**{f"{prefix}area__isnull": True})


def visible_issues_q(user, prefix: str = "") -> Q:
    """Filtro sulle issue visibili a ``user`` (``prefix`` per i lookup da un
    altro modello, es. ``"issues__"``)."""
    if user is None or can_see_all_areas(user):
        return Q()
    return own_area_q(user, prefix)
