from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0005_inventory_indexes"),
    ]

    operations = [
        migrations.CreateModel(
            name="Monitor",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("produttore", models.CharField(default="Eizo", max_length=128, verbose_name="Produttore")),
                ("modello", models.CharField(blank=True, max_length=128, null=True, verbose_name="Modello")),
                ("seriale", models.CharField(blank=True, max_length=128, null=True, verbose_name="Seriale")),
                ("stato", models.CharField(
                    choices=[
                        ("in_uso", "In uso"),
                        ("da_installare", "Da installare"),
                        ("guasto", "Guasto"),
                        ("rma", "RMA"),
                    ],
                    default="da_installare",
                    max_length=32,
                    verbose_name="Stato",
                )),
                ("tipo", models.CharField(
                    choices=[
                        ("amministrativo", "Amministrativo"),
                        ("diagnostico", "Diagnostico"),
                    ],
                    max_length=32,
                    verbose_name="Tipo",
                )),
                ("radinet", models.BooleanField(
                    default=False,
                    help_text="Abilitabile solo per monitor di tipo Diagnostico.",
                    verbose_name="Radinet",
                )),
                ("inventory", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="monitors",
                    to="inventory.inventory",
                    verbose_name="Inventory (workstation)",
                )),
            ],
            options={
                "verbose_name": "Monitor",
                "verbose_name_plural": "Monitor",
                "ordering": ["inventory", "produttore", "modello"],
            },
        ),
    ]
