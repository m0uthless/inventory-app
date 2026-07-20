"""wiki/management/commands/cleanup_wiki_import.py

Rimuove un lotto di pagine Wiki importate in precedenza da
import_wiki_bundle / import_wiki_pilot, identificate tramite il tag salvato
in custom_fields.import_source. Pensato per ripulire l'import pilota
"pilot_lotto_149-161" prima di rilanciare l'import completo del manuale
(che copre già, in modo più aggiornato, le stesse pagine sorgente).

Uso tipico (dentro il container backend):

    # anteprima di cosa verrebbe toccato, nessuna scrittura
    docker compose -f docker-compose.yml -f docker-compose.dev.yml run \\
        --entrypoint "" backend \\
        python manage.py cleanup_wiki_import pilot_lotto_149-161 --dry-run

    # soft-delete (default, reversibile dal pannello "Cestino"/restore già presente in UI)
    docker compose -f docker-compose.yml -f docker-compose.dev.yml run \\
        --entrypoint "" backend \\
        python manage.py cleanup_wiki_import pilot_lotto_149-161

    # cancellazione definitiva (irreversibile) + categorie rimaste vuote
    docker compose -f docker-compose.yml -f docker-compose.dev.yml run \\
        --entrypoint "" backend \\
        python manage.py cleanup_wiki_import pilot_lotto_149-161 --hard --with-categories
"""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError

from wiki.models import WikiCategory, WikiPage


class Command(BaseCommand):
    help = "Rimuove (soft o hard delete) le pagine Wiki importate con un dato tag custom_fields.import_source."

    def add_arguments(self, parser):
        parser.add_argument("import_tag", type=str,
                             help="Valore di custom_fields.import_source da ripulire, es. pilot_lotto_149-161")
        parser.add_argument("--hard", action="store_true",
                             help="Cancellazione definitiva invece di soft-delete (irreversibile)")
        parser.add_argument("--with-categories", action="store_true",
                             help="Rimuove anche le categorie rimaste senza pagine attive dopo la pulizia")
        parser.add_argument("--dry-run", action="store_true", help="Esegue senza persistere nulla (rollback finale)")

    def handle(self, *args, **options):
        import_tag = options["import_tag"]
        hard = options["hard"]
        with_categories = options["with_categories"]
        dry_run = options["dry_run"]

        pages = list(
            WikiPage.objects.filter(
                custom_fields__import_source=import_tag,
                deleted_at__isnull=True,
            ).select_related("category")
        )

        if not pages:
            self.stdout.write(self.style.WARNING(
                f"Nessuna pagina attiva trovata con custom_fields.import_source = '{import_tag}'."
            ))
            return

        touched_category_ids = {p.category_id for p in pages if p.category_id}

        with transaction.atomic():
            attachments_count = 0
            blocked = 0
            for page in pages:
                try:
                    with transaction.atomic():  # savepoint: isola eventuali ProtectedError
                        attachments = list(page.attachments.filter(deleted_at__isnull=True))
                        for att in attachments:
                            if hard:
                                att.delete()
                            else:
                                att.soft_delete()
                            attachments_count += 1

                        if hard:
                            page.delete()
                        else:
                            page.soft_delete()
                except (ProtectedError, IntegrityError) as exc:
                    blocked += 1
                    self.stderr.write(self.style.ERROR(
                        f"  ✗ {page.slug}: bloccata da riferimenti esistenti ({exc}), saltata"
                    ))
                    continue

                self.stdout.write(f"  ✓ {page.slug}: {'cancellata' if hard else 'soft-deleted'}")

            categories_removed = 0
            if with_categories and touched_category_ids:
                for cat in WikiCategory.objects.filter(pk__in=touched_category_ids, deleted_at__isnull=True):
                    still_used = WikiPage.objects.filter(category=cat, deleted_at__isnull=True).exists()
                    if still_used:
                        continue
                    try:
                        with transaction.atomic():
                            if hard:
                                cat.delete()
                            else:
                                cat.soft_delete()
                    except (ProtectedError, IntegrityError) as exc:
                        self.stderr.write(self.style.ERROR(f"  ✗ categoria '{cat.name}': bloccata ({exc}), saltata"))
                        continue
                    categories_removed += 1
                    self.stdout.write(f"  ✓ categoria '{cat.name}': {'cancellata' if hard else 'soft-deleted'} (vuota)")

            if dry_run:
                self.stdout.write(self.style.WARNING("\n--dry-run: rollback di tutte le modifiche."))
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f"\nPulizia completata: {len(pages) - blocked} pagine, {attachments_count} allegati, "
            f"{categories_removed} categorie rimosse ({'hard delete' if hard else 'soft delete'}), "
            f"{blocked} pagine bloccate da riferimenti esistenti."
        ))
