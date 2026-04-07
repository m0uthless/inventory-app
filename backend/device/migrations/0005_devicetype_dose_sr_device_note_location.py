from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("device", "0004_device_reparto_room"),
    ]

    operations = [
        migrations.AddField(
            model_name="devicetype",
            name="dose_sr",
            field=models.BooleanField(default=False, verbose_name="DoseSR"),
        ),
        migrations.AddField(
            model_name="device",
            name="note",
            field=models.TextField(blank=True, null=True, verbose_name="Note"),
        ),
        migrations.AddField(
            model_name="device",
            name="location",
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name="Posizione"),
        ),
    ]
