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


# Chiave dell'advisory lock di Postgres che tiene un solo lavoratore attivo.
LOCK_KEY = 7_201_120


class SingleWorkerLock:
    """Un solo lavoratore elabora la coda: Ollama fa una domanda alla volta, e
    all'avvio `requeue_interrupted` rimette in coda tutto ciò che è «in
    elaborazione», che con due lavoratori sarebbe il lavoro dell'altro.

    Il lock sta su una connessione propria, fuori da `close_old_connections`;
    se la connessione cade (database riavviato) il lock si perde e `held()` lo dice."""

    def __init__(self):
        self._conn = None

    def acquire(self) -> bool:
        from django.db import connections

        self.release()
        conn = connections.create_connection("default")
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_try_advisory_lock(%s)", [LOCK_KEY])
                ok = bool(cur.fetchone()[0])
        except Exception:
            conn.close()
            raise
        if ok:
            self._conn = conn
        else:
            conn.close()
        return ok

    def held(self) -> bool:
        if self._conn is None:
            return False
        try:
            with self._conn.cursor() as cur:
                cur.execute("SELECT 1")
            return True
        except Exception:  # noqa: BLE001 — connessione persa: il lock non c'è più
            self.release()
            return False

    def release(self) -> None:
        if self._conn is None:
            return
        try:
            with self._conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_unlock(%s)", [LOCK_KEY])
        except Exception:  # noqa: BLE001
            pass
        finally:
            try:
                self._conn.close()
            except Exception:  # noqa: BLE001
                pass
            self._conn = None


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
        fields = {"status": Text2SqlRequest.STATUS_ERROR, "error": str(e)}
    except Exception:  # noqa: BLE001 — una domanda andata male non deve fermare la coda
        logger.exception("Generatore SQL: errore imprevisto sulla domanda %s", obj.pk)
        fields = {"status": Text2SqlRequest.STATUS_ERROR, "error": UNEXPECTED}
    else:
        fields = {"status": Text2SqlRequest.STATUS_DONE, "sql": result["sql"], "kind": result["kind"],
                  "warnings": result["warnings"], "seconds": result["seconds"]}
    fields["finished_at"] = timezone.now()
    if not _close(obj.pk, fields):
        return True  # cancellata durante l'elaborazione: niente da salvare né da notificare
    for k, v in fields.items():
        setattr(obj, k, v)
    try:
        _notify(obj)
    except Exception:  # noqa: BLE001
        logger.exception("Generatore SQL: notifica non creata per la domanda %s", obj.pk)
    return True


UNEXPECTED = "Errore imprevisto del generatore: riprova o avvisa l'amministratore."


def _close(pk: int, fields: dict) -> bool:
    """Chiude la domanda solo se esiste ancora ed è «in elaborazione» (un UPDATE, mai un
    INSERT: una domanda cancellata nel frattempo non deve ricomparire). Se il salvataggio
    fallisce prova almeno a segnarla «non riuscita», così la pagina non resta in attesa."""
    try:
        return Text2SqlRequest.objects.filter(pk=pk, status=Text2SqlRequest.STATUS_RUNNING).update(**fields) > 0
    except Exception:  # noqa: BLE001
        logger.exception("Generatore SQL: salvataggio non riuscito per la domanda %s", pk)
    try:
        fallback = {"status": Text2SqlRequest.STATUS_ERROR, "error": UNEXPECTED, "finished_at": fields["finished_at"]}
        if Text2SqlRequest.objects.filter(pk=pk, status=Text2SqlRequest.STATUS_RUNNING).update(**fallback) > 0:
            fields.clear()
            fields.update(fallback)
            return True
    except Exception:  # noqa: BLE001
        logger.exception("Generatore SQL: domanda %s rimasta in elaborazione", pk)
    return False
