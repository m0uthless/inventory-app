from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("device", "0002_rispacs_registry"),
    ]

    operations = [
        migrations.AddField(
            model_name="devicemanufacturer",
            name="logo",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="device_manufacturers/logos/",
                verbose_name="Logo",
            ),
        ),
    ]
