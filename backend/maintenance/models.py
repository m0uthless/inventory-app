from django.db import models
from core.models import TimeStampedModel, InventoryType
from crm.models import Customer


class Tech(TimeStampedModel):
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128)
    email = models.EmailField()
    phone = models.CharField(max_length=32, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Tecnico"
        verbose_name_plural = "Tecnici"

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip()


class ScheduleType(models.TextChoices):
    INTERVAL   = "interval",   "Interval"
    FIXED_DATE = "fixed_date", "Fixed date"


class IntervalUnit(models.TextChoices):
    DAYS   = "days",   "Days"
    WEEKS  = "weeks",  "Weeks"
    MONTHS = "months", "Months"
    YEARS  = "years",  "Years"


class MaintenancePlan(TimeStampedModel):
    """
    Un piano di manutenzione è legato a un Customer e si applica
    a tutti gli inventory attivi di quei tipi appartenenti al cliente.
    """
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="maintenance_plans",
    )
    inventory_types = models.ManyToManyField(
        InventoryType,
        related_name="maintenance_plans",
        blank=False,
    )
    title = models.CharField(max_length=255)

    schedule_type = models.CharField(max_length=16, choices=ScheduleType.choices)

    # Usati quando schedule_type = "interval"
    interval_unit  = models.CharField(max_length=16, choices=IntervalUnit.choices, null=True, blank=True)
    interval_value = models.PositiveIntegerField(null=True, blank=True)

    # Usati quando schedule_type = "fixed_date"
    fixed_month = models.PositiveSmallIntegerField(null=True, blank=True)
    fixed_day   = models.PositiveSmallIntegerField(null=True, blank=True)

    # Data prevista — inseribile manualmente oppure auto-calcolata dal frontend/backend
    next_due_date = models.DateField()

    alert_days_before = models.PositiveIntegerField(default=14)
    is_active = models.BooleanField(default=True)

    notes       = models.TextField(null=True, blank=True)
    custom_fields = models.JSONField(null=True, blank=True)

    class Meta:
        verbose_name = "Piano manutenzione"
        verbose_name_plural = "Piani manutenzioni"

    def __str__(self):
        return f"{self.customer_id} - {self.title}"

    # ---------- helpers ----------

    def covered_inventories(self):
        """Restituisce gli inventory attivi del customer coperti da questo piano."""
        from inventory.models import Inventory
        type_ids = self.inventory_types.values_list("id", flat=True)
        return Inventory.objects.filter(
            customer=self.customer,
            type_id__in=type_ids,
            deleted_at__isnull=True,
        )


class MaintenanceResult(models.TextChoices):
    OK      = "ok",      "OK"
    KO      = "ko",      "KO"
    PARTIAL = "partial", "Partial"


class MaintenanceEvent(TimeStampedModel):
    """
    Rapportino di esecuzione: piano come contesto, inventory specifico come oggetto.
    """
    plan      = models.ForeignKey(MaintenancePlan, on_delete=models.PROTECT, related_name="events")
    inventory = models.ForeignKey("inventory.Inventory", on_delete=models.PROTECT, related_name="maintenance_events")

    performed_at = models.DateField()
    result       = models.CharField(max_length=16, choices=MaintenanceResult.choices)

    tech     = models.ForeignKey(Tech, on_delete=models.PROTECT, related_name="events")
    notes    = models.TextField(null=True, blank=True)
    pdf_file = models.FileField(upload_to="maintenance_events/", null=True, blank=True)

    class Meta:
        verbose_name = "Rapportino"
        verbose_name_plural = "Rapportini"

    def __str__(self):
        return f"{self.plan_id} / {self.inventory_id} - {self.performed_at} - {self.result}"


class NotificationStatus(models.TextChoices):
    SENT   = "sent",   "Sent"
    FAILED = "failed", "Failed"


class MaintenanceNotification(TimeStampedModel):
    plan      = models.ForeignKey(MaintenancePlan, on_delete=models.PROTECT, related_name="notifications")
    inventory = models.ForeignKey("inventory.Inventory", on_delete=models.PROTECT, related_name="notifications")

    due_date  = models.DateField()
    sent_at   = models.DateTimeField(auto_now_add=True)

    recipient_internal = models.EmailField()
    recipient_tech     = models.EmailField()

    status        = models.CharField(max_length=16, choices=NotificationStatus.choices)
    error_message = models.TextField(null=True, blank=True)

    class Meta:
        verbose_name = "Notifica manutenzione"
        verbose_name_plural = "Notifiche manutenzioni"

        constraints = [
            models.UniqueConstraint(
                fields=["plan", "inventory", "due_date"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_maint_notif_plan_inv_due_active",
            )
        ]

    def __str__(self):
        return f"{self.plan_id} / {self.inventory_id} {self.due_date} {self.status}"
