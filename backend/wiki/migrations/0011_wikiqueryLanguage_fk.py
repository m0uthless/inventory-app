"""
Migrazione in 3 fasi:

1. Crea WikiQueryLanguage e popola le 7 voci di default (data migration).
2. Aggiunge language_id (FK nullable) su WikiQuery.
3. Per ogni WikiQuery esistente, risolve la stringa language → FK.
4. Rimuove il vecchio campo language (CharField).

Se non esistono WikiQuery al momento della migrazione (installazione nuova),
le fasi 3 è no-op.
"""
from __future__ import annotations

import django.db.models.deletion
from django.db import migrations, models


INITIAL_LANGUAGES = [
    # (key, label, color_bg, color_text, sort_order)
    ("sql",        "SQL",          "#d1fae5", "#065f46", 10),
    ("tsql",       "T-SQL",        "#ede9fe", "#4c1d95", 20),
    ("plpgsql",    "PL/pgSQL",     "#dbeafe", "#1e3a8a", 30),
    ("powershell", "PowerShell",   "#dbeafe", "#1e40af", 40),
    ("bash",       "Bash / Shell", "#fef3c7", "#92400e", 50),
    ("python",     "Python",       "#fce7f3", "#831843", 60),
    ("other",      "Altro",        "#f1f5f9", "#475569", 99),
]


def populate_languages(apps, schema_editor):
    WikiQueryLanguage = apps.get_model("wiki", "WikiQueryLanguage")
    for key, label, color, text_color, sort_order in INITIAL_LANGUAGES:
        WikiQueryLanguage.objects.get_or_create(
            key=key,
            defaults={
                "label": label,
                "color": color,
                "text_color": text_color,
                "sort_order": sort_order,
                "is_active": True,
            },
        )


def migrate_language_fk(apps, schema_editor):
    """Converte il vecchio valore stringa language → FK WikiQueryLanguage."""
    WikiQuery = apps.get_model("wiki", "WikiQuery")
    WikiQueryLanguage = apps.get_model("wiki", "WikiQueryLanguage")

    lang_map = {obj.key: obj for obj in WikiQueryLanguage.objects.all()}
    fallback = lang_map.get("other")

    for query in WikiQuery.objects.all():
        old_key = query.language_old or ""
        query.language = lang_map.get(old_key, fallback)
        query.save(update_fields=["language"])


class Migration(migrations.Migration):

    dependencies = [
        ("wiki", "0010_wikiquery"),
    ]

    operations = [
        # ── Step 1: crea la tabella WikiQueryLanguage ─────────────────────────
        migrations.CreateModel(
            name="WikiQueryLanguage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("key", models.CharField(max_length=64, verbose_name="Chiave")),
                ("label", models.CharField(max_length=128, verbose_name="Label")),
                ("color", models.CharField(default="#e2e8f0", max_length=32, verbose_name="Colore sfondo chip (hex)")),
                ("text_color", models.CharField(default="#0f172a", max_length=32, verbose_name="Colore testo chip (hex)")),
                ("sort_order", models.IntegerField(default=0, verbose_name="Ordinamento")),
                ("is_active", models.BooleanField(default=True, verbose_name="Attivo")),
            ],
            options={
                "verbose_name": "Linguaggio query",
                "verbose_name_plural": "Linguaggi query",
                "ordering": ["sort_order", "label"],
            },
        ),
        migrations.AddConstraint(
            model_name="wikiqueryLanguage",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=["key"],
                name="ux_wiki_query_language_key_active",
            ),
        ),

        # ── Step 2: data migration — popola i linguaggi di default ────────────
        migrations.RunPython(populate_languages, migrations.RunPython.noop),

        # ── Step 3: rinomina il vecchio CharField per tenerlo durante la fase 4 ─
        migrations.RenameField(
            model_name="wikiquery",
            old_name="language",
            new_name="language_old",
        ),

        # ── Step 4: aggiunge il nuovo campo FK (nullable) ─────────────────────
        migrations.AddField(
            model_name="wikiquery",
            name="language",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="queries",
                to="wiki.wikiqueryLanguage",
                verbose_name="Linguaggio",
            ),
        ),

        # ── Step 5: data migration — risolve old key → FK ─────────────────────
        migrations.RunPython(migrate_language_fk, migrations.RunPython.noop),

        # ── Step 6: rimuove il vecchio CharField ──────────────────────────────
        migrations.RemoveField(
            model_name="wikiquery",
            name="language_old",
        ),
    ]
