import os
from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError

from core.models import TimeStampedModel
from core.crypto import encrypt
from crm.models import Customer, Site


# ─────────────────────────────────────────────────────────────────────────────
# Lookup tables
# ─────────────────────────────────────────────────────────────────────────────

class DeviceManufacturer(TimeStampedModel):
    name = models.CharField(max_length=128, unique=True, verbose_name="Nome")
    logo = models.ImageField(upload_to="device_manufacturers/logos/", null=True, blank=True, verbose_name="Logo")

    class Meta:
        verbose_name = "Produttore"
        verbose_name_plural = "Produttori"
        ordering = ["name"]

    def __str__(self):
        return self.name


class DeviceStatus(TimeStampedModel):
    name = models.CharField(max_length=128, unique=True, verbose_name="Nome")

    class Meta:
        verbose_name = "Stato device"
        verbose_name_plural = "Stati device"
        ordering = ["name"]

    def __str__(self):
        return self.name


class DeviceType(TimeStampedModel):
    name    = models.CharField(max_length=128, unique=True, verbose_name="Nome")
    dose_sr = models.BooleanField(default=False, verbose_name="DoseSR")

    class Meta:
        verbose_name = "Tipo device"
        verbose_name_plural = "Tipi device"
        ordering = ["name"]

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────────────────────
# RIS/PACS — registry globale dei sistemi
# ─────────────────────────────────────────────────────────────────────────────

class Rispacs(TimeStampedModel):
    name    = models.CharField(max_length=128, verbose_name="Nome")
    ip      = models.GenericIPAddressField(protocol="IPv4", null=True, blank=True, verbose_name="Indirizzo IP")
    port    = models.PositiveIntegerField(null=True, blank=True, verbose_name="Porta")
    aetitle = models.CharField(max_length=128, null=True, blank=True, verbose_name="AE Title")

    class Meta:
        verbose_name = "Sistema RIS/PACS"
        verbose_name_plural = "Sistemi RIS/PACS"
        ordering = ["name"]

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────────────────────
# Device principale
# ─────────────────────────────────────────────────────────────────────────────

class Device(TimeStampedModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="devices",
        null=False,
        blank=False,
        verbose_name="Customer",
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        related_name="devices",
        null=False,
        blank=False,
        verbose_name="Sito",
    )
    type = models.ForeignKey(
        DeviceType,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Tipo",
    )
    status = models.ForeignKey(
        DeviceStatus,
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        verbose_name="Stato",
    )
    manufacturer = models.ForeignKey(
        DeviceManufacturer,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name="Produttore",
    )

    model         = models.CharField(max_length=255, null=True, blank=True, verbose_name="Modello")
    aetitle       = models.CharField(max_length=128, null=True, blank=True, verbose_name="AE Title")
    serial_number = models.CharField(max_length=128, null=True, blank=True, verbose_name="Numero seriale")
    inventario    = models.CharField(max_length=128, null=True, blank=True, verbose_name="Inventario")
    reparto       = models.CharField(max_length=128, null=True, blank=True, verbose_name="Reparto")
    room          = models.CharField(max_length=128, null=True, blank=True, verbose_name="Stanza/Sala")

    ip = models.GenericIPAddressField(
        protocol="IPv4",
        null=True,
        blank=True,
        verbose_name="Indirizzo IP",
    )

    vlan    = models.BooleanField(default=False, verbose_name="VLAN")
    dose    = models.BooleanField(default=False, verbose_name="DoseSR")
    wifi    = models.BooleanField(default=False, verbose_name="WiFi")
    rispacs = models.BooleanField(default=False, verbose_name="RIS/PACS")

    custom_fields = models.JSONField(null=True, blank=True, verbose_name="Campi personalizzati")
    note     = models.TextField(null=True, blank=True, verbose_name="Note")
    location = models.CharField(max_length=255, null=True, blank=True, verbose_name="Posizione")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        verbose_name = "Device"
        verbose_name_plural = "Device"
        indexes = [
            models.Index(fields=["deleted_at"],            name="dev_deleted_at_idx"),
            models.Index(fields=["customer", "deleted_at"], name="dev_customer_del_idx"),
            models.Index(fields=["site", "deleted_at"],    name="dev_site_del_idx"),
            models.Index(fields=["updated_at"],            name="dev_updated_at_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["ip"],
                condition=models.Q(deleted_at__isnull=True, ip__isnull=False),
                name="ux_devices_ip_active",
            ),
            models.UniqueConstraint(
                fields=["serial_number"],
                condition=models.Q(deleted_at__isnull=True, serial_number__isnull=False),
                name="ux_devices_serial_active",
            ),
        ]

    def clean(self):
        if self.site_id and self.customer_id:
            if self.site.customer_id != self.customer_id:
                raise ValidationError({"site": "Il sito selezionato non appartiene al customer."})

    def __str__(self):
        parts = [str(self.type) if self.type_id else "Device"]
        if self.model:
            parts.append(self.model)
        if self.serial_number:
            parts.append(f"S/N:{self.serial_number}")
        return " — ".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# Associazione Device ↔ RIS/PACS (M2M esplicita, soli ID)
# ─────────────────────────────────────────────────────────────────────────────

class DeviceRispacs(models.Model):
    device  = models.ForeignKey(Device,  on_delete=models.CASCADE, related_name="rispacs_links",  verbose_name="Device")
    rispacs = models.ForeignKey(Rispacs, on_delete=models.CASCADE, related_name="device_links", verbose_name="Sistema RIS/PACS")

    class Meta:
        verbose_name = "Associazione Device-RIS/PACS"
        verbose_name_plural = "Associazioni Device-RIS/PACS"
        constraints = [
            models.UniqueConstraint(fields=["device", "rispacs"], name="ux_device_rispacs"),
        ]
        ordering = ["device", "rispacs"]

    def __str__(self):
        return f"{self.device_id} ↔ {self.rispacs_id}"


# ─────────────────────────────────────────────────────────────────────────────
# WiFi (massimo uno per device, presente solo se device.wifi == True)
# ─────────────────────────────────────────────────────────────────────────────

def _wifi_cert_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1]
    return f"device_wifi/{instance.device_id}/cert{ext}"


class DeviceWifi(TimeStampedModel):
    device = models.OneToOneField(
        Device,
        on_delete=models.CASCADE,
        related_name="wifi_detail",
        verbose_name="Device",
    )
    ip = models.GenericIPAddressField(
        protocol="IPv4",
        null=True,
        blank=True,
        verbose_name="Indirizzo IP WiFi",
    )
    mac_address = models.CharField(
        max_length=17,
        null=True,
        blank=True,
        verbose_name="MAC Address",
        help_text="Formato: AA:BB:CC:DD:EE:FF",
    )
    certificato = models.FileField(
        upload_to=_wifi_cert_upload_path,
        null=True,
        blank=True,
        verbose_name="Certificato (.p12)",
    )
    pass_certificato = models.CharField(
        max_length=512,
        null=True,
        blank=True,
        verbose_name="Password certificato",
    )
    scad_certificato = models.DateField(
        null=True,
        blank=True,
        verbose_name="Scadenza certificato",
    )

    class Meta:
        verbose_name = "WiFi device"
        verbose_name_plural = "WiFi device"

    def __str__(self):
        return f"WiFi {self.device_id} — {self.ip}"

    def save(self, *args, **kwargs):
        if self.pass_certificato not in (None, ""):
            self.pass_certificato = encrypt(self.pass_certificato)
        super().save(*args, **kwargs)
