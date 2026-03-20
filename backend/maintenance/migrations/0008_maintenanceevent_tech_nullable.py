from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('maintenance', '0007_add_not_planned_result'),
    ]

    operations = [
        migrations.AlterField(
            model_name='maintenanceevent',
            name='tech',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='events',
                to='maintenance.tech',
            ),
        ),
    ]
