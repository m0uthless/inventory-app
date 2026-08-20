from django.db import migrations, models


def reset_navy_temp_to_default(apps, schema_editor):
    """Consolidamento 0.9.0: i temi 'navy' e 'temp' sono stati rimossi.
    Eventuali utenti che li avevano selezionati vengono riportati al
    tema di default (teal), l'unico rimasto disponibile."""
    UserProfile = apps.get_model("core", "UserProfile")
    UserProfile.objects.filter(theme__in=["navy", "temp"]).update(theme="default")


def noop_reverse(apps, schema_editor):
    # Non c'è un modo sensato di "ripristinare" un tema che l'utente aveva
    # scelto: la reverse migration si limita a riallargare le choices,
    # senza reimpostare valori.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0037_userprofile_theme_add_temp"),
    ]

    operations = [
        migrations.RunPython(reset_navy_temp_to_default, noop_reverse),
        migrations.AlterField(
            model_name="userprofile",
            name="theme",
            field=models.CharField(
                choices=[("default", "Predefinito (teal)")],
                default="default",
                help_text=(
                    "Tema grafico del frontend Archie. Preferenza personale, modificabile "
                    "dall'utente stesso dal proprio profilo (a differenza degli altri campi "
                    "di questo modello). Persiste cross-device essendo salvato lato server."
                ),
                max_length=16,
                verbose_name="Tema interfaccia",
            ),
        ),
    ]
