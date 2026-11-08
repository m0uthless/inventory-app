"""Cestino: informazioni aggiuntive sugli elementi eliminati (restyle 2026-11).

GET /api/trash/info/?customers=1,2&sites=3&...

Per ogni elemento richiesto (solo se è davvero nel cestino e l'utente ha il
permesso di vederne il tipo) restituisce:
- ``restore_block``: motivo per cui il ripristino è bloccato (padre nel cestino), o null;
- ``purge_block``: elementi collegati ancora attivi che impediscono l'eliminazione
  definitiva, es. ``[{"label": "inventari", "count": 3}]``;
- ``deleted_by``: chi l'ha eliminato, ricavato dall'ultimo evento Audit "delete".

Le stesse regole di ``core.restore_policy`` / ``core.purge_policy`` usate da
restore/purge: la pagina le mostra prima che l'utente provi l'azione.
"""
from __future__ import annotations

from django.contrib.contenttypes.models import ContentType
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.models import AuditEvent
from core.purge_policy import get_purge_blockers
from core.restore_policy import get_restore_block_reason
from portal.permissions import IsInternalOrPortalDedicatedApp

MAX_IDS_PER_KIND = 200


def _kinds():
    from crm.models import Contact, Customer, Site
    from inventory.models import Inventory, Monitor
    from maintenance.models import MaintenancePlan, Tech

    # chiave della pagina Cestino → (modello, select_related per le regole di ripristino)
    return {
        "customers": (Customer, ()),
        "sites": (Site, ("customer",)),
        "contacts": (Contact, ("customer", "site")),
        "inventory": (Inventory, ("customer", "site")),
        "monitors": (Monitor, ("inventory",)),
        "maintenance-plans": (MaintenancePlan, ("customer",)),
        "techs": (Tech, ()),
    }


def _parse_ids(raw: str) -> list[int]:
    out: list[int] = []
    for part in (raw or "").split(","):
        part = part.strip()
        if part.isdigit():
            out.append(int(part))
    return out[:MAX_IDS_PER_KIND]


def _actor_name(user) -> str | None:
    if user is None:
        return None
    full = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return full or getattr(user, "username", None)


class TrashInfoView(APIView):
    # Esplicite: autenticato e fuori dal Portal (il Cestino è solo di Archie).
    permission_classes = [IsAuthenticated, IsInternalOrPortalDedicatedApp]

    def get(self, request):
        data: dict[str, dict[str, dict]] = {}
        for key, (model, related) in _kinds().items():
            ids = _parse_ids(request.query_params.get(key, ""))
            if not ids:
                continue
            opts = model._meta
            if not request.user.has_perm(f"{opts.app_label}.view_{opts.model_name}"):
                continue
            objs = list(
                model._default_manager.select_related(*related).filter(id__in=ids, deleted_at__isnull=False)
            )
            if not objs:
                data[key] = {}
                continue

            ct = ContentType.objects.get_for_model(model)
            deleted_by: dict[str, str | None] = {}
            events = (
                AuditEvent.objects.select_related("actor")
                .filter(content_type=ct, action=AuditEvent.Action.DELETE, object_id__in=[str(o.id) for o in objs])
                .order_by("object_id", "-created_at")
            )
            for ev in events:
                if ev.object_id not in deleted_by:
                    deleted_by[ev.object_id] = _actor_name(ev.actor)

            items: dict[str, dict] = {}
            for obj in objs:
                items[str(obj.id)] = {
                    "restore_block": get_restore_block_reason(obj),
                    "purge_block": get_purge_blockers(obj),
                    "deleted_by": deleted_by.get(str(obj.id)),
                }
            data[key] = items
        return Response(data)
