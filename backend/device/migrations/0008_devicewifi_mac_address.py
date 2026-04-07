from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("device", "0007_device_aetitle"),
    ]

    operations = [
        migrations.AddField(
            model_name="devicewifi",
            name="mac_address",
            field=models.CharField(
                blank=True,
                help_text="Formato: AA:BB:CC:DD:EE:FF",
                max_length=17,
                null=True,
                verbose_name="MAC Address",
            ),
        ),
    ]
