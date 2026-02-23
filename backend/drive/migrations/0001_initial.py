import django.db.models.deletion
import drive.models
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("crm", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DriveFolder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("notes", models.TextField(blank=True, null=True)),
                (
                    "parent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="children",
                        to="drive.drivefolder",
                    ),
                ),
                (
                    "customers",
                    models.ManyToManyField(
                        blank=True,
                        related_name="drive_folders",
                        to="crm.customer",
                    ),
                ),
                (
                    "allowed_groups",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Gruppi che possono accedere a questa cartella. Vuoto = tutti.",
                        related_name="drive_folders",
                        to="auth.group",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_drive_folders",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Cartella",
                "verbose_name_plural": "Cartelle",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="DriveFile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(help_text="Nome visualizzato (può differire dal nome fisico del file).", max_length=255)),
                ("file", models.FileField(upload_to=drive.models.drive_upload_path)),
                ("mime_type", models.CharField(blank=True, max_length=128)),
                ("size", models.PositiveBigIntegerField(default=0, help_text="Dimensione in byte")),
                ("notes", models.TextField(blank=True, null=True)),
                (
                    "folder",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="files",
                        to="drive.drivefolder",
                    ),
                ),
                (
                    "customers",
                    models.ManyToManyField(
                        blank=True,
                        related_name="drive_files",
                        to="crm.customer",
                    ),
                ),
                (
                    "allowed_groups",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Gruppi che possono accedere a questo file. Vuoto = tutti.",
                        related_name="drive_files",
                        to="auth.group",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_drive_files",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "File",
                "verbose_name_plural": "File",
                "ordering": ["name"],
            },
        ),
    ]
