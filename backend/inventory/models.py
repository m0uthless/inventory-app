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

    knumber = models.CharField(max_length=64, null=True, blank=True, verbose_name="K-Number")
    serial_number = models.CharField(max_length=128, null=True, blank=True, verbose_name="Numero seriale")

    type = models.ForeignKey(InventoryType, on_delete=models.PROTECT, null=False, blank=False)

    os_user = models.CharField(max_length=128, null=True, blank=True)
    # 0.9.1 (WP-05, archie-dataconstraints — audit 2026-08-19, DATA-001):
    # erano max_length=128, ma il valore salvato è CIFRATO (Fernet, non il
    # plaintext) — un token Fernet per un plaintext di 32+ caratteri supera
    # già 128 caratteri (verificato: 31 caratteri in chiaro -> 125
    # caratteri cifrati, ok; 32 caratteri in chiaro -> 145, overflow).
    # Qualunque password/passphrase moderna abbastanza robusta (32+
    # caratteri, comune con un password manager) falliva il salvataggio
    # con un errore Postgres poco chiaro. 512 allinea questi tre campi
    # allo stesso dimensionamento già usato per CustomerVpnAccess.password
    # e DeviceWifi.pass_certificato, entrambi cifrati allo stesso modo.
    os_pwd = models.CharField(max_length=512, null=True, blank=True)
    app_usr = models.CharField(max_length=128, null=True, blank=True)
    app_pwd = models.CharField(max_length=512, null=True, blank=True)
    vnc_pwd = models.CharField(max_length=512, null=True, blank=True)

    hostname = models.CharField(max_length=255, null=True, blank=True)
    local_ip = models.CharField(max_length=64, null=True, blank=True)
    srsa_ip = models.CharField(max_length=64, null=True, blank=True)

    # 0.9.0: campi opzionali richiesti in scope consolidamento — posizione
    # fisica dell'inventario (es. stanza/reparto) e telefono di riferimento.
    location = models.CharField(max_length=255, null=True, blank=True, verbose_name="Posizione")
    telefono = models.CharField(max_length=64, null=True, blank=True, verbose_name="Telefono")

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
            ("view_secrets", "Può visualizzare le credenziali riservate dell'inventario"),
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
        constraints = [
            # 0.9.1 (WP-05, archie-dataconstraints — audit 2026-08-19,
            # DATA-002): SOLO serial_number, non knumber. Confermato con
            # Fede: più inventory possono legittimamente condividere lo
            # stesso knumber (es. un host fisico e le sue macchine
            # virtuali) — un vincolo di unicità su knumber sarebbe
            # SBAGLIATO, coerente con la migration 0007/0008 che lo aveva
            # rimosso deliberatamente in passato. serial_number resta
            # invece un identificativo hardware fisico, deve restare
            # univoco: qui aggiungiamo il vincolo DB che manca, a
            # completare il controllo applicativo già presente in
            # InventoryDetailSerializer.validate() (che da solo è una
            # classica TOCTOU sotto richieste concorrenti). Il blocco
            # applicativo su knumber duplicato in validate() (righe
            # ~254-260) NON è stato toccato in questa patch — resta in
            # piedi in attesa che Fede verifichi se va rimosso anche lì.
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
