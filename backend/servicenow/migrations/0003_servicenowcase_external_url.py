# Generated manually, coerente con lo stile delle migrazioni precedenti

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('servicenow', '0002_servicenowcase_case_type_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='servicenowcase',
            name='external_url',
            field=models.URLField(blank=True, help_text='Link opzionale a una pagina esterna collegata al case', max_length=1000, verbose_name='URL'),
        ),
    ]
