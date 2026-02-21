from __future__ import annotations

import re

from datetime import date, datetime
from typing import Any, Dict, Iterable, Optional

from django.contrib.contenttypes.models import ContentType
from django.contrib.auth import get_user_model
from django.db import models

from audit.models import AuditEvent


def _get_ip(request) -> Optional[str]:
    if not request:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR")


def to_primitive(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, models.Model):
        return getattr(value, "pk", None)
    if isinstance(value, (list, tuple, set)):
        return [to_primitive(v) for v in value]
    if isinstance(value, dict):
        return {str(k): to_primitive(v) for k, v in value.items()}
    return str(value)


SENSITIVE_FIELD_RE = re.compile(r"(password|pass|pwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key)", re.I)

def to_change_value(value: Any) -> Any:
    # Value serializer for AuditEvent.changes.
    # - Scalars/dates -> primitive
    # - Django model instances -> {id, repr}
    # - Collections -> recursively converted
    if value is None:
        return None

    if isinstance(value, models.Model):
        pk = getattr(value, 'pk', None)
        rep = str(value)
        if len(rep) > 180:
            rep = rep[:177] + '…'
        return {'id': pk, 'repr': rep}

    if isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, (list, tuple, set)):
        return [to_change_value(v) for v in value]

    if isinstance(value, dict):
        return {str(k): to_change_value(v) for k, v in value.items()}

    return str(value)




def to_change_value_for_field(field_name: str, value: Any) -> Any:
    # Prevent storing secrets in AuditEvent.changes
    if field_name and SENSITIVE_FIELD_RE.search(field_name):
        return '••••' if value not in (None, '') else None
    return to_change_value(value)


def diff_fields(instance_before, instance_after, fields: Iterable[str]) -> Dict[str, Any]:
    changes: Dict[str, Any] = {}
    for f in fields:
        # Use the same value serializer as the rest of the audit system,
        # so we don't accidentally store secrets in clear text.
        b = to_change_value_for_field(f, getattr(instance_before, f, None))
        a = to_change_value_for_field(f, getattr(instance_after, f, None))
        if b != a:
            changes[f] = {"from": b, "to": a}
    return changes


def _safe_get(obj: Any, *attrs: str) -> Optional[Any]:
    for a in attrs:
        if not hasattr(obj, a):
            continue
        v = getattr(obj, a)
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        return v
    return None


def build_subject(instance: Any) -> str:
    """Costruisce la label "Oggetto" per Audit secondo regole UX.

    Regole richieste:
    - crm.contact  -> Nome
    - crm.customer -> Nome
    - crm.site     -> Nome Customer - Nome Sito
    - inventory.inventory -> Nome - Nome Customer - Nome Sito (se presente)

    Per altri modelli, fallback a str(instance).
    """
    if instance is None:
        return ""

    meta = getattr(instance, "_meta", None)
    app = getattr(meta, "app_label", "")
    model = getattr(meta, "model_name", "")

    # crm.contact
    if app == "crm" and model == "contact":
        name = _safe_get(instance, "name")
        if name:
            return str(name)
        email = _safe_get(instance, "email")
        return str(email) if email else str(instance)

    # crm.customer
    if app == "crm" and model == "customer":
        name = _safe_get(instance, "name", "display_name")
        return str(name) if name else str(instance)

    # crm.site
    if app == "crm" and model == "site":
        site_name = _safe_get(instance, "name", "display_name") or str(instance)
        customer = _safe_get(instance, "customer")
        customer_name = _safe_get(customer, "name", "display_name") if customer else None
        return f"{customer_name} - {site_name}" if customer_name else str(site_name)

    # inventory.inventory (o comunque model 'inventory')
    if model == "inventory":
        inv_name = _safe_get(instance, "name", "hostname", "serial_number", "knumber") or str(instance)
        customer = _safe_get(instance, "customer")
        site = _safe_get(instance, "site")
        customer_name = _safe_get(customer, "name", "display_name") if customer else None
        site_name = _safe_get(site, "name", "display_name") if site else None

        parts = [str(inv_name)]
        if customer_name:
            parts.append(str(customer_name))
        if site_name:
            parts.append(str(site_name))
        return " - ".join([p for p in parts if p])

    # auth.user (login)
    if app == "auth" and model == "user":
        fn = _safe_get(instance, "first_name")
        ln = _safe_get(instance, "last_name")
        full = " ".join([str(x).strip() for x in [fn or "", ln or ""] if str(x).strip()]).strip()
        if full:
            return full
        username = _safe_get(instance, "username")
        return str(username) if username else str(instance)

    return str(instance)



def log_event(
    *,
    actor,
    action: str,
    instance,
    changes: Optional[Dict[str, Any]] = None,
    request=None,
    subject: Optional[str] = None,
) -> AuditEvent:
    ct = ContentType.objects.get_for_model(instance.__class__)
    obj_id = str(getattr(instance, "pk", ""))
    obj_repr = str(instance)[:255] if instance is not None else ""
    subj = (subject if subject is not None else build_subject(instance))[:512]

    return AuditEvent.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        content_type=ct,
        object_id=obj_id,
        object_repr=obj_repr,
        subject=subj,
        changes=changes,
        path=getattr(request, "get_full_path", lambda: None)() if request else None,
        method=getattr(request, "method", None) if request else None,
        ip_address=_get_ip(request),
        user_agent=(request.META.get("HTTP_USER_AGENT") if request else None),
    )


def log_auth_attempt(
    *,
    action: str,
    username: Optional[str] = None,
    user=None,
    actor=None,
    request=None,
    reason: Optional[str] = None,
) -> Optional[AuditEvent]:
    """Log authentication attempts that may not have an authenticated actor.

    - action: e.g. 'login', 'logout', 'login_failed'
    - username: attempted username/email (never password)
    - user: optional resolved User instance (if known)
    - actor: optional actor User (can be set when we know which user attempted)
    - reason: free-form string like 'invalid_credentials' or 'disabled'
    """

    try:
        User = get_user_model()
        ct = ContentType.objects.get_for_model(User)
        oid = "" if user is None else str(getattr(user, "pk", ""))
        subj = build_subject(user) if user is not None else (username or "")

        changes = {
            **({"username": (username or "")} if username is not None else {}),
            **({"reason": reason} if reason else {}),
        } or None

        return AuditEvent.objects.create(
            actor=actor,
            action=action,
            content_type=ct,
            object_id=oid,
            object_repr=(str(user)[:255] if user is not None else (username or "")[:255]),
            subject=(subj or "")[:512],
            changes=changes,
            path=getattr(request, "get_full_path", lambda: None)() if request else None,
            method=getattr(request, "method", None) if request else None,
            ip_address=_get_ip(request),
            user_agent=(request.META.get("HTTP_USER_AGENT") if request else None),
        )
    except Exception:
        # Never block authentication flow.
        return None
