import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0015_userprofile_last_seen_changelog"),
    ]

    operations = [
        migrations.CreateModel(
            name="AreaTask",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200, verbose_name="Titolo")),
                ("description", models.TextField(blank=True, verbose_name="Descrizione")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("da_fare", "Da fare"),
                            ("in_corso", "In corso"),
                            ("completato", "Completato"),
                        ],
                        default="da_fare",
                        max_length=16,
                        verbose_name="Stato",
                    ),
                ),
                ("due_date", models.DateField(blank=True, null=True, verbose_name="Scadenza")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "area",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tasks",
                        to="attendance.leavearea",
                        verbose_name="Area",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_area_tasks",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Creato da",
                    ),
                ),
            ],
            options={
                "verbose_name": "Task di area",
                "verbose_name_plural": "Task di area",
                "ordering": ["status", "due_date", "-created_at"],
            },
        ),
    ]
