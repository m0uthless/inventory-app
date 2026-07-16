"""Allineamento puramente cosmetico su wikiquerylanguage: NON emette SQL.

- color: al modello e' stato aggiunto un help_text (metadato Python).
- id: era gia' BigAutoField nella migrazione 0011, manca solo verbose_name='ID'.

Nessuna delle due tocca lo schema. Serve solo a riportare pulito
`makemigrations --check`.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wiki', '0012_wikipagerating_unique_page_user'),
    ]

    operations = [
        migrations.AlterField(
            model_name='wikiquerylanguage',
            name='color',
            field=models.CharField(default='#e2e8f0', help_text='Colore pastello HEX usato nel chip nella UI (es. #d1fae5).', max_length=32, verbose_name='Colore sfondo chip (hex)'),
        ),
        migrations.AlterField(
            model_name='wikiquerylanguage',
            name='id',
            field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID'),
        ),
    ]
