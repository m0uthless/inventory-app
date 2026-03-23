# Generated manually — v0.5.1 bugfix
# Aggiunge la scelta "rate" all'enum AuditEvent.action e aumenta
# max_length a 32 per supportare future azioni senza nuove migration.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("audit", "0007_auditevent_content_type_nullable"),
    ]

    operations = [
        migrations.AlterField(
            model_name="auditevent",
            name="action",
            field=models.CharField(
                max_length=32,
                choices=[
                    ("create", "Create"),
                    ("update", "Update"),
                    ("delete", "Delete"),
                    ("restore", "Restore"),
                    ("login", "Login"),
                    ("login_failed", "Login Failed"),
                    ("logout", "Logout"),
                    ("rate", "Rate"),
                ],
            ),
        ),
    ]
