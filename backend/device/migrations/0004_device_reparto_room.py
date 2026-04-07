from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("device", "0003_devicemanufacturer_logo"),
    ]

    operations = [
        migrations.AddField(
            model_name="device",
            name="reparto",
            field=models.CharField(blank=True, max_length=128, null=True, verbose_name="Reparto"),
        ),
        migrations.AddField(
            model_name="device",
            name="room",
            field=models.CharField(blank=True, max_length=128, null=True, verbose_name="Stanza/Sala"),
        ),
    ]
