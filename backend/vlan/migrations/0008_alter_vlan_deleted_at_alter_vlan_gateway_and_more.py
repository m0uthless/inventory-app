"""Allinea vlan/vlaniprequest ai modelli. Due tipi di cambiamento, molto diversi:

1) network / subnet / gateway — SOLO validators.
   Il modello usa _validate_network/_validate_subnet/_validate_ip, la migrazione
   0001 aveva un RegexValidator inline (network) o nessun validator
   (subnet, gateway). I validators vivono a livello Python: queste AlterField
   NON emettono alcun SQL. Servono solo a far tornare pulito
   `makemigrations --check`.

2) deleted_at — DROP INDEX (cambiamento reale).
   Le migrazioni 0001/0002 avevano creato deleted_at con db_index=True, ma
   core.SoftDeleteModel lo dichiara senza indice: vlan e vlaniprequest erano le
   uniche due tabelle soft-delete con quell'indice. Applicando questa migrazione
   l'indice viene rimosso e le due tabelle si allineano a tutte le altre.

   Perche' e' accettabile: l'indice serviva ai filtri `deleted_at IS NULL`, ma
   la colonna e' NULL nella quasi totalita' delle righe, quindi ha selettivita'
   bassissima e Postgres preferisce comunque un seq scan. Restava un costo in
   scrittura senza beneficio in lettura. Il constraint di unicita' parziale
   (condition=Q(deleted_at__isnull=True)) e' un indice separato e NON viene
   toccato.

   Se in futuro il volume rendesse utile un indice, la scelta corretta sarebbe
   un indice parziale su `deleted_at IS NULL` in SoftDeleteModel, valido per
   tutte le tabelle e non solo per queste due.
"""
import vlan.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('vlan', '0007_vlanexcludedip'),
    ]

    operations = [
        migrations.AlterField(
            model_name='vlan',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='vlan',
            name='gateway',
            field=models.CharField(help_text='Es. 10.241.0.65', max_length=15, validators=[vlan.models._validate_ip], verbose_name='Gateway'),
        ),
        migrations.AlterField(
            model_name='vlan',
            name='network',
            field=models.CharField(help_text='Es. 10.241.0.64/26', max_length=18, validators=[vlan.models._validate_network], verbose_name='Network (CIDR)'),
        ),
        migrations.AlterField(
            model_name='vlan',
            name='subnet',
            field=models.CharField(help_text='Es. 255.255.255.192', max_length=15, validators=[vlan.models._validate_subnet], verbose_name='Subnet mask'),
        ),
        migrations.AlterField(
            model_name='vlaniprequest',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
