# Generated on 2026-02-11
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0002_alter_contact_options_alter_customer_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="site",
            name="display_name",
            field=models.CharField(max_length=255, null=True, blank=True),
        ),
        migrations.RenameField(
            model_name="site",
            old_name="zip",
            new_name="postal_code",
        ),
        migrations.RenameField(
            model_name="contact",
            old_name="role_department",
            new_name="department",
        ),
    ]


