"""Moduli di Archie che un superuser può spegnere per tutti (pagina «Moduli»).

Un modulo spento sparisce per chi non è superuser: le sue API rispondono 404
(``core.middleware.ModuleSwitchMiddleware``), la ricerca e le notifiche non lo
mostrano, i job del cron lo saltano e il frontend toglie menu, pagine e
widget. I dati restano nel database. I superuser continuano a vederlo per
provarlo prima del rilascio.

«Modulo» qui è una funzionalità, non un'app Django: le API che servono anche
ad altri moduli restano accese. Per esempio, con il Piano ferie spento le
assenze dei tecnici ServiceNow (``/api/servicenow-technician-absences/``) e
le aree degli utenti (``/api/leave-areas/``, usate dai Task di area)
continuano a funzionare.

Il registro va tenuto allineato con ``frontend/src/modules/moduleRegistry.ts``.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from django.core.cache import cache


@dataclass(frozen=True)
class Module:
    key: str
    label: str
    # Segmenti di /api/<segmento>/ che appartengono solo a questo modulo.
    api: tuple[str, ...]
    # Tipi di risultato della ricerca globale (config/search_api.py).
    search_kinds: tuple[str, ...] = field(default=())
    # Tipi di notifica (notifications.models.NotificationType).
    notification_types: tuple[str, ...] = field(default=())


MODULES: tuple[Module, ...] = (
    Module("issues", "Issue", ("issues", "issue-categories")),
    Module("area_tasks", "Task di area", ("area-tasks",), notification_types=("area_task_due",)),
    Module(
        "maintenance",
        "Manutenzione",
        ("maintenance-plans", "maintenance-plan-inventories", "maintenance-events", "maintenance-notifications", "techs"),
        search_kinds=("maintenance_plan",),
        notification_types=("maintenance_due",),
    ),
    Module("servicenow", "ServiceNow", ("servicenow-cases", "servicenow-case-types", "servicenow-technician-absences")),
    Module("monitors", "Monitor", ("monitors",)),
    Module(
        "wiki",
        "Wiki",
        ("wiki-categories", "wiki-pages", "wiki-attachments", "wiki-links", "wiki-revisions", "wiki-queries",
         "wiki-query-languages", "wiki-stats"),
        search_kinds=("wiki_page",),
    ),
    Module("drive", "Drive", ("drive-folders", "drive-files"), search_kinds=("drive_folder", "drive_file")),
    Module("contracts", "Contratti", ("contracts", "sellers")),
    Module("purchase_orders", "Purchase Order", ("purchase-order-entries",)),
    Module(
        "expenses",
        "Rimborso spese",
        ("expense-reports", "expense-items", "expense-km-trips", "expense-receipts", "expense-km-rates"),
    ),
    Module("leave", "Piano ferie", ("absences", "leave-holidays")),
    Module("feedback", "Bug e feature", ("feedback-items",)),
    Module("text2sql", "Generatore SQL", ("text2sql",)),
)

MODULES_BY_KEY: dict[str, Module] = {m.key: m for m in MODULES}

_API_RE = re.compile(r"^/api/([a-z0-9-]+)(?:/|$)")
_SEGMENT_TO_MODULE: dict[str, str] = {seg: m.key for m in MODULES for seg in m.api}

CACHE_KEY = "core:disabled_modules:v1"
CACHE_TTL = 300


def disabled_modules() -> frozenset[str]:
    """Chiavi dei moduli spenti (in cache, invalidata a ogni modifica)."""
    cached = cache.get(CACHE_KEY)
    if cached is not None:
        return frozenset(cached)
    from core.models import ModuleSwitch

    keys = sorted(
        k for k in ModuleSwitch.objects.filter(enabled=False).values_list("key", flat=True) if k in MODULES_BY_KEY
    )
    cache.set(CACHE_KEY, keys, CACHE_TTL)
    return frozenset(keys)


def invalidate_cache() -> None:
    cache.delete(CACHE_KEY)


def is_module_enabled(key: str) -> bool:
    return key not in disabled_modules()


def module_for_path(path: str) -> str | None:
    """Modulo a cui appartiene un indirizzo /api/..., se è uno di quelli spegnibili."""
    m = _API_RE.match(path or "")
    return _SEGMENT_TO_MODULE.get(m.group(1)) if m else None


def user_sees_disabled(user) -> bool:
    """I superuser vedono anche i moduli spenti."""
    return bool(getattr(user, "is_superuser", False))


def hidden_modules_for(user) -> frozenset[str]:
    """Moduli da nascondere a questo utente."""
    return frozenset() if user_sees_disabled(user) else disabled_modules()


def hidden_search_kinds(user) -> frozenset[str]:
    return frozenset(k for key in hidden_modules_for(user) for k in MODULES_BY_KEY[key].search_kinds)


def hidden_notification_types(user) -> frozenset[str]:
    return frozenset(t for key in hidden_modules_for(user) for t in MODULES_BY_KEY[key].notification_types)
