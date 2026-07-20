"""wiki/management/commands/import_wiki_queries.py

Importa un catalogo di query (frontmatter + .sql) nella pagina Queries del
modulo Wiki di ARCHIE (modelli WikiQuery / WikiQueryLanguage).

Formato atteso del pacchetto (cartella o file .zip):

    <root>/
        items/*.md   # una voce per query: title, description, tags
        sql/*.sql    # stesso nome base, corpo della query

Uso tipico (dentro il container backend):

    docker compose -f docker-compose.yml -f docker-compose.dev.yml run \\
        --entrypoint "" backend \\
        python manage.py import_wiki_queries /app/wiki/fixtures/wiki_full/queries --dry-run

Opzioni:
    --language-key  chiave della WikiQueryLanguage da usare/creare (default: sql)
    --update        aggiorna le query già esistenti (match su titolo)
    --dry-run       esegue tutto ma fa rollback a fine comando
"""
from __future__ import annotations

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from wiki.management._import_common import SourceReader, parse_frontmatter
from wiki.models import WikiQuery, WikiQueryLanguage


class Command(BaseCommand):
    help = "Importa un catalogo di query (items/*.md + sql/*.sql) nel modulo Wiki di ARCHIE."

    def add_arguments(self, parser):
        parser.add_argument(
            "source_path", type=str,
            help="Cartella o file .zip col catalogo (deve contenere items/*.md e sql/*.sql)",
        )
        parser.add_argument("--language-key", type=str, default="sql",
                             help="Chiave WikiQueryLanguage da usare/creare (default: sql)")
        parser.add_argument("--update", action="store_true", help="Aggiorna le query già esistenti (match su titolo)")
        parser.add_argument("--dry-run", action="store_true", help="Esegue senza persistere nulla (rollback finale)")

    def handle(self, *args, **options):
        root = Path(options["source_path"]).expanduser().resolve()
        if not root.exists():
            raise CommandError(f"Percorso non trovato: {root}")

        update_existing = options["update"]
        dry_run = options["dry_run"]
        language_key = options["language_key"]

        reader = SourceReader(root)
        item_names = reader.files_in("items", ".md")
        if not item_names:
            raise CommandError(f"Nessun file .md trovato sotto 'items/' in {root}")

        stats = {"created": 0, "updated": 0, "skipped": 0, "sql_missing": 0, "errors": 0}

        with transaction.atomic():
            language, lang_created = WikiQueryLanguage.objects.get_or_create(
                key=language_key,
                deleted_at__isnull=True,
                defaults={
                    "key": language_key,
                    "label": language_key.upper(),
                    "color": "#e2e8f0",
                    "text_color": "#0f172a",
                },
            )
            if lang_created:
                self.stdout.write(self.style.SUCCESS(f"Creato linguaggio query: {language.label}"))

            seen_titles: dict[str, int] = {}
            for name in item_names:
                try:
                    self._import_one(name, reader, language, update_existing, stats, seen_titles)
                except Exception as exc:  # noqa: BLE001 — continua col resto del lotto
                    stats["errors"] += 1
                    self.stderr.write(self.style.ERROR(f"  ✗ {name}: {exc}"))

            if dry_run:
                self.stdout.write(self.style.WARNING("\n--dry-run: rollback di tutte le modifiche."))
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            "\nImport query completato: "
            f"{stats['created']} create, {stats['updated']} aggiornate, "
            f"{stats['skipped']} saltate (già esistenti), "
            f"{stats['sql_missing']} file .sql mancanti, "
            f"{stats['errors']} errori."
        ))

    def _import_one(self, name: str, reader: SourceReader, language: WikiQueryLanguage,
                     update_existing: bool, stats: dict, seen_titles: dict):
        raw = reader.read_text(name)
        frontmatter, _body = parse_frontmatter(raw)

        title = frontmatter.get("title") or Path(name).stem
        description = frontmatter.get("description") or ""
        tags = frontmatter.get("tags") or []

        # Il pacchetto può contenere query diverse con lo stesso titolo
        # (generato dalla stessa descrizione ma SQL differente, es. varianti
        # sulla stessa fonte). Il titolo è l'unica chiave naturale su
        # WikiQuery, quindi disambiguiamo per non sovrascrivere/nascondere
        # una query reale sotto l'altra.
        base_title = title
        seen_titles[base_title] = seen_titles.get(base_title, 0) + 1
        if seen_titles[base_title] > 1:
            title = f"{base_title} (var. {seen_titles[base_title]})"
            self.stdout.write(self.style.WARNING(
                f"    ! titolo duplicato nel pacchetto ('{base_title}'), rinominata in '{title}'"
            ))

        sql_filename = Path(name).stem + ".sql"
        sql_path = reader.find_in(sql_filename, "sql")
        if not sql_path:
            stats["sql_missing"] += 1
            self.stderr.write(self.style.WARNING(f"    ! file .sql non trovato per: {name}"))
            return
        sql_body = reader.read_text(sql_path)

        existing = WikiQuery.objects.filter(title=title, deleted_at__isnull=True).first()
        if existing and not update_existing:
            stats["skipped"] += 1
            self.stdout.write(f"  = {title}: già presente, saltata (usa --update per sovrascrivere)")
            return

        if existing:
            existing.language = language
            existing.body = sql_body
            existing.description = description
            existing.tags = tags
            existing.save()
            stats["updated"] += 1
            verb = "aggiornata"
        else:
            WikiQuery.objects.create(
                title=title,
                language=language,
                body=sql_body,
                description=description,
                tags=tags,
            )
            stats["created"] += 1
            verb = "creata"

        self.stdout.write(self.style.SUCCESS(f"  ✓ {title}: {verb}"))
