from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("vlan", "0002_vlanIprequest"),
    ]

    operations = [
        migrations.AddField(
            model_name="vlanIprequest",
            name="rispacs_config",
            field=models.JSONField(
                blank=True,
                null=True,
                verbose_name="Configurazione RIS/PACS",
                help_text="Lista di {rispacs_id, etichetta} per ogni sistema associato.",
            ),
        ),
    ]
