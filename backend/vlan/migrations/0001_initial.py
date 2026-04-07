from __future__ import annotations

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("crm", "0008_customer_vpn_access"),
    ]

    operations = [
        migrations.CreateModel(
            name="Vlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("vlan_id", models.PositiveIntegerField(verbose_name="VLAN ID")),
                ("name", models.CharField(max_length=255, verbose_name="Nome / Descrizione")),
                (
                    "network",
                    models.CharField(
                        help_text="Es. 10.241.0.64/26",
                        max_length=18,
                        verbose_name="Network (CIDR)",
                        validators=[django.core.validators.RegexValidator(
                            regex=r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2}$',
                            message='Formato CIDR non valido.',
                        )],
                    ),
                ),
                (
                    "subnet",
                    models.CharField(
                        help_text="Es. 255.255.255.192",
                        max_length=15,
                        verbose_name="Subnet mask",
                    ),
                ),
                (
                    "gateway",
                    models.CharField(
                        help_text="Es. 10.241.0.65",
                        max_length=15,
                        verbose_name="Gateway",
                    ),
                ),
                (
                    "lan",
                    models.CharField(
                        blank=True,
                        help_text="Es. 172.26.99.0/24",
                        max_length=18,
                        null=True,
                        verbose_name="LAN",
                    ),
                ),
                ("note", models.TextField(blank=True, null=True, verbose_name="Note")),
                (
                    "customer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="vlans",
                        to="crm.customer",
                        verbose_name="Customer",
                    ),
                ),
                (
                    "site",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="vlans",
                        to="crm.site",
                        verbose_name="Sede",
                    ),
                ),
            ],
            options={
                "verbose_name": "VLAN",
                "verbose_name_plural": "VLAN",
                "ordering": ["site", "vlan_id"],
            },
        ),
        migrations.AddConstraint(
            model_name="vlan",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=["customer", "vlan_id"],
                name="ux_vlan_customer_vlan_id_active",
            ),
        ),
    ]
