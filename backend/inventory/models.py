from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.postgres.fields import ArrayField
from core.models import TimeStampedModel, InventoryType, InventoryStatus
from core.crypto import encrypt
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
        indexes = [
            # Hot paths:
            # - list views filter by deleted_at (soft delete)
            # - list views commonly scope by customer/site
            # - ordering frequently uses updated_at
            models.Index(fields=["deleted_at"], name="inv_deleted_at_idx"),
            models.Index(fields=["customer", "deleted_at"], name="inv_customer_del_idx"),
            models.Index(fields=["site", "deleted_at"], name="inv_site_del_idx"),
            models.Index(fields=["updated_at"], name="inv_updated_at_idx"),
        ]
        constraints = []

    def clean(self):
        if self.site_id and self.site.customer_id != self.customer_id:
            raise ValidationError({"site": "Il sito selezionato non appartiene al customer."})

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Encrypt secrets at-rest (usernames remain plaintext).
        # We keep backward compatibility: existing plaintext rows are allowed
        # and will be encrypted on next save.
        for field in ("os_pwd", "app_pwd", "vnc_pwd"):
            val = getattr(self, field, None)
            if val not in (None, ""):
                setattr(self, field, encrypt(val))
        return super().save(*args, **kwargs)


class Monitor(TimeStampedModel):
    """Monitor associato a un inventory di tipo workstation.

    Più monitor possono essere associati allo stesso inventory.
    La sede è ereditata dall'inventory associato.
    """

    class Stato(models.TextChoices):
        IN_USO       = "in_uso",       "In uso"
        DA_INSTALLARE = "da_installare", "Da installare"
        GUASTO       = "guasto",       "Guasto"
        RMA          = "rma",          "RMA"

    class Tipo(models.TextChoices):
        AMMINISTRATIVO = "amministrativo", "Amministrativo"
        DIAGNOSTICO    = "diagnostico",    "Diagnostico"

    inventory = models.ForeignKey(
        Inventory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="monitors",
        verbose_name="Inventory (workstation)",
    )

    produttore = models.CharField(
        max_length=128,
        default="Eizo",
        verbose_name="Produttore",
    )
    modello = models.CharField(
        max_length=128,
        null=True, blank=True,
        verbose_name="Modello",
    )
    seriale = models.CharField(
        max_length=128,
        null=True, blank=True,
        verbose_name="Seriale",
    )

    stato = models.CharField(
        max_length=32,
        choices=Stato.choices,
        default=Stato.DA_INSTALLARE,
        verbose_name="Stato",
    )
    tipo = models.CharField(
        max_length=32,
        choices=Tipo.choices,
        verbose_name="Tipo",
    )
    radinet = models.BooleanField(
        default=False,
        verbose_name="Radinet",
        help_text="Abilitabile solo per monitor di tipo Diagnostico.",
    )

    class Meta:
        verbose_name = "Monitor"
        verbose_name_plural = "Monitor"
        ordering = ["inventory", "produttore", "modello"]

    def clean(self):
        if self.radinet and self.tipo != self.Tipo.DIAGNOSTICO:
            raise ValidationError({"radinet": "Radinet può essere abilitato solo per monitor di tipo Diagnostico."})

    def __str__(self):
        return f"{self.produttore} {self.modello or ''} ({self.inventory})".strip()
