# Generated manually — alza max_length di external_url da 500 a 1000.
# Necessaria perché la 0003 era già stata applicata con max_length=500
# prima che il valore fosse alzato nel modello.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('servicenow', '0003_servicenowcase_external_url'),
    ]

    operations = [
        migrations.AlterField(
            model_name='servicenowcase',
            name='external_url',
            field=models.URLField(blank=True, help_text='Link opzionale a una pagina esterna collegata al case', max_length=1000, verbose_name='URL'),
        ),
    ]
