from django.db import migrations, models


PHILIPS_TYPES = ['L1', 'EBIT', 'RIS', 'AC', 'GEMELLI']
BIOTRON_TYPES = ['L1', 'PRIVATI', 'CDD']


def seed_case_types(apps, schema_editor):
    ServiceNowCaseType = apps.get_model('servicenow', 'ServiceNowCaseType')
    for order, name in enumerate(PHILIPS_TYPES):
        ServiceNowCaseType.objects.create(category='philips', name=name, order=order, active=True)
    for order, name in enumerate(BIOTRON_TYPES):
        ServiceNowCaseType.objects.create(category='biotron', name=name, order=order, active=True)


def unseed_case_types(apps, schema_editor):
    ServiceNowCaseType = apps.get_model('servicenow', 'ServiceNowCaseType')
    ServiceNowCaseType.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('servicenow', '0004_alter_servicenowcase_external_url'),
    ]

    operations = [
        migrations.CreateModel(
            name='ServiceNowCaseType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category', models.CharField(choices=[('philips', 'Philips'), ('biotron', 'Biotron')], max_length=20, verbose_name='Categoria')),
                ('name', models.CharField(max_length=50, verbose_name='Nome')),
                ('order', models.PositiveIntegerField(default=0, verbose_name='Ordinamento')),
                ('active', models.BooleanField(default=True, verbose_name='Attivo')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Type ServiceNow Case',
                'verbose_name_plural': 'Type ServiceNow Case',
                'ordering': ['category', 'order', 'name'],
            },
        ),
        migrations.AddConstraint(
            model_name='servicenowcasetype',
            constraint=models.UniqueConstraint(fields=('category', 'name'), name='ux_servicenow_case_type_category_name'),
        ),
        migrations.RunPython(seed_case_types, unseed_case_types),
    ]
