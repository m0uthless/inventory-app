import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0001_initial"),
        ("core", "0010_alter_announcement_id_alter_usertask_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="is_leave_coordinator",
            field=models.BooleanField(
                default=False,
                help_text="Se attivo, l'utente può validare/rifiutare le proposte di ferie e "
                          "inserire attività (training/104/malattia/…) per chiunque nel Piano Ferie. "
                          "Impostabile solo da admin.",
                verbose_name="Coordinatore piano ferie",
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="leave_area",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="users",
                to="attendance.leavearea",
                help_text="Area organizzativa usata per raggruppare le righe del Piano Ferie.",
                verbose_name="Area piano ferie",
            ),
        ),
    ]
