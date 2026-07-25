from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Holiday",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("date", models.DateField(verbose_name="Data")),
                ("label", models.CharField(max_length=128, verbose_name="Descrizione")),
                ("areas", models.ManyToManyField(
                    blank=True,
                    help_text="Vuoto = vale per tutte le aree. Valorizzato = vale solo per le aree selezionate.",
                    related_name="holidays",
                    to="attendance.leavearea",
                    verbose_name="Aree",
                )),
            ],
            options={
                "verbose_name": "Festività",
                "verbose_name_plural": "Festività",
                "ordering": ["date"],
            },
        ),
        migrations.AddIndex(
            model_name="holiday",
            index=models.Index(fields=["date"], name="holiday_date_idx"),
        ),
        migrations.AddConstraint(
            model_name="holiday",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=("date", "label"),
                name="ux_holiday_date_label_active",
            ),
        ),
    ]
