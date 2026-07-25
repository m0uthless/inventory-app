from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_userprofile_is_expense_secretary"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserManagementAccess",
            fields=[],
            options={
                "managed": False,
                "default_permissions": (),
                "permissions": [("manage_users", "Può gestire utenti, gruppi e permessi")],
            },
        ),
    ]
