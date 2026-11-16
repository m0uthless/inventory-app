from django.db import migrations, models


def backfill_submitted_at(apps, schema_editor):
    """Note già inviate e in attesa: l'ultimo passaggio è stato l'invio."""
    ExpenseReport = apps.get_model("expenses", "ExpenseReport")
    for r in ExpenseReport.objects.filter(status="inviata", submitted_at__isnull=True):
        r.submitted_at = r.updated_at
        r.save(update_fields=["submitted_at"])


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='expensereport',
            name='submitted_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Inviata il'),
        ),
        migrations.RunPython(backfill_submitted_at, migrations.RunPython.noop),
    ]
