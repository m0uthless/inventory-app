import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0014_changelogentry"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="last_seen_changelog",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="core.changelogentry",
                help_text="Impostato automaticamente quando l'utente conferma di aver letto il changelog.",
                verbose_name="Ultima voce changelog vista",
            ),
        ),
    ]
