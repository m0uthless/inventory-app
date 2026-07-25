from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0002_holiday"),
    ]

    operations = [
        migrations.AddField(
            model_name="absence",
            name="request_group",
            field=models.UUIDField(
                blank=True,
                null=True,
                help_text="Tutte le righe create dalla stessa selezione (singola cella o "
                          "trascinamento multi-giorno) condividono lo stesso valore, cosa "
                          "che permette al coordinatore di validare/rifiutare l'intera "
                          "richiesta con un solo click invece che riga per riga.",
                verbose_name="Gruppo richiesta",
            ),
        ),
        migrations.AddIndex(
            model_name="absence",
            index=models.Index(fields=["request_group"], name="absence_request_group_idx"),
        ),
    ]
