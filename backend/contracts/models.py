"""contracts/models.py — Modulo Contratti.

Contratti stipulati con i clienti (assistenza, noleggio, licenza, ...), con
venditore di riferimento (`Seller`) e, opzionalmente, i dispositivi coperti
(`ContractDevice`). I contratti senza dispositivi sono ammessi (es. assistenza).

Scadenza: `expiry_state_on()` classifica un contratto attivo rispetto a una
data (ok / notice / expiring / expired); bozza e disdetto non hanno scadenza
monitorata ("none"). `notice_deadline` è l'ultimo giorno utile per la disdetta.
"""
from __future__ import annotations

from datetime import date, timedelta

from django.conf import settings
from django.db import models
from django.db.models import Q

from core.models import CustomerStatus, TimeStampedModel
from crm.models import Customer


# ─── Choices ───────────────────────────────────────────────────────────────

class ContractType(models.TextChoices):
    ASSISTENZA = "assistenza", "Assistenza"
    NOLEGGIO   = "noleggio",   "Noleggio"
    LICENZA    = "licenza",    "Licenza"
    ALTRO      = "altro",      "Altro"


class BillingFrequency(models.TextChoices):
    UNA_TANTUM  = "una_tantum",  "Una tantum"
    MENSILE     = "mensile",     "Mensile"
    TRIMESTRALE = "trimestrale", "Trimestrale"
    ANNUALE     = "annuale",     "Annuale"


class ContractStatus(models.TextChoices):
    BOZZA    = "bozza",    "Bozza"
    ATTIVO   = "attivo",   "Attivo"
    DISDETTO = "disdetto", "Disdetto"


class ExpiryState:
    NONE     = "none"
    OK       = "ok"
    NOTICE   = "notice"
    EXPIRING = "expiring"
    EXPIRED  = "expired"


# Giorni alla scadenza entro cui il contratto è considerato "in scadenza".
EXPIRING_DAYS = 30


def contract_document_upload_path(instance, filename):
    return f"contracts/documents/{instance.pk or 'tmp'}/{filename}"


# ─── Seller ────────────────────────────────────────────────────────────────

class Seller(TimeStampedModel):
    """Anagrafica venditore, opzionalmente collegata a un utente."""

    name  = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=64, blank=True)
    user  = models.OneToOneField(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="seller",
    )
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


# ─── Contract ──────────────────────────────────────────────────────────────

class Contract(TimeStampedModel):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="contracts")
    code  = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    contract_type = models.CharField(
        max_length=16, choices=ContractType.choices, default=ContractType.ALTRO,
    )
    seller = models.ForeignKey(
        Seller, null=True, blank=True, on_delete=models.SET_NULL, related_name="contracts",
    )
    # Società che detiene il contratto: stesse voci del campo "Stato" dei
    # clienti (Biotron, Philips, Medical Imaging...). Se non indicata viene
    # proposta quella del cliente (vedi ContractSerializer.validate).
    company = models.ForeignKey(
        CustomerStatus, null=True, blank=True, on_delete=models.PROTECT,
        related_name="+", verbose_name="Società",
    )

    start_date = models.DateField()
    end_date   = models.DateField()
    auto_renew = models.BooleanField(default=False)
    # Giorni di preavviso per la disdetta rispetto a end_date.
    notice_days = models.PositiveIntegerField(default=90)

    total_value  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    billing_freq = models.CharField(
        max_length=16, choices=BillingFrequency.choices, default=BillingFrequency.ANNUALE,
    )
    status = models.CharField(
        max_length=16, choices=ContractStatus.choices, default=ContractStatus.BOZZA,
    )

    document = models.FileField(upload_to=contract_document_upload_path, blank=True)
    # Nome file originale al momento dell'upload (il file su disco può essere rinominato).
    document_original_filename = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)

    devices = models.ManyToManyField(
        "device.Device", through="ContractDevice", related_name="contracts", blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        ordering = ["-end_date", "-id"]
        permissions = [("view_contract_value", "Can view contract economic value")]
        constraints = [
            models.UniqueConstraint(
                fields=["code"], condition=Q(deleted_at__isnull=True),
                name="ux_contracts_code_active",
            ),
        ]
        indexes = [
            models.Index(fields=["customer", "deleted_at"], name="ix_contracts_customer_del"),
            models.Index(fields=["seller"], name="ix_contracts_seller"),
            models.Index(fields=["end_date"], name="ix_contracts_end_date"),
            models.Index(fields=["status"], name="ix_contracts_status"),
        ]

    def __str__(self) -> str:
        return f"{self.code} — {self.title}"

    @property
    def notice_deadline(self) -> date:
        """Ultimo giorno utile per la disdetta. Limitato a `date.min` se il
        preavviso porterebbe prima dell'anno 1 (OverflowError → 500 in lista)."""
        try:
            return self.end_date - timedelta(days=self.notice_days)
        except OverflowError:
            return date.min

    def expiry_state_on(self, today: date) -> str:
        if self.status != ContractStatus.ATTIVO:
            return ExpiryState.NONE
        if self.end_date < today:
            return ExpiryState.EXPIRED
        if (self.end_date - today).days <= EXPIRING_DAYS:
            return ExpiryState.EXPIRING
        if today >= self.notice_deadline:
            return ExpiryState.NOTICE
        return ExpiryState.OK


class ContractDevice(models.Model):
    """Collegamento Contratto ↔ Device (tabella through della M2M)."""

    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="device_links")
    device   = models.ForeignKey("device.Device", on_delete=models.CASCADE, related_name="+")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["contract", "device"], name="ux_contract_device"),
        ]

    def __str__(self) -> str:
        return f"{self.contract_id} ↔ {self.device_id}"
