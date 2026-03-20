from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_userprofile"),
    ]

    operations = [
        migrations.AddField(
            model_name="inventorytype",
            name="is_hw",
            field=models.BooleanField(
                default=False,
                help_text="Indica se questo tipo di inventory è un dispositivo hardware (Y) o software/altro (N).",
                verbose_name="Hardware",
            ),
        ),
    ]
