"""Coda del generatore SQL: una domanda alla volta (Ollama ne elabora una sola).

Usato da `manage.py text2sql_worker` (servizio `text2sql-worker`)."""
from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone

from core.modules import is_module_enabled
from notifications.models import Notification, NotificationType
from text2sql import engine
from text2sql.models import Text2SqlRequest

logger = logging.getLogger(__name__)


def requeue_interrupted() -> int:
    """All'avvio: le domande rimaste «in elaborazione» (lavoratore riavviato) tornano in coda."""
    return Text2SqlRequest.objects.filter(status=Text2SqlRequest.STATUS_RUNNING).update(
        status=Text2SqlRequest.STATUS_QUEUED, started_at=None,
    )


def _claim() -> Text2SqlRequest | None:
    with transaction.atomic():
        obj = (
            Text2SqlRequest.objects.select_for_update(skip_locked=True)
            .filter(status=Text2SqlRequest.STATUS_QUEUED)
            .order_by("created_at", "id")
            .first()
        )
        if obj is None:
            return None
        obj.status = Text2SqlRequest.STATUS_RUNNING
        obj.started_at = timezone.now()
        obj.save(update_fields=["status", "started_at"])
        return obj


def _notify(obj: Text2SqlRequest) -> None:
    ok = obj.status == Text2SqlRequest.STATUS_DONE
    question = obj.question if len(obj.question) <= 200 else f"{obj.question[:199]}…"
    Notification.objects.update_or_create(
        recipient_id=obj.user_id,
        notification_type=NotificationType.TEXT2SQL_READY,
        source_key=str(obj.pk),
        defaults={
            "title": "Query SQL pronta" if ok else "Query SQL non riuscita",
            "subtitle": question,
            "link": f"/knowledge/sql?apri={obj.pk}",
            "event_date": timezone.localdate(),
            "is_read": False,
            "read_at": None,
        },
    )


def process_next() -> bool:
    """Elabora la domanda in coda più vecchia. False se non c'è niente da fare."""
    if not is_module_enabled("text2sql"):
        return False
    obj = _claim()
    if obj is None:
        return False
    try:
        result = engine.generate(obj.question)
    except engine.EngineError as e:
        obj.status, obj.error = Text2SqlRequest.STATUS_ERROR, str(e)
    except Exception:  # noqa: BLE001 — una domanda andata male non deve fermare la coda
        logger.exception("Generatore SQL: errore imprevisto sulla domanda %s", obj.pk)
        obj.status, obj.error = Text2SqlRequest.STATUS_ERROR, "Errore imprevisto del generatore: riprova o avvisa l'amministratore."
    else:
        obj.status = Text2SqlRequest.STATUS_DONE
        obj.sql, obj.kind, obj.warnings, obj.seconds = result["sql"], result["kind"], result["warnings"], result["seconds"]
    obj.finished_at = timezone.now()
    obj.save()
    try:
        _notify(obj)
    except Exception:  # noqa: BLE001
        logger.exception("Generatore SQL: notifica non creata per la domanda %s", obj.pk)
    return True
