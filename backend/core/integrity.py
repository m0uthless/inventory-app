"""Utilities to translate DB integrity errors into API-friendly validation errors.

We primarily use this to convert PostgreSQL unique constraint violations (raised as
django.db.IntegrityError) into DRF ValidationError with field-specific messages.

This avoids opaque 500s and improves UX on create/update endpoints.
"""

from __future__ import annotations

from typing import Mapping, Optional

from django.db import IntegrityError
from rest_framework import serializers


def _extract_pg_constraint_name(exc: BaseException) -> Optional[str]:
    """Best-effort extraction of the violated constraint name (psycopg3 / Postgres)."""

    candidates = [exc, getattr(exc, "__cause__", None), getattr(exc, "__context__", None)]
    for c in candidates:
        if not c:
            continue

        diag = getattr(c, "diag", None)
        name = getattr(diag, "constraint_name", None) if diag else None
        if name:
            return str(name)

        name = getattr(c, "constraint_name", None)
        if name:
            return str(name)

    # Fallback: parse from message (fragile, but better than nothing)
    msg = str(exc)
    marker = 'constraint "'
    if marker in msg:
        try:
            return msg.split(marker, 1)[1].split('"', 1)[0]
        except Exception:
            return None
    return None


def raise_integrity_error_as_validation(
    exc: IntegrityError,
    *,
    constraint_map: Mapping[str, Mapping[str, str]] | None = None,
    default_message: str = "Vincolo di unicità violato.",
) -> None:
    """Raise a DRF ValidationError from an IntegrityError."""

    cname = _extract_pg_constraint_name(exc)
    if cname and constraint_map and cname in constraint_map:
        raise serializers.ValidationError(constraint_map[cname])

    if cname:
        raise serializers.ValidationError({"detail": f"{default_message} ({cname})"})
    raise serializers.ValidationError({"detail": default_message})
