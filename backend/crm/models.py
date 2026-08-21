from django.conf import settings
from django.db import models
from django.core.validators import RegexValidator
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from core.models import TimeStampedModel, CustomerStatus, SiteStatus
from core.crypto import encrypt

phone_validator = RegexValidator(
    regex=r"^[0-9+ ()\-\.]{5,30}$",
    message="Numero di telefono non valido.",
)

class Customer(TimeStampedModel):
    code = models.CharField(max_length=16, null=True, blank=True)  # auto su save (001)
    name = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255, null=True, blank=True)

    vat_number = models.CharField(max_length=32, null=True, blank=True)
    tax_code = models.CharField(max_length=32, null=True, blank=True)

    status = models.ForeignKey(CustomerStatus, on_delete=models.PROTECT)
    notes = models.TextField(null=True, blank=True)
    tags = ArrayField(models.TextField(), null=True, blank=True)
    custom_fields = models.JSONField(null=True, blank=True)

    # Promosso da custom field a colonna strutturata (era "provincia" nei
    # custom_fields, vedi crm/migrations/0010_customer_province.py). Nome
    # inglese per coerenza con Site.province, che già esisteva strutturato.
    province = models.CharField(max_length=32, null=True, blank=True, verbose_name="Provincia")

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        verbose_name = "Cliente"
        verbose_name_plural = "Clienti"
        indexes = [
            # Hot paths:
            # - list views filter by deleted_at (soft delete)
            # - ordering frequently uses updated_at
            models.Index(fields=["deleted_at"], name="cust_deleted_at_idx"),
            models.Index(fields=["updated_at"], name="cust_updated_at_idx"),
            # GIN index su custom_fields: rende efficienti i filtri JSON
            # usati da CustomerFilter.filter_city e dalle ricerche full-text
            # sul campo (es. KeyTextTransform, __icontains su Cast).
            GinIndex(fields=["custom_fields"], name="cust_custom_fields_gin"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["code"],
                condition=models.Q(deleted_at__isnull=True, code__isnull=False),
                name="ux_customers_code_active",
            ),
            models.UniqueConstraint(
                fields=["vat_number"],
                condition=models.Q(deleted_at__isnull=True, vat_number__isnull=False),
                name="ux_customers_vat_active",
            ),
            models.UniqueConstraint(
                fields=["tax_code"],
                condition=models.Q(deleted_at__isnull=True, tax_code__isnull=False),
                name="ux_customers_tax_active",
            ),
        ]

    def save(self, *args, **kwargs):
        creating = self.pk is None
        super().save(*args, **kwargs)
        if creating and not self.code:
            self.code = f"{self.id:03d}"
            Customer.objects.filter(pk=self.pk).update(code=self.code)

    def __str__(self):
        return f"{self.code or ''} {self.name}".strip()


class Site(TimeStampedModel):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="sites")
    name = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255, null=True, blank=True)
    status = models.ForeignKey(SiteStatus, on_delete=models.PROTECT)

    address_line1 = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=128, null=True, blank=True)
    postal_code = models.CharField(max_length=16, null=True, blank=True)
    province = models.CharField(max_length=32, null=True, blank=True)
    country = models.CharField(max_length=2, null=True, blank=True, default="IT")

    notes = models.TextField(null=True, blank=True)
    tags = ArrayField(models.TextField(), null=True, blank=True)
    custom_fields = models.JSONField(null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        verbose_name = "Sito"
        verbose_name_plural = "Siti"
        indexes = [
            models.Index(fields=["deleted_at"], name="site_deleted_at_idx"),
            models.Index(fields=["customer", "deleted_at"], name="site_customer_del_idx"),
            models.Index(fields=["updated_at"], name="site_updated_at_idx"),
        ]

    def __str__(self):
        return f"{self.customer.code if self.customer_id else self.customer_id} - {self.name}"


class Contact(TimeStampedModel):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="contacts")
    site = models.ForeignKey(Site, on_delete=models.PROTECT, null=True, blank=True, related_name="contacts")

    name = models.CharField(max_length=255)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=32, null=True, blank=True, validators=[phone_validator])
    department = models.CharField(max_length=255, null=True, blank=True)

    is_primary = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    def __str__(self) -> str:
        return self.name or f"Contact #{self.pk}"

    class Meta:
        indexes = [
            models.Index(fields=["deleted_at"], name="contact_deleted_at_idx"),
            models.Index(fields=["customer", "deleted_at"], name="contact_customer_del_idx"),
            models.Index(fields=["site", "deleted_at"], name="contact_site_del_idx"),
            models.Index(fields=["updated_at"], name="contact_updated_at_idx"),
            # Used by primary contact enforcement: customer+site+is_primary+deleted_at
            models.Index(fields=["customer", "site", "is_primary", "deleted_at"], name="contact_primary_idx"),
        ]
        constraints = [
            # 0.9.1 (WP-05, archie-dataconstraints — audit 2026-08-19,
            # DATA-003): "un solo contatto primario per customer/site" era
            # garantito SOLO in application code (ContactViewSet.
            # _enforce_primary, eseguito DOPO il save, in una query
            # separata non atomica) — due richieste concorrenti che
            # impostano is_primary=True su due contatti diversi per lo
            # stesso customer/site potevano risultare entrambe primarie.
            # Due constraint separati (non uno solo su customer+site)
            # perché in SQL standard NULL non è mai uguale a un altro
            # NULL: un singolo UniqueConstraint su (customer, site) non
            # avrebbe impedito due contatti primari con site=NULL per lo
            # stesso customer (il caso "contatto a livello customer, non
            # legato a un site specifico").
            models.UniqueConstraint(
                fields=["customer"],
                condition=models.Q(is_primary=True, deleted_at__isnull=True, site__isnull=True),
                name="ux_contact_one_primary_per_customer_no_site",
            ),
            models.UniqueConstraint(
                fields=["customer", "site"],
                condition=models.Q(is_primary=True, deleted_at__isnull=True, site__isnull=False),
                name="ux_contact_one_primary_per_customer_site",
            ),
        ]


class CustomerVpnAccess(TimeStampedModel):
    """Credenziali VPN dedicate per un cliente. La password è cifrata a riposo."""

    customer = models.OneToOneField(
        Customer,
        on_delete=models.CASCADE,
        related_name="vpn_access",
        verbose_name="Cliente",
    )

    applicativo = models.CharField(max_length=128, null=True, blank=True)
    utenza = models.CharField(max_length=255, null=True, blank=True)
    password = models.CharField(max_length=512, null=True, blank=True)  # stored encrypted
    remote_address = models.CharField(max_length=255, null=True, blank=True)
    porta = models.CharField(max_length=16, null=True, blank=True)
    note = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        verbose_name = "Accesso VPN Cliente"
        verbose_name_plural = "Accessi VPN Clienti"
        permissions = [
            ("view_vpn_secrets", "Può visualizzare le credenziali VPN (password)"),
        ]

    def save(self, *args, **kwargs):
        if self.password:
            self.password = encrypt(self.password)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"VPN {self.customer}"
