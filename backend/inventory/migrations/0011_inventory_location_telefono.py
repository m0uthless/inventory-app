# Generated for 0.9.0 consolidamento — campi opzionali location e telefono

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0010_alter_inventory_options'),
    ]

    operations = [
        migrations.AddField(
            model_name='inventory',
            name='location',
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name='Posizione'),
        ),
        migrations.AddField(
            model_name='inventory',
            name='telefono',
            field=models.CharField(blank=True, max_length=64, null=True, verbose_name='Telefono'),
        ),
    ]
