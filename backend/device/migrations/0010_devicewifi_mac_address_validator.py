import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("device", "0009_devicewifi_view_wifi_secrets_permission"),
    ]

    operations = [
        migrations.AlterField(
            model_name="devicewifi",
            name="mac_address",
            field=models.CharField(
                blank=True,
                help_text="Formato: AA:BB:CC:DD:EE:FF",
                max_length=17,
                null=True,
                validators=[
                    django.core.validators.RegexValidator(
                        message="MAC address non valido. Formato atteso: AA:BB:CC:DD:EE:FF (o con separatore '-').",
                        regex="^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$",
                    )
                ],
                verbose_name="MAC Address",
            ),
        ),
    ]
