from __future__ import annotations

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("vlan", "0001_initial"),
        ("device", "0007_device_aetitle"),
        ("crm", "0008_customer_vpn_access"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="VlanIpRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("ip", models.GenericIPAddressField(protocol="IPv4", verbose_name="Indirizzo IP riservato")),
                ("aetitle", models.CharField(blank=True, max_length=128, null=True, verbose_name="AE Title")),
                ("modalita", models.CharField(
                    choices=[
                        ("pacs", "PACS"),
                        ("pacs_emergenza", "PACS Emergenza"),
                        ("worklist", "Worklist"),
                        ("altro", "Altro"),
                    ],
                    max_length=32,
                    verbose_name="Modalità",
                )),
                ("stato", models.CharField(
                    choices=[
                        ("pending", "In attesa"),
                        ("approved", "Approvata"),
                        ("rejected", "Rifiutata"),
                    ],
                    default="pending",
                    max_length=16,
                    verbose_name="Stato",
                )),
                ("note", models.TextField(blank=True, null=True, verbose_name="Note")),
                ("approvato_at", models.DateTimeField(blank=True, null=True, verbose_name="Data approvazione")),
                ("customer", models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="vlan_ip_requests",
                    to="crm.customer",
                    verbose_name="Customer",
                )),
                ("vlan", models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="ip_requests",
                    to="vlan.vlan",
                    verbose_name="VLAN",
                )),
                ("rispacs", models.ManyToManyField(
                    blank=True,
                    related_name="ip_requests",
                    to="device.rispacs",
                    verbose_name="Sistemi RIS/PACS",
                )),
                ("richiedente", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="vlan_ip_requests_create",
                    to=settings.AUTH_USER_MODEL,
                    verbose_name="Richiedente",
                )),
                ("approvato_da", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="vlan_ip_requests_approve",
                    to=settings.AUTH_USER_MODEL,
                    verbose_name="Approvato da",
                )),
            ],
            options={
                "verbose_name": "Richiesta IP VLAN",
                "verbose_name_plural": "Richieste IP VLAN",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="vlanIprequest",
            constraint=models.UniqueConstraint(
                condition=models.Q(stato="pending"),
                fields=["vlan", "ip"],
                name="ux_vlan_ip_request_pending",
            ),
        ),
    ]
