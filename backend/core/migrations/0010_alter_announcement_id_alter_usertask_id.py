"""Allinea la PK di announcement e usertask a DEFAULT_AUTO_FIELD (BigAutoField).

Le due tabelle erano state create (core/0005, core/0006) con AutoField esplicito,
mentre settings.DEFAULT_AUTO_FIELD e' BigAutoField: la PK passa da integer a
bigint. E' un cambiamento di schema reale, ma sicuro:
- nessuna FK entrante verso announcement o usertask (verificato), quindi non ci
  sono colonne referenzianti da riscrivere a cascata;
- sono tabelle piccole (comunicazioni e task utente), il rewrite e' immediato.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_userprofile_is_servicenow_technician'),
    ]

    operations = [
        migrations.AlterField(
            model_name='announcement',
            name='id',
            field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID'),
        ),
        migrations.AlterField(
            model_name='usertask',
            name='id',
            field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID'),
        ),
    ]
