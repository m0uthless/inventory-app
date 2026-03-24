# Generated manually — aggiunge MaintenancePlanInventory (pivot piano/inventory con override data)
from __future__ import annotations

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0001_initial"),
        ("maintenance", "0009_maintenanceevent_created_by"),
    ]

    operations = [
        migrations.CreateModel(
            name="MaintenancePlanInventory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("due_date_override", models.DateField(blank=True, null=True)),
                ("notes", models.TextField(blank=True, null=True)),
                (
                    "inventory",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="plan_memberships",
                        to="inventory.inventory",
                    ),
                ),
                (
                    "plan",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="plan_inventories",
                        to="maintenance.maintenanceplan",
                    ),
                ),
            ],
            options={
                "verbose_name": "Inventory nel piano",
                "verbose_name_plural": "Inventory nel piano",
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="maintenanceplaninventory",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=["plan", "inventory"],
                name="ux_plan_inventory_active",
            ),
        ),
    ]
