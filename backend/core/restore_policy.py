from __future__ import annotations

from typing import Iterable


def get_restore_block_reason(instance) -> str | None:
    """Return a human-readable reason when an object cannot be restored yet.

    Current policy: a soft-deleted child cannot be restored while one of its
    required parent records is still in the trash.
    """

    model_label = instance._meta.label_lower

    if model_label == "crm.site":
        customer = getattr(instance, "customer", None)
        if customer is not None and getattr(customer, "deleted_at", None) is not None:
            return "Il cliente collegato è ancora nel cestino. Ripristina prima il cliente."
        return None

    if model_label == "crm.contact":
        customer = getattr(instance, "customer", None)
        site = getattr(instance, "site", None)
        if customer is not None and getattr(customer, "deleted_at", None) is not None:
            return "Il cliente collegato è ancora nel cestino. Ripristina prima il cliente."
        if site is not None and getattr(site, "deleted_at", None) is not None:
            return "Il sito collegato è ancora nel cestino. Ripristina prima il sito."
        return None

    if model_label == "inventory.inventory":
        customer = getattr(instance, "customer", None)
        site = getattr(instance, "site", None)
        if customer is not None and getattr(customer, "deleted_at", None) is not None:
            return "Il cliente collegato è ancora nel cestino. Ripristina prima il cliente."
        if site is not None and getattr(site, "deleted_at", None) is not None:
            return "Il sito collegato è ancora nel cestino. Ripristina prima il sito."
        return None

    if model_label == "maintenance.maintenanceplan":
        customer = getattr(instance, "customer", None)
        if customer is not None and getattr(customer, "deleted_at", None) is not None:
            return "Il cliente collegato è ancora nel cestino. Ripristina prima il cliente."
        return None

    return None


def split_restorable(instances: Iterable[object]) -> tuple[list[object], list[dict[str, object]]]:
    restorable: list[object] = []
    blocked: list[dict[str, object]] = []
    for obj in instances:
        reason = get_restore_block_reason(obj)
        if reason:
            blocked.append({"id": getattr(obj, "id", None), "reason": reason})
        else:
            restorable.append(obj)
    return restorable, blocked
