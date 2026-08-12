from __future__ import annotations

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """Storia della vecchia app `auslbo` (0001_initial), portata nell'app
    `portal` a fronte del rename 0.9.0. Questa migration NON viene eseguita
    a fresco su un ambiente già esistente: sugli ambienti che avevano già
    applicato `auslbo.0001_initial`, il management command
    `rename_auslbo_to_portal` (vedi portal/management/commands/) rinomina la
    tabella fisica e riallinea `django_content_type`/`auth_permission`/
    `django_migrations` PRIMA che `migrate` giri, così Django la trova già
    "applicata" con questo stesso nome e non tenta di ricrearla.

    Su un ambiente NUOVO (nessuno storico `auslbo`), questa migration crea
    la tabella `portal_portaluserprofile` da zero, esattamente come avrebbe
    fatto la vecchia `auslbo.0001_initial` per `auslbo_auslbouserprofile`.
    """

    initial = True

    dependencies = [
        ("crm", "0008_customer_vpn_access"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PortalUserProfile",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "notes",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text="Note interne sull'utente portale (non visibili al portale stesso).",
                        verbose_name="Note",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "customer",
                    models.ForeignKey(
                        help_text="Il cliente i cui dati sono visibili a questo utente portale.",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="portal_users",
                        to="crm.customer",
                        verbose_name="Cliente associato",
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="portal_profile",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Utente",
                    ),
                ),
            ],
            options={
                "verbose_name": "Profilo Portal",
                "verbose_name_plural": "Profili Portal",
                "ordering": ["user__username"],
            },
        ),
    ]
