from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("device", "0001_initial"),
    ]

    operations = [
        # 1. Elimina la vecchia tabella DeviceRispacs (FK diretta a Device)
        migrations.DeleteModel(name="DeviceRispacs"),

        # 2. Crea il registry globale Rispacs
        migrations.CreateModel(
            name="Rispacs",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name",    models.CharField(max_length=128, verbose_name="Nome")),
                ("ip",      models.GenericIPAddressField(blank=True, null=True, protocol="IPv4", verbose_name="Indirizzo IP")),
                ("port",    models.PositiveIntegerField(blank=True, null=True, verbose_name="Porta")),
                ("aetitle", models.CharField(blank=True, max_length=128, null=True, verbose_name="AE Title")),
            ],
            options={
                "verbose_name": "Sistema RIS/PACS",
                "verbose_name_plural": "Sistemi RIS/PACS",
                "ordering": ["name"],
            },
        ),

        # 3. Crea la nuova tabella associativa DeviceRispacs (solo ID)
        migrations.CreateModel(
            name="DeviceRispacs",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("device",  models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="rispacs_links",  to="device.device",  verbose_name="Device")),
                ("rispacs", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="device_links", to="device.rispacs", verbose_name="Sistema RIS/PACS")),
            ],
            options={
                "verbose_name": "Associazione Device-RIS/PACS",
                "verbose_name_plural": "Associazioni Device-RIS/PACS",
                "ordering": ["device", "rispacs"],
            },
        ),
        migrations.AddConstraint(
            model_name="devicerispacs",
            constraint=models.UniqueConstraint(fields=["device", "rispacs"], name="ux_device_rispacs"),
        ),
    ]
