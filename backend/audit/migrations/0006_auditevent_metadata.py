from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("audit", "0005_authattempt"),
    ]

    operations = [
        migrations.AddField(
            model_name="auditevent",
            name="metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
