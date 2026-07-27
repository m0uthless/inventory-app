import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0013_usermanagementaccess"),
    ]

    operations = [
        migrations.CreateModel(
            name="ChangelogEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("version", models.CharField(blank=True, max_length=32, verbose_name="Versione")),
                ("title", models.CharField(max_length=255, verbose_name="Titolo")),
                ("body", models.TextField(verbose_name="Testo (Markdown)")),
                ("date", models.DateField(default=timezone.localdate, verbose_name="Data rilascio")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="changelog_entries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Voce changelog",
                "verbose_name_plural": "Changelog",
                "ordering": ["-date", "-id"],
            },
        ),
    ]
