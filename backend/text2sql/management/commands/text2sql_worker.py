"""Lavoratore del generatore SQL: elabora le domande in coda, una alla volta."""
from __future__ import annotations

import logging
import time

from django.core.management.base import BaseCommand
from django.db import DatabaseError, close_old_connections

from core.modules import is_module_enabled
from text2sql import worker

logger = logging.getLogger(__name__)

IDLE_SECONDS = 2
OFF_SECONDS = 30


def requeue_when_ready(sleep=None) -> int:
    """Rimette in coda le domande interrotte. Se lo schema non c'è ancora (al deploy
    `migrate` si lancia a mano dopo l'avvio dei servizi) aspetta e riprova."""
    sleep = sleep or time.sleep
    while True:
        close_old_connections()
        try:
            return worker.requeue_interrupted()
        except DatabaseError:
            logger.warning("[text2sql] database non pronto (migrazioni?): riprovo tra %s s", OFF_SECONDS)
            sleep(OFF_SECONDS)


def start(lock: worker.SingleWorkerLock, sleep=None) -> int:
    """Aspetta di essere l'unico lavoratore attivo, poi rimette in coda le domande
    interrotte: a quel punto quelle «in elaborazione» sono di un lavoratore caduto."""
    sleep = sleep or time.sleep
    while True:
        try:
            if lock.acquire():
                break
            logger.info("[text2sql] un altro lavoratore è attivo: aspetto %s s", OFF_SECONDS)
        except DatabaseError:
            logger.warning("[text2sql] database non raggiungibile: riprovo tra %s s", OFF_SECONDS)
        sleep(OFF_SECONDS)
    return requeue_when_ready(sleep)


class Command(BaseCommand):
    help = "Elabora in coda le domande al generatore SQL PACS (chiama Ollama)."

    def handle(self, *args, **options):
        lock = worker.SingleWorkerLock()
        n = start(lock)
        self.stdout.write(f"[text2sql] avvio; {n} domande interrotte rimesse in coda")
        while True:
            close_old_connections()
            try:
                if not lock.held():
                    logger.warning("[text2sql] lock del lavoratore perso (database riavviato?): lo riprendo")
                    n = start(lock)
                    self.stdout.write(f"[text2sql] ripreso; {n} domande interrotte rimesse in coda")
                    continue
                if not is_module_enabled("text2sql"):
                    time.sleep(OFF_SECONDS)
                    continue
                if not worker.process_next():
                    time.sleep(IDLE_SECONDS)
            except Exception:  # noqa: BLE001 — il ciclo non deve mai fermarsi
                logger.exception("[text2sql] errore nel ciclo del lavoratore")
                time.sleep(OFF_SECONDS)
