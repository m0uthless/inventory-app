from django.db import models
from django.contrib.postgres.fields import ArrayField

from core.models import TimeStampedModel


class CustomFieldDefinition(TimeStampedModel):
    class Entity(models.TextChoices):
        CUSTOMER = "customer", "Cliente"
        SITE = "site", "Sito"
        INVENTORY = "inventory", "Inventario"
        MAINTENANCE_PLAN = "maintenance_plan", "Piano manutenzione"

    class FieldType(models.TextChoices):
        TEXT = "text", "Testo"
        NUMBER = "number", "Numero"
        DATE = "date", "Data"
        SELECT = "select", "Selezione"
        BOOLEAN = "boolean", "Boolean"

    entity = models.CharField(max_length=32, choices=Entity.choices)

    # snake_case key used inside JSONField (custom_fields)
    key = models.SlugField(max_length=64)
    label = models.CharField(max_length=128)

    field_type = models.CharField(max_length=16, choices=FieldType.choices, default=FieldType.TEXT)
    required = models.BooleanField(default=False)

    # For select fields: list of allowed values (strings)
    options = models.JSONField(null=True, blank=True)

    # Alternative keys accepted from legacy data or user input.
    aliases = ArrayField(models.TextField(), null=True, blank=True)

    help_text = models.CharField(max_length=255, null=True, blank=True)
    sort_order = models.IntegerField(default=0)

    is_active = models.BooleanField(default=True)
    is_sensitive = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Campo custom"
        verbose_name_plural = "Campi custom"
        constraints = [
            models.UniqueConstraint(
                fields=["entity", "key"],
                condition=models.Q(deleted_at__isnull=True),
                name="ux_customfielddefinition_entity_key_active",
            )
        ]
        ordering = ["entity", "sort_order", "label", "key"]

    def __str__(self) -> str:
        return f"{self.entity}:{self.key}"
