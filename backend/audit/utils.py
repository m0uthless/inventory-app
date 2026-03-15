from __future__ import annotations

import json
import re
import logging
import ipaddress
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


logger = logging.getLogger(__name__)
from django.conf import settings
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


def _parse_ip(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    if not v:
        return None
    try:
        return str(ipaddress.ip_address(v))
    except Exception:
        return None


def _client_ip_from_meta(meta: dict[str, Any]) -> tuple[str | None, str | None]:
    """Return (ip, xff_raw). By default we *do not* trust X-Forwarded-For.

    To trust XFF set:
      - AUDIT_TRUST_X_FORWARDED_FOR=True
        OR
      - AUDIT_TRUSTED_PROXIES=["127.0.0.1", ...] and have REMOTE_ADDR match one.
    """

    remote_addr = _parse_ip(str(meta.get("REMOTE_ADDR") or "")) if meta else None
    xff_raw = (meta.get("HTTP_X_FORWARDED_FOR") or "").strip() if meta else ""

    trust_xff = bool(getattr(settings, "AUDIT_TRUST_X_FORWARDED_FOR", False))
    if not trust_xff:
        trusted = set(getattr(settings, "AUDIT_TRUSTED_PROXIES", []) or [])
        if remote_addr and remote_addr in trusted:
            trust_xff = True

    if trust_xff and xff_raw:
        first = xff_raw.split(",")[0].strip()
        ip = _parse_ip(first) or remote_addr
        return ip, xff_raw

    return remote_addr, xff_raw or None


def _sanitize_path(path: str | None) -> str | None:
    if not path:
        return None
    try:
        parts = urlsplit(path)
        if not parts.query:
            return str(path)[:255]
        pairs = parse_qsl(parts.query, keep_blank_values=True)
        sanitized_pairs: list[tuple[str, str]] = []
        for key, value in pairs:
            if SENSITIVE_FIELD_RE.search(str(key)):
                sanitized_pairs.append((key, _mask_value(value) or ""))
            else:
                sanitized_pairs.append((key, value))
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(sanitized_pairs), parts.fragment))[:255]
    except Exception:
        return str(path)[:255]


def _sanitize_metadata_value(key_hint: str | None, value: Any) -> Any:
    if key_hint and SENSITIVE_FIELD_RE.search(key_hint):
        if isinstance(value, dict):
            return {str(k): _mask_value(v) for k, v in value.items()}
        if isinstance(value, (list, tuple, set)):
            return [_mask_value(v) for v in value]
        return _mask_value(value)

    if isinstance(value, dict):
        return {str(k): _sanitize_metadata_value(str(k), v) for k, v in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_sanitize_metadata_value(key_hint, v) for v in value]

    return to_primitive(value)


def _sanitize_metadata(meta: dict[str, Any]) -> dict[str, Any]:
    if not meta:
        return {}
    out: dict[str, Any] = {}
    for key, value in meta.items():
        ks = str(key)
        if ks == "path":
            out[ks] = _sanitize_path(str(value) if value is not None else None)
            continue
        out[ks] = _sanitize_metadata_value(ks, value)
    return out


def _request_path(request: Request) -> str | None:
    try:
        if hasattr(request, "get_full_path"):
            p = request.get_full_path()
        else:
            raw = getattr(request, "_request", None)
            p = raw.get_full_path() if raw and hasattr(raw, "get_full_path") else getattr(request, "path", None)
    except Exception:
        p = getattr(request, "path", None)

    if not p:
        return None
    return _sanitize_path(str(p))


def _request_metadata(request: Request | None) -> dict[str, Any]:
    if not request:
        return {}

    meta = getattr(request, "META", {}) or {}

    ip, xff_raw = _client_ip_from_meta(meta)

    data: dict[str, Any] = {
        "path": _request_path(request),
        "method": getattr(request, "method", None),
        "ip": ip,
        "user_agent": meta.get("HTTP_USER_AGENT"),
    }

    if xff_raw:
        data["x_forwarded_for"] = xff_raw

    try:
        if hasattr(request, "query_params"):
            qp = getattr(request, "query_params")
            data["query_params"] = {str(k): qp.getlist(k) for k in qp.keys()}
        elif hasattr(request, "GET"):
            qp = getattr(request, "GET")
            data["query_params"] = {str(k): qp.getlist(k) for k in qp.keys()}
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
    subject: str | None = None,
):
    """Create an AuditEvent row.

    `actor` can be an authenticated user or AnonymousUser.
    """

    ct = ContentType.objects.get_for_model(instance.__class__) if instance is not None else None

    meta = _request_metadata(request)
    if metadata:
        meta.update(metadata)
    meta = _sanitize_metadata(meta)

    path = meta.get("path") or None
    method = meta.get("method") or None
    ip_address = meta.get("ip") or None
    user_agent = meta.get("user_agent") or None

    try:
        AuditEvent.objects.create(
            actor=actor if getattr(actor, "is_authenticated", False) else None,
            action=action,
            content_type=ct,
            object_id=str(getattr(instance, "pk", "")) if instance is not None else "",
            object_repr=str(instance) if instance is not None else "",
            subject=(subject or ""),
            changes=changes or {},
            metadata=meta,
            path=path,
            method=method,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except Exception:
        if getattr(settings, "AUDIT_STRICT", False):
            raise
        logger.exception(
            "Audit log_event failed",
            extra={
                "action": action,
                "object_id": str(getattr(instance, "pk", "")) if instance is not None else "",
            },
        )


def log_auth_attempt(username: str, success: bool, request: Request | None = None):
    meta = _request_metadata(request)
    try:
        AuthAttempt.objects.create(
            username=username,
            success=success,
            ip=meta.get("ip"),
            user_agent=meta.get("user_agent"),
        )
    except Exception:
        if getattr(settings, "AUDIT_STRICT", False):
            raise
        logger.exception("Audit log_auth_attempt failed", extra={"username": username, "success": success})
