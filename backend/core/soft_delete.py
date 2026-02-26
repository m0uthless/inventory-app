"""Shared soft-delete query filtering.

The project uses a consistent convention:

- ?include_deleted=1  -> include active + soft-deleted
- ?only_deleted=1     -> only soft-deleted

Additionally, the `restore` action must be able to "see" soft-deleted rows,
so it behaves like include_deleted=1.

Centralizing this logic reduces subtle inconsistencies between apps.
"""

from __future__ import annotations

from typing import Any, Mapping


TRUTHY = {"1", "true", "yes", "on"}


def apply_soft_delete_filters(
    qs,
    *,
    request: Any | None = None,
    query_params: Mapping[str, Any] | None = None,
    action_name: str | None = None,
    include_deleted: str | None = None,
    only_deleted: str | None = None,
):
    """Apply the standard soft-delete filters to a queryset.

    You can pass either:
    - `request` (DRF request)
    - `query_params` (dict-like)
    or directly provide `include_deleted`/`only_deleted` strings.
    """

    if query_params is None and request is not None:
        query_params = getattr(request, "query_params", None)

    if include_deleted is None:
        include_deleted = (query_params.get("include_deleted") if query_params else "") or ""
    if only_deleted is None:
        only_deleted = (query_params.get("only_deleted") if query_params else "") or ""

    include_deleted = str(include_deleted).strip().lower()
    only_deleted = str(only_deleted).strip().lower()

    # `restore` must be able to see soft-deleted objects
    if (action_name or "") == "restore":
        include_deleted = "1"

    if only_deleted in TRUTHY:
        return qs.filter(deleted_at__isnull=False)
    if include_deleted in TRUTHY:
        return qs
    return qs.filter(deleted_at__isnull=True)
