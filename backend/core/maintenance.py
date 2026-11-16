"""Modalità manutenzione: con la manutenzione attiva Archie è chiuso a chi
non è superuser (login rifiutato, sessioni interne chiuse alla prima
richiesta). Il Portal clienti resta aperto: vale solo per le sessioni con
ambito diverso da "portal".
"""
from __future__ import annotations

from django.core.cache import cache

CACHE_KEY = "core:maintenance_mode:v1"
CACHE_TTL = 300
DEFAULT_MESSAGE = "Archie è in manutenzione. Riprova più tardi."


def state() -> dict:
    """{"active": bool, "message": str} (in cache, invalidata a ogni modifica)."""
    cached = cache.get(CACHE_KEY)
    if cached is not None:
        return cached
    from core.models import MaintenanceMode

    row = MaintenanceMode.objects.filter(pk=1).first()
    value = {
        "active": bool(row and row.active),
        "message": (row.message.strip() if row and row.message else "") or DEFAULT_MESSAGE,
    }
    cache.set(CACHE_KEY, value, CACHE_TTL)
    return value


def invalidate_cache() -> None:
    cache.delete(CACHE_KEY)


def blocks(user, ambito: str | None) -> bool:
    """True se la manutenzione deve chiudere fuori questo utente da Archie."""
    if ambito == "portal":
        return False
    if getattr(user, "is_superuser", False):
        return False
    return state()["active"]
