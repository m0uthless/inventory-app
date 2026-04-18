from __future__ import annotations

from typing import Any

from django.db.models.deletion import ProtectedError


def _append_blocker(blockers: list[dict[str, Any]], label: str, rel) -> None:
    """Count ONLY active (non-soft-deleted) rows as blockers.

    Soft-deleted dependents are not a real semantic constraint — they are already
    logically removed and will be cascade-hard-deleted by _purge_soft_deleted_children
    before the parent is hard-deleted. Only active rows represent real data that
    would be orphaned and must block the purge.

    Note: DB-level PROTECT still fires on ANY row (active or soft-deleted), so
    try_purge_instance must call _purge_soft_deleted_children before obj.delete().
    """
    try:
        active_rel = rel.filter(deleted_at__isnull=True)
        count = active_rel.count()
    except Exception:
        # Fallback for relations that don't support .filter() (e.g. M2M without deleted_at)
        try:
            count = rel.count()
        except Exception:
            count = 0
    if count:
        blockers.append({"label": label, "count": int(count)})


def _purge_soft_deleted_children(obj: Any) -> None:
    """Hard-delete all soft-deleted (deleted_at__isnull=False) dependent rows
    that would otherwise trigger a DB-level ProtectedError when the parent is purged.

    This is safe because:
    - The children are already logically deleted (deleted_at is set).
    - The parent is also soft-deleted (it's in the trash).
    - We only reach this function after confirming zero active children.
    """
    from maintenance.models import MaintenancePlan, Tech
    from inventory.models import Inventory

    if isinstance(obj, MaintenancePlan):
        obj.events.filter(deleted_at__isnull=False).delete()
        obj.notifications.filter(deleted_at__isnull=False).delete()
        return

    if isinstance(obj, Tech):
        obj.events.filter(deleted_at__isnull=False).delete()
        return

    if isinstance(obj, Inventory):
        if hasattr(obj, "maintenance_events"):
            obj.maintenance_events.filter(deleted_at__isnull=False).delete()
        if hasattr(obj, "notifications"):
            obj.notifications.filter(deleted_at__isnull=False).delete()
        # Monitor con SET_NULL: null-out invece di hard-delete per preservare la storia.
        # Questo evita che il FK non-nullable del monitor diventi un vincolo bloccante.
        if hasattr(obj, "monitors"):
            obj.monitors.filter(deleted_at__isnull=False).update(inventory=None)
        return


def get_purge_blockers(obj: Any) -> list[dict[str, Any]]:
    """Return dependency blockers for a hard-delete purge.

    Only counts ACTIVE (non-soft-deleted) dependent rows. Soft-deleted children
    are handled transparently by _purge_soft_deleted_children inside try_purge_instance.
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
        "Impossibile eliminare definitivamente: sono presenti dipendenze attive collegate "
        f"({bits}). Elimina prima gli elementi dipendenti."
    )


def try_purge_instance(obj: Any) -> tuple[bool, str | None, list[dict[str, Any]]]:
    # Check for active (non-soft-deleted) blockers only.
    blockers = get_purge_blockers(obj)
    if blockers:
        return False, build_purge_blocked_reason(blockers), blockers

    # Cascade-hard-delete soft-deleted children so DB PROTECT doesn't fire.
    _purge_soft_deleted_children(obj)

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
