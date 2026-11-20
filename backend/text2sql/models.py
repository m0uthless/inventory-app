"""Generatore SQL PACS (spec 2026-11-20): domanda in italiano → query Oracle
per il PACS Philips Vue. Archie non esegue mai le query: le genera soltanto.

Le domande sono elaborate in coda da `manage.py text2sql_worker` (servizio
`text2sql-worker`), che chiama Ollama: vedi `text2sql/engine.py`."""
from __future__ import annotations

from django.conf import settings
from django.db import models


class Text2SqlRequest(models.Model):
    STATUS_QUEUED = "queued"
    STATUS_RUNNING = "running"
    STATUS_DONE = "done"
    STATUS_ERROR = "error"
    STATUS_CHOICES = [
        (STATUS_QUEUED, "In coda"),
        (STATUS_RUNNING, "In elaborazione"),
        (STATUS_DONE, "Pronta"),
        (STATUS_ERROR, "Non riuscita"),
    ]
    KIND_CHOICES = [("read", "Lettura"), ("write", "Scrittura"), ("impossible", "Impossibile")]
    FEEDBACK_CHOICES = [("ok", "Corretta"), ("ko", "Da correggere")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="text2sql_requests", verbose_name="Utente")
    question = models.TextField(verbose_name="Domanda")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_QUEUED, verbose_name="Stato")

    sql = models.TextField(blank=True, verbose_name="Query")
    kind = models.CharField(max_length=12, choices=KIND_CHOICES, blank=True, verbose_name="Tipo")
    warnings = models.JSONField(default=list, blank=True, verbose_name="Avvisi")
    seconds = models.FloatField(null=True, blank=True, verbose_name="Secondi")
    error = models.TextField(blank=True, verbose_name="Errore")

    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    # Giudizio del tecnico e revisione del superuser.
    feedback = models.CharField(max_length=2, choices=FEEDBACK_CHOICES, blank=True, verbose_name="Giudizio")
    corrected_sql = models.TextField(blank=True, verbose_name="Query corretta")
    feedback_note = models.TextField(blank=True, verbose_name="Nota")
    feedback_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Domanda al generatore SQL"
        verbose_name_plural = "Domande al generatore SQL"
        ordering = ["-created_at", "-id"]
        permissions = [("use_text2sql", "Usa il generatore SQL PACS")]
        indexes = [
            models.Index(fields=["status", "created_at"], name="t2s_status_created_idx"),
            models.Index(fields=["user", "-created_at"], name="t2s_user_created_idx"),
        ]

    def __str__(self):
        # Niente testo della domanda: può contenere il nome di un paziente e finisce
        # nell'Audit (object_repr), che resterebbe anche dopo la cancellazione.
        return f"Domanda #{self.pk}"

    @property
    def example_markdown(self) -> str:
        """Blocco nel formato di `knowledge/esempi_query.md`."""
        best = (self.corrected_sql or self.sql).strip()
        return f"### Domanda: {self.question.strip()}\n```sql\n{best}\n```\n"
