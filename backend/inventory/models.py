from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.postgres.fields import ArrayField
from core.models import TimeStampedModel, InventoryType, InventoryStatus
from crm.models import Customer, Site

class Inventory(TimeStampedModel):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="inventories", null=False, blank=False)
    site = models.ForeignKey(Site, on_delete=models.PROTECT, null=True, blank=True, related_name="inventories")

    name = models.CharField(max_length=255, blank=False, null=False)

    knumber = models.CharField(max_length=64, null=True, blank=True)
    serial_number = models.CharField(max_length=128, null=True, blank=True)

    type = models.ForeignKey(InventoryType, on_delete=models.PROTECT, null=False, blank=False)

    os_user = models.CharField(max_length=128, null=True, blank=True)
    os_pwd = models.CharField(max_length=128, null=True, blank=True)
    app_usr = models.CharField(max_length=128, null=True, blank=True)
    app_pwd = models.CharField(max_length=128, null=True, blank=True)
    vnc_pwd = models.CharField(max_length=128, null=True, blank=True)

    hostname = models.CharField(max_length=255, null=True, blank=True)
    local_ip = models.CharField(max_length=64, null=True, blank=True)
    srsa_ip = models.CharField(max_length=64, null=True, blank=True)

    status = models.ForeignKey(InventoryStatus, on_delete=models.PROTECT)

    manufacturer = models.CharField(max_length=128, null=True, blank=True)
    model = models.CharField(max_length=128, null=True, blank=True)
    warranty_end_date = models.DateField(null=True, blank=True)

    notes = models.TextField(null=True, blank=True)
    tags = ArrayField(models.TextField(), null=True, blank=True)
    custom_fields = models.JSONField(null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        permissions = [
            ("view_secrets", "Can view inventory secrets"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["knumber"],
                condition=models.Q(deleted_at__isnull=True, knumber__isnull=False),
                name="ux_inventories_knumber_active",
            ),
            models.UniqueConstraint(
                fields=["serial_number"],
                condition=models.Q(deleted_at__isnull=True, serial_number__isnull=False),
                name="ux_inventories_serial_active",
            ),
        ]

    def clean(self):
        if self.site_id and self.site.customer_id != self.customer_id:
            raise ValidationError({"site": "Il sito selezionato non appartiene al customer."})

    def __str__(self):
        return self.name
