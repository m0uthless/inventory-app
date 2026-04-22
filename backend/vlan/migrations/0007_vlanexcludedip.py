from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("vlan", "0006_vlanIprequest_reparto"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="VlanExcludedIp",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("ip", models.GenericIPAddressField(protocol="IPv4", verbose_name="Indirizzo IP")),
                ("note", models.TextField(blank=True, null=True, verbose_name="Note")),
                ("vlan", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="excluded_ips", to="vlan.vlan", verbose_name="VLAN")),
                ("excluded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL, verbose_name="Escluso da")),
            ],
            options={
                "verbose_name": "IP escluso",
                "verbose_name_plural": "IP esclusi",
            },
        ),
        migrations.AddConstraint(
            model_name="vlanexcludedip",
            constraint=models.UniqueConstraint(fields=["vlan", "ip"], name="ux_vlan_excluded_ip"),
        ),
    ]
