from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("device", "0005_devicetype_dose_sr_device_note_location"),
    ]

    operations = [
        migrations.AddField(
            model_name="device",
            name="dose",
            field=models.BooleanField(default=False, verbose_name="DoseSR"),
        ),
    ]
