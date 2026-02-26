from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0004_inventory_permissions"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="inventory",
            index=models.Index(fields=["deleted_at"], name="inv_deleted_at_idx"),
        ),
        migrations.AddIndex(
            model_name="inventory",
            index=models.Index(fields=["customer", "deleted_at"], name="inv_customer_del_idx"),
        ),
        migrations.AddIndex(
            model_name="inventory",
            index=models.Index(fields=["site", "deleted_at"], name="inv_site_del_idx"),
        ),
        migrations.AddIndex(
            model_name="inventory",
            index=models.Index(fields=["updated_at"], name="inv_updated_at_idx"),
        ),
    ]
