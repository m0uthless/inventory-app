from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("issues", "0006_issue_closed_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="issue",
            name="customer_placeholder",
            field=models.CharField(
                blank=True,
                default="",
                help_text=(
                    "Nome del cliente reale, usato quando non è ancora presente in "
                    "anagrafica. Se valorizzato, il campo Cliente punta al record "
                    "sentinella e questo testo viene mostrato al suo posto."
                ),
                max_length=255,
                verbose_name="Cliente (testo libero)",
            ),
            preserve_default=False,
        ),
    ]
