from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('servicenow', '0006_servicenowcase_category_and_type_ref'),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name='servicenowcase',
            name='sncase_case_type_idx',
        ),
        migrations.RemoveField(
            model_name='servicenowcase',
            name='case_type',
        ),
        migrations.RenameField(
            model_name='servicenowcase',
            old_name='case_type_ref',
            new_name='case_type',
        ),
        migrations.AlterField(
            model_name='servicenowcase',
            name='case_type',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='cases', to='servicenow.servicenowcasetype', verbose_name='Type'),
        ),
        migrations.AddIndex(
            model_name='servicenowcase',
            index=models.Index(fields=['category'], name='sncase_category_idx'),
        ),
    ]
