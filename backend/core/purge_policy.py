from __future__ import annotations

from typing import Any

from django.db.models.deletion import ProtectedError


def _append_blocker(blockers: list[dict[str, Any]], label: str, rel) -> None:
    try:
        count = rel.count()
    except Exception:
        try:
            count = rel.all().count()
        except Exception:
            count = 0
    if count:
        blockers.append({"label": label, "count": int(count)})



def get_purge_blockers(obj: Any) -> list[dict[str, Any]]:
    """Return dependency blockers for a hard-delete purge.

    We intentionally count *all* dependent rows, including already soft-deleted
    ones, because DB-level PROTECT still blocks hard deletion in those cases.
    """

    from crm.models import Customer, Site, Contact
    from inventory.models import Inventory
    from maintenance.models import MaintenancePlan, Tech

    blockers: list[dict[str, Any]] = []

    if isinstance(obj, Customer):
        _append_blocker(blockers, "siti", obj.sites)
        _append_blocker(blockers, "contatti", obj.contacts)
        _append_blocker(blockers, "inventari", obj.inventories)
        _append_blocker(blockers, "piani manutenzione", obj.maintenance_plans)
        if hasattr(obj, "issues"):
            _append_blocker(blockers, "issue", obj.issues)
        return blockers

    if isinstance(obj, Site):
        _append_blocker(blockers, "contatti", obj.contacts)
        _append_blocker(blockers, "inventari", obj.inventories)
        return blockers

    if isinstance(obj, Contact):
        return blockers

    if isinstance(obj, Inventory):
        if hasattr(obj, "maintenance_events"):
            _append_blocker(blockers, "rapportini manutenzione", obj.maintenance_events)
        if hasattr(obj, "notifications"):
            _append_blocker(blockers, "notifiche manutenzione", obj.notifications)
        return blockers

    if isinstance(obj, MaintenancePlan):
        _append_blocker(blockers, "rapportini manutenzione", obj.events)
        _append_blocker(blockers, "notifiche manutenzione", obj.notifications)
        return blockers

    if isinstance(obj, Tech):
        _append_blocker(blockers, "rapportini manutenzione", obj.events)
        return blockers

    return blockers



def build_purge_blocked_reason(blockers: list[dict[str, Any]]) -> str:
    if not blockers:
        return ""
    bits = ", ".join(f"{b['count']} {b['label']}" for b in blockers)
    return (
        "Impossibile eliminare definitivamente: sono presenti dipendenze collegate "
        f"({bits}). Elimina prima gli elementi dipendenti."
    )



def try_purge_instance(obj: Any) -> tuple[bool, str | None, list[dict[str, Any]]]:
    blockers = get_purge_blockers(obj)
    if blockers:
        return False, build_purge_blocked_reason(blockers), blockers

    try:
        obj.delete()
        return True, None, []
    except ProtectedError as exc:
        protected = getattr(exc, "protected_objects", None)
        count = len(list(protected)) if protected is not None else 0
        blockers = [{"label": "dipendenze protette", "count": count}] if count else []
        reason = (
            build_purge_blocked_reason(blockers)
            if blockers
            else "Impossibile eliminare definitivamente: sono presenti dipendenze protette collegate."
        )
        return False, reason, blockers
