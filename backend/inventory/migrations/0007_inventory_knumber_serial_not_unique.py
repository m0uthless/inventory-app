from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0006_monitor"),
    ]

    operations = [
        migrations.AlterField(
            model_name="inventory",
            name="knumber",
            field=models.CharField(
                blank=True,
                max_length=128,
                null=True,
                verbose_name="K-Number",
            ),
        ),
        migrations.AlterField(
            model_name="inventory",
            name="serial_number",
            field=models.CharField(
                blank=True,
                max_length=128,
                null=True,
                verbose_name="Numero seriale",
            ),
        ),
    ]
