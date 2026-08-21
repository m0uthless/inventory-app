# 0.9.1 (WP-05, archie-dataconstraints — audit 2026-08-19, DATA-002).
#
# Solo serial_number, non knumber — confermato con Fede: più inventory
# possono condividere legittimamente lo stesso knumber (es. un host
# fisico e le sue macchine virtuali), coerente con
# 0007_inventory_knumber_serial_not_unique/
# 0008_remove_knumber_serial_unique_constraints che avevano rimosso
# ENTRAMBI i vincoli in passato — qui reintroduciamo solo quello corretto.
#
# ATTENZIONE PRIMA DI ESEGUIRE: se esistono già in produzione due o più
# inventory ATTIVI (deleted_at NULL) con lo stesso serial_number, questa
# migration fallisce con un IntegrityError esplicito invece di applicare
# in silenzio una correzione automatica — decidere quale dei duplicati sia
# quello "corretto" non è una decisione che va presa a livello di
# migration senza una verifica umana. In quel caso: esegui prima
#
#   SELECT serial_number, array_agg(id) FROM inventory_inventory
#   WHERE deleted_at IS NULL AND serial_number IS NOT NULL
#   GROUP BY serial_number HAVING count(*) > 1;
#
# per trovare i duplicati, correggili manualmente (o soft-delete la riga
# sbagliata), poi rilancia la migration.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0012_widen_encrypted_password_fields'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='inventory',
            constraint=models.UniqueConstraint(
                fields=['serial_number'],
                condition=models.Q(('deleted_at__isnull', True), ('serial_number__isnull', False)),
                name='ux_inventories_serial_active',
            ),
        ),
    ]
