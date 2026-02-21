from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from rest_framework import serializers

from custom_fields.models import CustomFieldDefinition


def _norm_key(s: str) -> str:
    """Normalize keys for alias matching.

    - trim
    - casefold
    - remove common accents
    - remove apostrophes
    """
    return (
        (s or "")
        .strip()
        .casefold()
        .replace("à", "a")
        .replace("á", "a")
        .replace("â", "a")
        .replace("ä", "a")
        .replace("è", "e")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("ì", "i")
        .replace("í", "i")
        .replace("ò", "o")
        .replace("ó", "o")
        .replace("ù", "u")
        .replace("ú", "u")
        .replace("'", "")
    )


SENSITIVE_KEYWORDS = ("password", "pwd", "secret", "token", "key")


def _looks_sensitive(key: str) -> bool:
    k = _norm_key(key)
    return any(kw in k for kw in SENSITIVE_KEYWORDS)


@dataclass
class DefMaps:
    defs_by_key: Dict[str, CustomFieldDefinition]
    alias_to_key: Dict[str, str]


def get_definition_maps(entity: str) -> DefMaps:
    defs = list(
        CustomFieldDefinition.objects.filter(
            entity=entity,
            is_active=True,
            deleted_at__isnull=True,
        ).order_by("sort_order", "label", "key")
    )
    defs_by_key: Dict[str, CustomFieldDefinition] = {d.key: d for d in defs}
    alias_to_key: Dict[str, str] = {}
    for d in defs:
        alias_to_key[_norm_key(d.key)] = d.key
        for a in (d.aliases or []):
            alias_to_key[_norm_key(str(a))] = d.key
    return DefMaps(defs_by_key=defs_by_key, alias_to_key=alias_to_key)


def _coerce_bool(v: Any) -> Optional[bool]:
    if v is None or v == "":
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    s = str(v).strip().casefold()
    if s in {"1", "true", "yes", "y", "on"}:
        return True
    if s in {"0", "false", "no", "n", "off"}:
        return False
    return None


def _coerce_number(v: Any) -> Optional[float | int]:
    if v is None or v == "":
        return None
    if isinstance(v, bool):
        return 1 if v else 0
    if isinstance(v, (int, float)):
        return v
    s = str(v).strip().replace(",", ".")
    if not s:
        return None
    try:
        f = float(s)
    except ValueError:
        return None
    if f.is_integer():
        return int(f)
    return f


def _coerce_date(v: Any) -> Optional[str]:
    if v is None or v == "":
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, datetime):
        return v.date().isoformat()
    s = str(v).strip()
    if not s:
        return None
    # Expect ISO date YYYY-MM-DD (UI uses this)
    try:
        date.fromisoformat(s)
        return s
    except ValueError:
        return None


def normalize_and_validate_custom_fields(
    *,
    entity: str,
    incoming: Any,
    existing: Optional[Dict[str, Any]] = None,
    partial: bool = False,
) -> Optional[Dict[str, Any]]:
    """Normalize aliases and validate values against definitions.

    - Keeps unknown keys (no definitions) untouched.
    - Canonicalizes known keys to definition.key.
    - Enforces required fields (using merged state for partial updates).
    """

    if incoming is None:
        # If not provided at all, caller should skip.
        return None

    if incoming == {}:
        incoming_dict: Dict[str, Any] = {}
    elif isinstance(incoming, dict):
        incoming_dict = dict(incoming)
    else:
        raise serializers.ValidationError({"custom_fields": "Deve essere un oggetto JSON."})

    existing_dict: Dict[str, Any] = dict(existing or {})

    maps = get_definition_maps(entity)

    # First pass: canonicalize keys in the incoming payload
    normalized: Dict[str, Any] = {}

    # Start from existing if partial, then overlay incoming.
    base: Dict[str, Any] = dict(existing_dict) if partial else {}

    # Copy base as-is (unknown keys preserved)
    normalized.update(base)

    for raw_key, raw_val in incoming_dict.items():
        if raw_key is None:
            continue
        key_str = str(raw_key)
        norm = _norm_key(key_str)
        canonical_key = maps.alias_to_key.get(norm)
        if canonical_key:
            normalized[canonical_key] = raw_val
        else:
            # unknown key, keep verbatim
            normalized[key_str] = raw_val

    # Now validate known keys
    errors: Dict[str, str] = {}

    for key, d in maps.defs_by_key.items():
        val = normalized.get(key)

        # Coerce based on type
        coerced: Any = val
        if d.field_type == CustomFieldDefinition.FieldType.TEXT:
            if val is None:
                coerced = None
            elif isinstance(val, str):
                coerced = val
            else:
                # allow simple coercion to string
                coerced = str(val)

        elif d.field_type == CustomFieldDefinition.FieldType.NUMBER:
            coerced = _coerce_number(val)
            if val not in (None, "") and coerced is None:
                errors[key] = "Numero non valido."

        elif d.field_type == CustomFieldDefinition.FieldType.BOOLEAN:
            coerced = _coerce_bool(val)
            if val not in (None, "") and coerced is None:
                errors[key] = "Valore boolean non valido."

        elif d.field_type == CustomFieldDefinition.FieldType.DATE:
            coerced = _coerce_date(val)
            if val not in (None, "") and coerced is None:
                errors[key] = "Data non valida (atteso YYYY-MM-DD)."

        elif d.field_type == CustomFieldDefinition.FieldType.SELECT:
            if val is None or val == "":
                coerced = None
            else:
                coerced = str(val)
                opts = d.options or []
                if isinstance(opts, dict):
                    # allow {value: label}
                    allowed = set(str(k) for k in opts.keys())
                elif isinstance(opts, list):
                    allowed = set(str(x) for x in opts)
                else:
                    allowed = set()
                if allowed and coerced not in allowed:
                    errors[key] = "Valore non ammesso."

        normalized[key] = coerced

        # Required check (after coercion)
        if d.required:
            missing = coerced is None or (isinstance(coerced, str) and not coerced.strip())
            if missing:
                errors[key] = "Campo obbligatorio."

        # Optional: prevent storing secrets in audit/diffs if user tries
        # (we still store the value; audit masking is handled elsewhere)

    if errors:
        raise serializers.ValidationError({"custom_fields": errors})

    # Clean: drop empty strings and None for known keys if not required
    for key, d in maps.defs_by_key.items():
        if not d.required:
            v = normalized.get(key)
            if v is None or (isinstance(v, str) and not v.strip()):
                normalized.pop(key, None)

    # If result is empty, use None
    if not normalized:
        return None

    return normalized
