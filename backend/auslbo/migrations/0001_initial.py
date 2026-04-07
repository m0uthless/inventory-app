from __future__ import annotations

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("crm", "0008_customer_vpn_access"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AuslBoUserProfile",
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
                        help_text="Note interne sull'utente portal (non visibili al portal stesso).",
                        verbose_name="Note",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "customer",
                    models.ForeignKey(
                        help_text="Il cliente i cui dati sono visibili a questo utente portal.",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="auslbo_users",
                        to="crm.customer",
                        verbose_name="Cliente associato",
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="auslbo_profile",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Utente",
                    ),
                ),
            ],
            options={
                "verbose_name": "Profilo AUSL BO",
                "verbose_name_plural": "Profili AUSL BO",
                "ordering": ["user__username"],
            },
        ),
    ]
