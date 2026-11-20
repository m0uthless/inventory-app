"""Contratti senza disdetta (spec 2026-11-20): l'anticipo diventa l'avviso di
rinnovo, lo stato «Disdetto» diventa «Chiuso», via il rinnovo automatico."""
from django.db import migrations, models


def disdetto_to_chiuso(apps, schema_editor):
    apps.get_model("contracts", "Contract").objects.filter(status="disdetto").update(status="chiuso")


def chiuso_to_disdetto(apps, schema_editor):
    apps.get_model("contracts", "Contract").objects.filter(status="chiuso").update(status="disdetto")


class Migration(migrations.Migration):

    dependencies = [
        ("contracts", "0002_contract_company"),
    ]

    operations = [
        migrations.RenameField(model_name="contract", old_name="notice_days", new_name="reminder_days"),
        migrations.RemoveField(model_name="contract", name="auto_renew"),
        migrations.AlterField(
            model_name="contract",
            name="status",
            field=models.CharField(
                choices=[("bozza", "Bozza"), ("attivo", "Attivo"), ("chiuso", "Chiuso")],
                default="bozza", max_length=16,
            ),
        ),
        migrations.RunPython(disdetto_to_chiuso, chiuso_to_disdetto),
    ]
