"""Allinea knumber alla definizione del modello: varchar(128) -> varchar(64).

Il modello dichiarava max_length=64 da tempo, ma l'ultima migrazione applicata
(0007) lasciava la colonna a 128: il DRF validava a 64 mentre il DB accettava
fino a 128. Questa migrazione chiude il disallineamento.

ATTENZIONE: restringere una varchar fallisce se esistono gia' valori piu' lunghi.
La RunPython qui sotto gira PRIMA dell'AlterField e in quel caso si ferma con un
messaggio che elenca le righe da correggere, invece di lasciare esplodere
Postgres con "value too long for type character varying(64)" a meta' transazione.
E' una guardia di sola lettura: non modifica ne' tronca alcun dato.
"""
from django.db import migrations, models


MAX_LEN = 64


def check_knumber_length(apps, schema_editor):
    Inventory = apps.get_model("inventory", "Inventory")

    # .iterator() per non caricare l'intera tabella in memoria.
    offending = [
        (pk, kn)
        for pk, kn in Inventory.objects.exclude(knumber__isnull=True)
        .values_list("pk", "knumber")
        .iterator()
        if kn is not None and len(kn) > MAX_LEN
    ]

    if offending:
        preview = "\n".join(
            f"  - Inventory(pk={pk}): {len(kn)} caratteri" for pk, kn in offending[:20]
        )
        more = f"\n  ... e altre {len(offending) - 20} righe" if len(offending) > 20 else ""
        raise RuntimeError(
            f"Impossibile ridurre knumber a {MAX_LEN} caratteri: "
            f"{len(offending)} righe superano il limite.\n"
            f"{preview}{more}\n\n"
            "Correggi o accorcia questi valori, poi rilancia la migrazione. "
            "Nessun dato e' stato modificato."
        )


def noop_reverse(apps, schema_editor):
    """Nulla da annullare: il forward e' una sola verifica."""


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0008_remove_knumber_serial_unique_constraints'),
    ]

    operations = [
        migrations.RunPython(check_knumber_length, noop_reverse),
        migrations.AlterField(
            model_name='inventory',
            name='knumber',
            field=models.CharField(blank=True, max_length=64, null=True, verbose_name='K-Number'),
        ),
    ]
