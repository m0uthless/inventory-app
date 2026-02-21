from django.conf import settings
from django.db import models
from django.core.validators import RegexValidator
from django.contrib.postgres.fields import ArrayField
from core.models import TimeStampedModel, CustomerStatus, SiteStatus

phone_validator = RegexValidator(
    regex=r"^[0-9+ ()\-\.]{5,30}$",
    message="Numero di telefono non valido.",
)

class Customer(TimeStampedModel):
    code = models.CharField(max_length=16, null=True, blank=True)  # auto su save (C-000001)
    name = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255, null=True, blank=True)

    vat_number = models.CharField(max_length=32, null=True, blank=True)
    tax_code = models.CharField(max_length=32, null=True, blank=True)

    status = models.ForeignKey(CustomerStatus, on_delete=models.PROTECT)
    notes = models.TextField(null=True, blank=True)
    tags = ArrayField(models.TextField(), null=True, blank=True)
    custom_fields = models.JSONField(null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        verbose_name = "Cliente"
        verbose_name_plural = "Clienti"
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
            self.code = f"C-{self.id:06d}"
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
