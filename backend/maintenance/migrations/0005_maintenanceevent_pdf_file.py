from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("maintenance", "0004_alter_maintenancenotification_options"),
    ]

    operations = [
        migrations.AddField(
            model_name="maintenanceevent",
            name="pdf_file",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to="maintenance_events/",
                verbose_name="Rapportino PDF",
            ),
        ),
    ]
