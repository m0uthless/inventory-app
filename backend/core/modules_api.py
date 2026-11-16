"""API della pagina «Moduli»: solo i superuser accendono e spengono i moduli.

GET   /api/admin/modules/          elenco con stato, motivo e storico
PATCH /api/admin/modules/<key>/    {"enabled": bool, "reason": "..."}
"""
from __future__ import annotations

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.models import AuditEvent
from audit.utils import log_event
from core.models import ModuleSwitch
from core.modules import MODULES, MODULES_BY_KEY
from portal.permissions import IsInternalOrPortalDedicatedApp

HISTORY_LIMIT = 10


class IsSuperuser(BasePermission):
    message = "Solo un superuser può gestire i moduli."

    def has_permission(self, request, view) -> bool:
        return bool(getattr(request.user, "is_superuser", False))


def _person(user) -> str | None:
    if user is None:
        return None
    return user.get_full_name() or user.get_username()


def _history(switch: ModuleSwitch | None) -> list[dict]:
    if switch is None:
        return []
    ct = ContentType.objects.get_for_model(ModuleSwitch)
    events = (
        AuditEvent.objects.filter(content_type=ct, object_id=str(switch.pk))
        .select_related("actor")
        .order_by("-created_at")[:HISTORY_LIMIT]
    )
    out = []
    for ev in events:
        changes = ev.changes or {}
        enabled = (changes.get("enabled") or {}).get("after")
        if enabled is None:
            continue
        out.append({
            "at": ev.created_at.isoformat(),
            "actor": _person(ev.actor),
            "enabled": bool(enabled),
            "reason": (changes.get("reason") or {}).get("after") or "",
        })
    return out


def _serialize(key: str, switch: ModuleSwitch | None) -> dict:
    module = MODULES_BY_KEY[key]
    return {
        "key": key,
        "label": module.label,
        "enabled": switch.enabled if switch else True,
        "reason": (switch.reason if switch and not switch.enabled else ""),
        "changed_by": _person(switch.changed_by) if switch else None,
        "changed_at": switch.changed_at.isoformat() if switch else None,
        "history": _history(switch),
    }


class ModuleListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser, IsInternalOrPortalDedicatedApp]

    def get(self, request):
        switches = {s.key: s for s in ModuleSwitch.objects.select_related("changed_by")}
        return Response([_serialize(m.key, switches.get(m.key)) for m in MODULES])


class ModuleDetailView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser, IsInternalOrPortalDedicatedApp]

    @transaction.atomic
    def patch(self, request, key: str):
        if key not in MODULES_BY_KEY:
            raise NotFound("Modulo sconosciuto.")
        enabled = request.data.get("enabled")
        if not isinstance(enabled, bool):
            raise ValidationError({"enabled": "Indica true o false."})
        reason = str(request.data.get("reason") or "").strip()[:200]

        switch, _ = ModuleSwitch.objects.select_for_update().get_or_create(key=key)
        before = {"enabled": switch.enabled, "reason": switch.reason}
        switch.enabled = enabled
        switch.reason = "" if enabled else reason
        switch.changed_by = request.user
        switch.save()

        if before["enabled"] != enabled or before["reason"] != switch.reason:
            log_event(
                actor=request.user,
                action=AuditEvent.Action.UPDATE,
                instance=switch,
                changes={
                    "enabled": {"before": before["enabled"], "after": enabled},
                    "reason": {"before": before["reason"], "after": switch.reason},
                },
                request=request,
                subject=f"Modulo {MODULES_BY_KEY[key].label} {'acceso' if enabled else 'spento'}",
            )
        return Response(_serialize(key, switch), status=status.HTTP_200_OK)


# ── Modalità manutenzione ──────────────────────────────────────────────────
# GET   /api/admin/maintenance/   stato
# PATCH /api/admin/maintenance/   {"active": bool, "message": "..."}

def _serialize_maintenance(row) -> dict:
    from core.maintenance import DEFAULT_MESSAGE

    return {
        "active": bool(row and row.active),
        "message": row.message if row else "",
        "default_message": DEFAULT_MESSAGE,
        "changed_by": _person(row.changed_by) if row else None,
        "changed_at": row.changed_at.isoformat() if row else None,
    }


class MaintenanceView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser, IsInternalOrPortalDedicatedApp]

    def get(self, request):
        from core.models import MaintenanceMode

        return Response(_serialize_maintenance(MaintenanceMode.objects.select_related("changed_by").filter(pk=1).first()))

    @transaction.atomic
    def patch(self, request):
        from core.models import MaintenanceMode

        active = request.data.get("active")
        if not isinstance(active, bool):
            raise ValidationError({"active": "Indica true o false."})
        message = str(request.data.get("message") or "").strip()[:300]

        row, _ = MaintenanceMode.objects.select_for_update().get_or_create(pk=1)
        before = {"active": row.active, "message": row.message}
        row.active = active
        row.message = message
        row.changed_by = request.user
        row.save()

        if before != {"active": row.active, "message": row.message}:
            log_event(
                actor=request.user,
                action=AuditEvent.Action.UPDATE,
                instance=row,
                changes={
                    "active": {"before": before["active"], "after": row.active},
                    "message": {"before": before["message"], "after": row.message},
                },
                request=request,
                subject=f"Modalità manutenzione {'attivata' if active else 'disattivata'}",
            )
        return Response(_serialize_maintenance(row), status=status.HTTP_200_OK)
