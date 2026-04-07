from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("device", "0006_device_dose"),
    ]

    operations = [
        migrations.AddField(
            model_name="device",
            name="aetitle",
            field=models.CharField(blank=True, max_length=128, null=True, verbose_name="AE Title"),
        ),
    ]
