from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('purchaseorders', '0006_remove_purchaseorderentry_documents'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseorderentry',
            name='customer_placeholder',
            field=models.CharField(
                blank=True, max_length=255,
                verbose_name='Cliente collegato (testo libero)',
                help_text=(
                    'Nome del cliente su cui è stato eseguito il lavoro, quando non '
                    'è ancora presente in anagrafica. Alternativo al campo Cliente.'
                ),
            ),
        ),
    ]
