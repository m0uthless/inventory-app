"""wiki/management/commands/import_wiki_bundle.py

Importa un pacchetto di pagine wiki (frontmatter + assets) nel modulo Wiki
di ARCHIE. Generalizza import_wiki_pilot per gestire pacchetti con più
categorie e campi frontmatter aggiuntivi (source_document, source_file,
source_url, source_pages).

Formato atteso del pacchetto (cartella o file .zip):

    <root>/
        wiki/*.md         # una pagina per file, frontmatter YAML-like
        assets/*.png|jpg  # immagini referenziate come ../assets/xxx

Uso tipico (dentro il container backend):

    docker compose -f docker-compose.yml -f docker-compose.dev.yml run \\
        --entrypoint "" backend \\
        python manage.py import_wiki_bundle /app/wiki/fixtures/wiki_full \\
        --import-tag how_to_guide_full --dry-run

Opzioni:
    --import-tag  valore salvato in custom_fields.import_source, usato anche
                  da cleanup_wiki_import per identificare il lotto (default:
                  ricavato dal nome della cartella/zip sorgente)
    --update      aggiorna le pagine già esistenti (match su slug)
    --dry-run     esegue tutto ma fa rollback a fine comando
"""
from __future__ import annotations

import mimetypes
import re
from pathlib import Path, PurePosixPath

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from wiki.management._import_common import SourceReader, parse_frontmatter
from wiki.models import WikiAttachment, WikiCategory, WikiPage

IMAGE_REF_RE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)\)")

# Le fonti (es. estrazioni fatte in chat separate) a volte usano i callout
# in stile GitHub `> [!NOTE]` / `> [!WARNING]`. Non fanno parte del Markdown
# standard: il renderer della wiki (python-markdown, solo fenced_code+tables)
# li lascia come testo letterale invece di un riquadro colorato. Li
# convertiamo in un'etichetta in grassetto dentro la blockquote, che con
# Markdown standard rende comunque bene.
GITHUB_CALLOUT_RE = re.compile(r"^>\s*\[!(\w+)\]\s*$", re.MULTILINE)
CALLOUT_LABELS = {
    "NOTE": "Nota",
    "WARNING": "Attenzione",
    "CAUTION": "Attenzione",
    "IMPORTANT": "Importante",
    "TIP": "Suggerimento",
}


def _fix_github_callouts(body: str) -> str:
    def _replace(m: re.Match) -> str:
        kind = m.group(1).upper()
        label = CALLOUT_LABELS.get(kind, kind.capitalize())
        return f"> **{label}**"
    return GITHUB_CALLOUT_RE.sub(_replace, body)

# Le categorie del pacchetto arrivano come codice breve (es. "pacs");
# qui la mappatura verso il nome mostrato in WikiCategory. Puramente
# cosmetico: se preferisci altri nomi, rinominali pure dopo in admin,
# non serve rilanciare l'import.
CATEGORY_LABELS = {
    "pacs": "PACS",
    "oracle": "Oracle",
    "cdd": "CDD",
    "veritas": "Veritas",
    "to_be_assigned": "Da assegnare",
}


class Command(BaseCommand):
    help = "Importa un pacchetto di pagine Wiki (frontmatter + assets) nel modulo Wiki di ARCHIE."

    def add_arguments(self, parser):
        parser.add_argument(
            "source_path", type=str,
            help="Cartella o file .zip col pacchetto (deve contenere wiki/*.md e assets/*)",
        )
        parser.add_argument("--import-tag", type=str, default=None,
                             help="Valore per custom_fields.import_source (default: nome cartella/zip)")
        parser.add_argument("--update", action="store_true", help="Aggiorna le pagine già esistenti (match su slug)")
        parser.add_argument("--dry-run", action="store_true", help="Esegue senza persistere nulla (rollback finale)")

    def handle(self, *args, **options):
        root = Path(options["source_path"]).expanduser().resolve()
        if not root.exists():
            raise CommandError(f"Percorso non trovato: {root}")

        import_tag = options["import_tag"] or root.stem
        update_existing = options["update"]
        dry_run = options["dry_run"]

        reader = SourceReader(root)
        md_names = reader.files_in("wiki", ".md")
        if not md_names:
            raise CommandError(f"Nessun file .md trovato sotto 'wiki/' in {root}")

        stats = {"categories_created": 0, "pages_created": 0, "pages_updated": 0,
                  "pages_skipped": 0, "attachments_created": 0, "images_missing": 0, "errors": 0}

        with transaction.atomic():
            for name in md_names:
                try:
                    self._import_one(name, reader, update_existing, import_tag, stats)
                except Exception as exc:  # noqa: BLE001 — continua col resto del lotto
                    stats["errors"] += 1
                    self.stderr.write(self.style.ERROR(f"  ✗ {name}: {exc}"))

            if dry_run:
                self.stdout.write(self.style.WARNING("\n--dry-run: rollback di tutte le modifiche."))
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            "\nImport completato: "
            f"{stats['pages_created']} pagine create, "
            f"{stats['pages_updated']} aggiornate, "
            f"{stats['pages_skipped']} saltate (già esistenti), "
            f"{stats['categories_created']} categorie create, "
            f"{stats['attachments_created']} allegati caricati, "
            f"{stats['images_missing']} immagini non trovate nel pacchetto, "
            f"{stats['errors']} errori."
        ))

    def _import_one(self, name: str, reader: SourceReader, update_existing: bool, import_tag: str, stats: dict):
        raw = reader.read_text(name)
        frontmatter, body = parse_frontmatter(raw)
        body = _fix_github_callouts(body)

        title = frontmatter.get("title") or Path(name).stem
        slug = frontmatter.get("slug") or slugify(title)
        category_code = frontmatter.get("category")
        tags = frontmatter.get("tags") or []
        status = frontmatter.get("status", "draft")

        existing = WikiPage.objects.filter(slug=slug, deleted_at__isnull=True).first()
        if existing and not update_existing:
            stats["pages_skipped"] += 1
            self.stdout.write(f"  = {slug}: già presente, saltata (usa --update per sovrascrivere)")
            return

        category = None
        if category_code:
            category_name = CATEGORY_LABELS.get(category_code, category_code.replace("_", " ").capitalize())
            category, created = WikiCategory.objects.get_or_create(
                name=category_name,
                deleted_at__isnull=True,
                defaults={"name": category_name},
            )
            if created:
                stats["categories_created"] += 1

        custom_fields = {
            "import_source": import_tag,
            "source_document": frontmatter.get("source_document"),
            "source_file": frontmatter.get("source_file"),
            "source_url": frontmatter.get("source_url"),
            "source_pages": frontmatter.get("source_pages"),
            "review_required": frontmatter.get("review_required"),
            "original_status": status,
            "original_category_code": category_code,
        }

        if existing:
            page = existing
            page.title = title
            page.category = category
            page.tags = tags
            page.custom_fields = custom_fields
            page.is_published = False
            page.save()
            stats["pages_updated"] += 1
            verb = "aggiornata"
        else:
            page = WikiPage.objects.create(
                title=title,
                slug=slug,
                category=category,
                tags=tags,
                content_markdown=body,
                is_published=False,
                custom_fields=custom_fields,
            )
            if not page.kb_code:
                page.kb_code = f"KB{page.pk:07d}"
                page.save(update_fields=["kb_code"])
            stats["pages_created"] += 1
            verb = "creata"

        # Allegati: ogni immagine ../assets/xxx.png referenziata nel corpo
        # va caricata come WikiAttachment e il link riscritto sull'URL reale.
        rewritten_body = body
        for ref in set(IMAGE_REF_RE.findall(body)):
            filename = PurePosixPath(ref).name
            asset_name = reader.find_in(filename, "assets")
            if not asset_name:
                stats["images_missing"] += 1
                self.stderr.write(self.style.WARNING(f"    ! immagine non trovata nel pacchetto: {ref}"))
                continue

            attachment = WikiAttachment.objects.filter(page=page, filename=filename, deleted_at__isnull=True).first()
            if attachment is None:
                content = reader.read_bytes(asset_name)
                mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
                attachment = WikiAttachment.objects.create(
                    page=page,
                    filename=filename,
                    mime_type=mime_type,
                    size_bytes=len(content),
                    storage_key="",
                )
                attachment.file.save(filename, ContentFile(content), save=True)
                stats["attachments_created"] += 1

            preview_url = f"/api/wiki-attachments/{attachment.pk}/preview/"
            rewritten_body = rewritten_body.replace(f"]({ref})", f"]({preview_url})")

        if rewritten_body != page.content_markdown:
            page.content_markdown = rewritten_body
            page.save(update_fields=["content_markdown"])

        self.stdout.write(self.style.SUCCESS(f"  ✓ {slug}: {verb} (KB {page.kb_code})"))
