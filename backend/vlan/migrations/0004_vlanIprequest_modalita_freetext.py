from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("vlan", "0003_vlanIprequest_rispacs_config"),
    ]

    operations = [
        migrations.AlterField(
            model_name="vlanIprequest",
            name="modalita",
            field=models.CharField(max_length=128, verbose_name="Modalità"),
        ),
    ]
