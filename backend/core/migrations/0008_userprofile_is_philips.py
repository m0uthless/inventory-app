from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_archieaccess"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="is_philips",
            field=models.BooleanField(
                default=False,
                verbose_name="Philips",
                help_text="Utente assegnabile ai case ServiceNow di categoria Philips (se falso: Biotron). Impostabile solo da admin.",
            ),
        ),
    ]
