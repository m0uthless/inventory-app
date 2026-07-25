import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from decimal import Decimal

import expenses.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ExpenseReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("year", models.PositiveIntegerField(verbose_name="Anno")),
                ("month", models.PositiveSmallIntegerField(
                    validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(12)],
                    verbose_name="Mese",
                )),
                ("advances_total", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=8, verbose_name="Totale anticipi")),
                ("note", models.TextField(blank=True, verbose_name="Note")),
                ("status", models.CharField(
                    choices=[("bozza", "Bozza"), ("inviata", "Inviata"), ("validata", "Validata"), ("rifiutata", "Rifiutata")],
                    default="bozza", max_length=12, verbose_name="Stato",
                )),
                ("rejection_reason", models.TextField(blank=True, verbose_name="Motivo rifiuto")),
                ("validated_at", models.DateTimeField(blank=True, null=True, verbose_name="Validata/rifiutata il")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="expense_reports", to=settings.AUTH_USER_MODEL, verbose_name="Dipendente")),
                ("validated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL, verbose_name="Validata/rifiutata da")),
            ],
            options={
                "verbose_name": "Nota spese",
                "verbose_name_plural": "Note spese",
                "ordering": ["-year", "-month", "user__username"],
            },
        ),
        migrations.CreateModel(
            name="ExpenseItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("category", models.CharField(choices=[
                    ("treni", "Treni, pullman"),
                    ("taxi_comune", "Taxi/bus/autonoleggio nel comune"),
                    ("taxi_fuori_comune", "Taxi/bus/autonoleggio fuori comune"),
                    ("autostrade", "Autostrade"),
                    ("rimborso_km", "Rimborso chilometraggio"),
                    ("varie_automezzi", "Varie automezzi (lavaggio/parcheggi/manutenzioni fino a 50€)"),
                    ("carburanti", "Carburanti e lubrificanti"),
                    ("pernottamento", "Pernottamento"),
                    ("pasti", "Pasti (ristorante/bar)"),
                    ("rappresentanza", "Spese di rappresentanza"),
                    ("telefoniche", "Spese telefoniche"),
                    ("varie", "Varie"),
                ], max_length=32, verbose_name="Categoria")),
                ("date", models.DateField(blank=True, null=True, verbose_name="Data")),
                ("description", models.CharField(blank=True, max_length=255, verbose_name="Descrizione")),
                ("amount", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=8, verbose_name="Importo")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("report", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="expenses.expensereport")),
            ],
            options={
                "verbose_name": "Voce nota spese",
                "verbose_name_plural": "Voci nota spese",
            },
        ),
        migrations.CreateModel(
            name="ExpenseKmTrip",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("date", models.DateField(verbose_name="Data")),
                ("destination", models.CharField(max_length=255, verbose_name="Luogo di destinazione")),
                ("km", models.PositiveIntegerField(verbose_name="Km percorsi")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("item", models.ForeignKey(
                    limit_choices_to={"category": "rimborso_km"},
                    on_delete=django.db.models.deletion.CASCADE, related_name="km_trips", to="expenses.expenseitem",
                )),
            ],
            options={
                "verbose_name": "Trasferta km",
                "verbose_name_plural": "Trasferte km",
                "ordering": ["date", "id"],
            },
        ),
        migrations.CreateModel(
            name="TechnicianKmRate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("rate_per_km", models.DecimalField(decimal_places=3, default=Decimal("0"), max_digits=5, verbose_name="Tariffa €/km")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="expense_km_rate", to=settings.AUTH_USER_MODEL, verbose_name="Dipendente")),
            ],
            options={
                "verbose_name": "Tariffa km per tecnico",
                "verbose_name_plural": "Tariffe km per tecnico",
                "ordering": ["user__username"],
            },
        ),
        migrations.CreateModel(
            name="ExpenseReceipt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("file", models.FileField(upload_to=expenses.models.expense_receipt_upload_path, verbose_name="File")),
                ("ocr_amount", models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True, verbose_name="Importo OCR")),
                ("ocr_date", models.DateField(blank=True, null=True, verbose_name="Data OCR")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("item", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="receipts", to="expenses.expenseitem")),
            ],
            options={
                "verbose_name": "Scontrino",
                "verbose_name_plural": "Scontrini",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="expensereport",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("user", "year", "month"),
                name="ux_expense_report_user_year_month_active",
            ),
        ),
        migrations.AddIndex(
            model_name="expensereport",
            index=models.Index(fields=["status"], name="exprep_status_idx"),
        ),
        migrations.AddIndex(
            model_name="expensereport",
            index=models.Index(fields=["user", "deleted_at"], name="exprep_user_del_idx"),
        ),
        migrations.AddConstraint(
            model_name="expenseitem",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("report", "category"),
                name="ux_expense_item_report_category_active",
            ),
        ),
    ]
