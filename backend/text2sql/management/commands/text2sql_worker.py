"""Lavoratore del generatore SQL: elabora le domande in coda, una alla volta."""
from __future__ import annotations

import logging
import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from core.modules import is_module_enabled
from text2sql import worker

logger = logging.getLogger(__name__)

IDLE_SECONDS = 2
OFF_SECONDS = 30


class Command(BaseCommand):
    help = "Elabora in coda le domande al generatore SQL PACS (chiama Ollama)."

    def handle(self, *args, **options):
        n = worker.requeue_interrupted()
        self.stdout.write(f"[text2sql] avvio; {n} domande interrotte rimesse in coda")
        while True:
            close_old_connections()
            try:
                if not is_module_enabled("text2sql"):
                    time.sleep(OFF_SECONDS)
                    continue
                if not worker.process_next():
                    time.sleep(IDLE_SECONDS)
            except Exception:  # noqa: BLE001 — il ciclo non deve mai fermarsi
                logger.exception("[text2sql] errore nel ciclo del lavoratore")
                time.sleep(OFF_SECONDS)
