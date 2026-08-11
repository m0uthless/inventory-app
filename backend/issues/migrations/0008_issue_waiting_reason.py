from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("issues", "0007_issue_customer_placeholder"),
    ]

    operations = [
        migrations.AddField(
            model_name="issue",
            name="waiting_reason",
            field=models.CharField(
                blank=True,
                choices=[
                    ("philips", "Philips"),
                    ("elco", "Elco"),
                    ("cliente", "Cliente"),
                    ("exprivia", "Exprivia"),
                    ("altro", "Altro"),
                ],
                default="",
                help_text="Obbligatorio quando lo stato è «In attesa».",
                max_length=20,
                verbose_name="In attesa di",
            ),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="issue",
            name="status",
            field=models.CharField(
                choices=[
                    ("open", "Aperta"),
                    ("in_progress", "In lavorazione"),
                    ("waiting", "In attesa"),
                    ("resolved", "Risolta"),
                    ("closed", "Chiusa"),
                ],
                default="open",
                max_length=20,
                verbose_name="Stato",
            ),
        ),
    ]
