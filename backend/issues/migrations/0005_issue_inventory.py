from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0005_inventory_indexes"),
        ("issues", "0004_issue_opened_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="issue",
            name="inventory",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="issues",
                to="inventory.inventory",
                verbose_name="Inventory",
            ),
        ),
    ]
