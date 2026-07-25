from django.db import migrations


class Migration(migrations.Migration):
    """Rimuove `TechnicianAbsence`: la gestione assenze è stata generalizzata
    e spostata in `attendance.Absence` (mezza giornata, workflow proposta→
    validata, condivisa col Piano Ferie). Si parte da situazione pulita
    (nessuna migrazione dati dei vecchi record, come concordato)."""

    dependencies = [
        ("servicenow", "0010_servicenowcase_opened_time"),
    ]

    operations = [
        migrations.DeleteModel(name="TechnicianAbsence"),
    ]
