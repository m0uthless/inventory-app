from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0036_userprofile_theme'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userprofile',
            name='theme',
            field=models.CharField(
                choices=[
                    ('default', 'Predefinito (teal)'),
                    ('navy', 'Navy'),
                    ('temp', 'Temp (anteprima)'),
                ],
                default='default',
                help_text="Tema grafico del frontend Archie. Preferenza personale, modificabile "
                          "dall'utente stesso dal proprio profilo (a differenza degli altri campi "
                          "di questo modello). Persiste cross-device essendo salvato lato server.",
                max_length=16,
                verbose_name='Tema interfaccia',
            ),
        ),
    ]
