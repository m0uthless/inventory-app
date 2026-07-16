from django.db import migrations, models
import django.db.models.deletion


# Mappatura dei vecchi valori CharField case_type (cdd/privati/l1) verso i
# nuovi record ServiceNowCaseType. Tutti i case esistenti erano gestiti
# internamente da Biotron (la categorizzazione Philips non esisteva ancora),
# quindi vengono rimappati tutti su categoria Biotron.
OLD_VALUE_TO_TYPE_NAME = {
    'cdd': 'CDD',
    'privati': 'PRIVATI',
    'l1': 'L1',
}


def populate_category_and_type_ref(apps, schema_editor):
    ServiceNowCase = apps.get_model('servicenow', 'ServiceNowCase')
    ServiceNowCaseType = apps.get_model('servicenow', 'ServiceNowCaseType')

    biotron_types = {t.name: t for t in ServiceNowCaseType.objects.filter(category='biotron')}

    for case in ServiceNowCase.objects.all():
        case.category = 'biotron'
        type_name = OLD_VALUE_TO_TYPE_NAME.get(case.case_type, 'CDD')
        case.case_type_ref = biotron_types[type_name]
        case.save(update_fields=['category', 'case_type_ref'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('servicenow', '0005_servicenowcasetype'),
    ]

    operations = [
        migrations.AddField(
            model_name='servicenowcase',
            name='category',
            field=models.CharField(choices=[('philips', 'Philips'), ('biotron', 'Biotron')], default='biotron', max_length=20, verbose_name='Categoria'),
        ),
        migrations.AddField(
            model_name='servicenowcase',
            name='case_type_ref',
            field=models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.PROTECT, related_name='cases', to='servicenow.servicenowcasetype', verbose_name='Type'),
        ),
        migrations.RunPython(populate_category_and_type_ref, noop_reverse),
    ]
