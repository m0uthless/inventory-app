from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('maintenance', '0006_alter_maintenanceevent_pdf_file'),
    ]

    operations = [
        migrations.AlterField(
            model_name='maintenanceevent',
            name='result',
            field=models.CharField(
                choices=[
                    ('ok',          'OK'),
                    ('ko',          'KO'),
                    ('partial',     'Partial'),
                    ('not_planned', 'Non prevista'),
                ],
                max_length=16,
            ),
        ),
    ]
