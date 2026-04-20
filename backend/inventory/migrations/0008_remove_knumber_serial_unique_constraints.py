from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0007_inventory_knumber_serial_not_unique"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="inventory",
            name="ux_inventories_knumber_active",
        ),
        migrations.RemoveConstraint(
            model_name="inventory",
            name="ux_inventories_serial_active",
        ),
    ]
