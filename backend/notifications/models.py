from __future__ import annotations

from django.conf import settings
from django.db import models


class NotificationType(models.TextChoices):
    MAINTENANCE_DUE = "maintenance_due", "Manutenzione in scadenza"
    AREA_TASK_DUE = "area_task_due", "Task di area in scadenza"


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
