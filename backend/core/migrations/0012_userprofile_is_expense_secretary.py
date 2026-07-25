from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0011_userprofile_leave_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="is_expense_secretary",
            field=models.BooleanField(
                default=False,
                help_text="Se attivo, l'utente può vedere tutte le note spese dei dipendenti e "
                          "validarle/rifiutarle. Impostabile solo da admin.",
                verbose_name="Segreteria rimborsi spese",
            ),
        ),
    ]
