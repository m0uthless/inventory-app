from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models
import device.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("crm", "0008_customer_vpn_access"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Lookup tables ────────────────────────────────────────────────────

        migrations.CreateModel(
            name="DeviceManufacturer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=128, unique=True, verbose_name="Nome")),
            ],
            options={"verbose_name": "Produttore", "verbose_name_plural": "Produttori", "ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="DeviceStatus",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=128, unique=True, verbose_name="Nome")),
            ],
            options={"verbose_name": "Stato device", "verbose_name_plural": "Stati device", "ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="DeviceType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=128, unique=True, verbose_name="Nome")),
            ],
            options={"verbose_name": "Tipo device", "verbose_name_plural": "Tipi device", "ordering": ["name"]},
        ),

        # ── Device ───────────────────────────────────────────────────────────

        migrations.CreateModel(
            name="Device",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("model", models.CharField(blank=True, max_length=255, null=True, verbose_name="Modello")),
                ("serial_number", models.CharField(blank=True, max_length=128, null=True, verbose_name="Numero seriale")),
                ("inventario", models.CharField(blank=True, max_length=128, null=True, verbose_name="Inventario")),
                ("ip", models.GenericIPAddressField(blank=True, null=True, protocol="IPv4", verbose_name="Indirizzo IP")),
                ("vlan", models.BooleanField(default=False, verbose_name="VLAN")),
                ("wifi", models.BooleanField(default=False, verbose_name="WiFi")),
                ("rispacs", models.BooleanField(default=False, verbose_name="RIS/PACS")),
                ("custom_fields", models.JSONField(blank=True, null=True, verbose_name="Campi personalizzati")),
                ("customer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="devices", to="crm.customer", verbose_name="Customer")),
                ("site", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="devices", to="crm.site", verbose_name="Sito")),
                ("type", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="device.devicetype", verbose_name="Tipo")),
                ("status", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="device.devicestatus", verbose_name="Stato")),
                ("manufacturer", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to="device.devicemanufacturer", verbose_name="Produttore")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Device", "verbose_name_plural": "Device"},
        ),
        migrations.AddIndex(
            model_name="device",
            index=models.Index(fields=["deleted_at"], name="dev_deleted_at_idx"),
        ),
        migrations.AddIndex(
            model_name="device",
            index=models.Index(fields=["customer", "deleted_at"], name="dev_customer_del_idx"),
        ),
        migrations.AddIndex(
            model_name="device",
            index=models.Index(fields=["site", "deleted_at"], name="dev_site_del_idx"),
        ),
        migrations.AddIndex(
            model_name="device",
            index=models.Index(fields=["updated_at"], name="dev_updated_at_idx"),
        ),
        migrations.AddConstraint(
            model_name="device",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True, ip__isnull=False),
                fields=["ip"],
                name="ux_devices_ip_active",
            ),
        ),
        migrations.AddConstraint(
            model_name="device",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True, serial_number__isnull=False),
                fields=["serial_number"],
                name="ux_devices_serial_active",
            ),
        ),

        # ── RIS/PACS ─────────────────────────────────────────────────────────

        migrations.CreateModel(
            name="DeviceRispacs",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("type", models.CharField(blank=True, max_length=128, null=True, verbose_name="Tipo")),
                ("ip", models.GenericIPAddressField(blank=True, null=True, protocol="IPv4", verbose_name="Indirizzo IP")),
                ("port", models.PositiveIntegerField(blank=True, null=True, verbose_name="Porta")),
                ("aetitle", models.CharField(blank=True, max_length=128, null=True, verbose_name="AE Title")),
                ("device", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="rispacs_entries", to="device.device", verbose_name="Device")),
            ],
            options={"verbose_name": "RIS/PACS", "verbose_name_plural": "RIS/PACS", "ordering": ["id"]},
        ),

        # ── WiFi ─────────────────────────────────────────────────────────────

        migrations.CreateModel(
            name="DeviceWifi",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("ip", models.GenericIPAddressField(blank=True, null=True, protocol="IPv4", verbose_name="Indirizzo IP WiFi")),
                ("certificato", models.FileField(blank=True, null=True, upload_to=device.models._wifi_cert_upload_path, verbose_name="Certificato (.p12)")),
                ("pass_certificato", models.CharField(blank=True, max_length=512, null=True, verbose_name="Password certificato")),
                ("scad_certificato", models.DateField(blank=True, null=True, verbose_name="Scadenza certificato")),
                ("device", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="wifi_detail", to="device.device", verbose_name="Device")),
            ],
            options={"verbose_name": "WiFi device", "verbose_name_plural": "WiFi device"},
        ),
    ]
