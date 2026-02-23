from __future__ import annotations

import json
import re
from typing import Any

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from rest_framework.request import Request

from audit.models import AuditEvent, AuthAttempt


# Broad pattern: we prefer masking too much rather than too little.
SENSITIVE_FIELD_RE = re.compile(
    r"(password|pwd|secret|token|api[_-]?key|passphrase|private[_-]?key)",
    re.IGNORECASE,
)


def _mask_value(value: Any) -> Any:
    """Return a masked placeholder if value looks set."""

    if value in (None, "", [], {}, ()):
        return value
    return "••••"


def _get_sensitive_custom_field_keys(keys: list[str]) -> set[str]:
    """Return the subset of keys that are marked as `is_sensitive`.

    We query dynamically to avoid hard dependencies during app startup.
    """

    if not keys:
        return set()

    try:
        from custom_fields.models import CustomFieldDefinition

        qs = CustomFieldDefinition.objects.filter(
            deleted_at__isnull=True,
            is_sensitive=True,
            key__in=keys,
        ).values_list("key", flat=True)
        return set(qs)
    except Exception:
        # DB not ready or app not installed; fall back to regex masking only.
        return set()


def to_primitive(val: Any) -> Any:
    """Convert values to JSON-serializable primitives."""

    if val is None:
        return None

    if isinstance(val, (str, int, float, bool)):
        return val

    # dates / datetimes
    if hasattr(val, "isoformat"):
        try:
            return val.isoformat()
        except Exception:
            pass

    # dicts / lists
    if isinstance(val, dict):
        return {str(k): to_primitive(v) for k, v in val.items()}

    if isinstance(val, (list, tuple, set)):
        return [to_primitive(v) for v in val]

    # Fallback
    return str(val)


def to_change_value(val: Any) -> Any:
    """Convert and mask values for audit logs.

    Fix in v0.3.0:
    - mask sensitive *nested* keys (e.g. custom_fields.password)
    - also honor CustomFieldDefinition.is_sensitive
    """

    if isinstance(val, dict):
        keys = [str(k) for k in val.keys()]
        sensitive_custom = _get_sensitive_custom_field_keys(keys)

        out: dict[str, Any] = {}
        for k, v in val.items():
            ks = str(k)
            if SENSITIVE_FIELD_RE.search(ks) or ks in sensitive_custom:
                out[ks] = _mask_value(v)
            else:
                out[ks] = to_change_value(v)
        return out

    if isinstance(val, (list, tuple, set)):
        return [to_change_value(v) for v in val]

    return to_primitive(val)


def to_change_value_for_field(field_name: str, value: Any) -> Any:
    # Top-level masking
    if SENSITIVE_FIELD_RE.search(field_name):
        return _mask_value(value)
    return to_change_value(value)


def build_changes(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    changes: dict[str, Any] = {}
    for k in set(before.keys()) | set(after.keys()):
        b = before.get(k)
        a = after.get(k)
        if b != a:
            changes[k] = {
                "before": to_change_value_for_field(k, b),
                "after": to_change_value_for_field(k, a),
            }
    return changes


def _request_metadata(request: Request | None) -> dict[str, Any]:
    if not request:
        return {}

    meta = getattr(request, "META", {}) or {}

    xff = meta.get("HTTP_X_FORWARDED_FOR", "")
    ip = (xff.split(",")[0].strip() if xff else "") or meta.get("REMOTE_ADDR")

    data: dict[str, Any] = {
        "path": getattr(request, "path", None),
        "method": getattr(request, "method", None),
        "ip": ip,
        "user_agent": meta.get("HTTP_USER_AGENT"),
    }

    try:
        data["query_params"] = dict(request.query_params)
    except Exception:
        pass

    return data


def log_event(
    actor,
    action: str,
    instance=None,
    changes: dict[str, Any] | None = None,
    request: Request | None = None,
    metadata: dict[str, Any] | None = None,
):
    """Create an AuditEvent row.

    `actor` can be an authenticated user or AnonymousUser.
    """

    ct = ContentType.objects.get_for_model(instance.__class__) if instance is not None else None

    meta = _request_metadata(request)
    if metadata:
        meta.update(metadata)

    AuditEvent.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        content_type=ct,
        object_id=str(getattr(instance, "pk", "")) if instance is not None else "",
        object_repr=str(instance) if instance is not None else "",
        changes=changes or {},
        metadata=meta,
    )


def log_auth_attempt(username: str, success: bool, request: Request | None = None):
    meta = _request_metadata(request)
    AuthAttempt.objects.create(
        username=username,
        success=success,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
    )
