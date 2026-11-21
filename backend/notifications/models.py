from __future__ import annotations

from django.conf import settings
from django.db import models


class NotificationType(models.TextChoices):
    MAINTENANCE_DUE = "maintenance_due", "Manutenzione in scadenza"
    AREA_TASK_DUE = "area_task_due", "Task di area in scadenza"
    TEXT2SQL_READY = "text2sql_ready", "Query SQL pronta"
    CONTRACT_RENEWAL = "contract_renewal", "Contratto da rinnovare"


class Notification(models.Model):
    """Notifica in-app persistita.

    Generata periodicamente dal management command `refresh_notifications` a
    partire dalle stesse due sorgenti già usate dalla precedente campanella
    "live" (manutenzioni in scadenza entro 30gg, task di area in scadenza o
    scaduti). Non è soft-delete: le notifiche non lette diventate non più
    valide (es. scadenza rientrata) vengono cancellate fisicamente dal
    comando di refresh; quelle già lette restano come storico.

    `source_key` identifica l'oggetto sorgente (piano+inventory, area task,
    ...) indipendentemente dalla data di scadenza — serve per fare upsert
    (stessa notifica, scadenza aggiornata) invece di creare duplicati ogni
    volta che il job gira. Formato libero per tipo, es.
    "<plan_id>:<inventory_id>" per maintenance_due, "<area_task_id>" per
    area_task_due.
    """

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=32, choices=NotificationType.choices)

    title = models.CharField(max_length=255)
    subtitle = models.CharField(max_length=255, blank=True)
    link = models.CharField(max_length=255, blank=True)

    source_key = models.CharField(max_length=255)
    event_date = models.DateField()

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    last_emailed_event_date = models.DateField(
        null=True,
        blank=True,
        help_text=(
            "event_date per cui è già stata inviata l'email digest di "
            "refresh_notifications. Usato per non reinviare l'email a ogni "
            "refresh: si reinvia solo quando event_date cambia rispetto a "
            "questo valore."
        ),
    )

    class Meta:
        verbose_name = "Notifica"
        verbose_name_plural = "Notifiche"
        ordering = ["is_read", "event_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "notification_type", "source_key"],
                name="ux_notification_recipient_type_source",
            )
        ]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
        ]

    def __str__(self):
        return f"{self.recipient_id} · {self.notification_type} · {self.title}"


class OfficeDigestMark(models.Model):
    """Ultimo stato inviato all'ufficio per una scadenza di manutenzione (piano:inventario).

    Il riepilogo all'ufficio parte solo se c'è qualcosa di nuovo: una scadenza mai inviata,
    con data cambiata o appena diventata «scaduta». Le scadenze che escono dall'elenco
    perdono il segno, così se rientrano contano di nuovo come novità.
    """

    source_key = models.CharField(max_length=64, unique=True)
    state = models.CharField(max_length=16)  # "due" | "overdue"
    due_date = models.DateField()
    sent_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.source_key} · {self.state} · {self.due_date}"
