import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="LeaveArea",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("key", models.CharField(max_length=64)),
                ("label", models.CharField(max_length=128)),
                ("sort_order", models.IntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Area piano ferie",
                "verbose_name_plural": "Aree piano ferie",
                "ordering": ["sort_order", "label"],
            },
        ),
        migrations.CreateModel(
            name="Absence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("date", models.DateField(verbose_name="Giorno")),
                ("day_part", models.CharField(choices=[("mattina", "Mattina"), ("pomeriggio", "Pomeriggio")], max_length=12, verbose_name="Fascia")),
                ("reason", models.CharField(choices=[("ferie", "Ferie"), ("malattia", "Malattia/Infortunio"), ("permesso_104", "104"), ("training", "Training"), ("trasferta", "Trasferta"), ("altro", "Altro")], default="ferie", max_length=20, verbose_name="Motivo")),
                ("status", models.CharField(choices=[("proposta", "Proposta"), ("validata", "Validata"), ("rifiutata", "Rifiutata")], default="proposta", max_length=12, verbose_name="Stato")),
                ("note", models.CharField(blank=True, max_length=255, verbose_name="Nota")),
                ("time_from", models.TimeField(blank=True, help_text="Precisione oraria opzionale (permesso). Se valorizzata, vanno indicate sia ora inizio sia ora fine.", null=True, verbose_name="Ora inizio")),
                ("time_to", models.TimeField(blank=True, null=True, verbose_name="Ora fine")),
                ("validated_at", models.DateTimeField(blank=True, null=True, verbose_name="Validata il")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL, verbose_name="Creata da")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL, verbose_name="Aggiornata da")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="absences", to=settings.AUTH_USER_MODEL, verbose_name="Utente")),
                ("validated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL, verbose_name="Validata da")),
            ],
            options={
                "verbose_name": "Assenza / attività",
                "verbose_name_plural": "Assenze / attività",
                "ordering": ["-date", "day_part"],
            },
        ),
        migrations.AddIndex(
            model_name="absence",
            index=models.Index(fields=["date"], name="absence_date_idx"),
        ),
        migrations.AddIndex(
            model_name="absence",
            index=models.Index(fields=["user", "date"], name="absence_user_date_idx"),
        ),
        migrations.AddIndex(
            model_name="absence",
            index=models.Index(fields=["reason"], name="absence_reason_idx"),
        ),
        migrations.AddIndex(
            model_name="absence",
            index=models.Index(fields=["status"], name="absence_status_idx"),
        ),
        migrations.AddIndex(
            model_name="absence",
            index=models.Index(fields=["deleted_at"], name="absence_deleted_at_idx"),
        ),
        migrations.AddConstraint(
            model_name="leavearea",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=("key",),
                name="ux_leave_area_key_active",
            ),
        ),
        migrations.AddConstraint(
            model_name="absence",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=("user", "date", "day_part"),
                name="ux_absence_user_date_daypart_active",
            ),
        ),
        migrations.AddConstraint(
            model_name="absence",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(("time_from__isnull", True), ("time_to__isnull", True))
                    | models.Q(("time_from__isnull", False), ("time_to__isnull", False))
                ),
                name="ck_absence_time_pair",
            ),
        ),
    ]
