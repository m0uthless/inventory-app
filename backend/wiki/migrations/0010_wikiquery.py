from __future__ import annotations

import django.contrib.postgres.fields
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("wiki", "0009_wikipagerating"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="WikiQuery",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=255, verbose_name="Titolo")),
                (
                    "language",
                    models.CharField(
                        choices=[
                            ("sql",        "SQL"),
                            ("tsql",       "T-SQL"),
                            ("plpgsql",    "PL/pgSQL"),
                            ("powershell", "PowerShell"),
                            ("bash",       "Bash / Shell"),
                            ("python",     "Python"),
                            ("other",      "Altro"),
                        ],
                        default="sql",
                        max_length=32,
                        verbose_name="Linguaggio",
                    ),
                ),
                ("body", models.TextField(verbose_name="Query")),
                ("description", models.TextField(blank=True, null=True, verbose_name="Descrizione")),
                (
                    "tags",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.TextField(),
                        blank=True,
                        null=True,
                        size=None,
                        verbose_name="Tag",
                    ),
                ),
                ("use_count", models.PositiveIntegerField(default=0, verbose_name="Utilizzi")),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Query",
                "verbose_name_plural": "Query",
                "ordering": ["title"],
            },
        ),
    ]
