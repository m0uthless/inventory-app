"""wiki/management/commands/reset_wiki_content.py

Rollback completo del modulo Wiki: cancella TUTTE le WikiPage (con relativi
allegati, revisioni, valutazioni, link), TUTTE le WikiQuery e, salvo
--no-categories / --no-languages, anche WikiCategory e WikiQueryLanguage.

Pensato per il caso "butto via l'import fatto finora e riparto da zero con
una nuova versione del pacchetto" — quindi di default fa cancellazione
DEFINITIVA (hard delete), non soft-delete: l'obiettivo è ripartire puliti,
non tenere roba nel cestino.

Per sicurezza richiede il flag esplicito --confirm, altrimenti si limita a
mostrare cosa cancellerebbe e si ferma.

Uso tipico (dentro il container backend):

    # anteprima, nessuna scrittura
    docker compose -f docker-compose.yml -f docker-compose.dev.yml run --entrypoint "" backend \\
        python manage.py reset_wiki_content

    # cancellazione reale
    docker compose -f docker-compose.yml -f docker-compose.dev.yml run --entrypoint "" backend \\
        python manage.py reset_wiki_content --confirm

    # cancellazione reale ma mantenendo categorie e linguaggi query esistenti
    docker compose -f docker-compose.yml -f docker-compose.dev.yml run --entrypoint "" backend \\
        python manage.py reset_wiki_content --confirm --no-categories --no-languages
"""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from wiki.models import (
    WikiAttachment,
    WikiCategory,
    WikiLink,
    WikiPage,
    WikiQuery,
    WikiQueryLanguage,
)


class Command(BaseCommand):
    help = "Rollback completo del modulo Wiki: cancella pagine, allegati, query, categorie e linguaggi query."

    def add_arguments(self, parser):
        parser.add_argument("--confirm", action="store_true",
                             help="Necessario per eseguire davvero la cancellazione (altrimenti solo anteprima)")
        parser.add_argument("--no-categories", action="store_true", help="Non cancellare le WikiCategory")
        parser.add_argument("--no-languages", action="store_true", help="Non cancellare le WikiQueryLanguage")

    def handle(self, *args, **options):
        confirm = options["confirm"]
        clean_categories = not options["no_categories"]
        clean_languages = not options["no_languages"]

        counts = {
            "pagine": WikiPage.objects.count(),
            "allegati": WikiAttachment.objects.count(),
            "links": WikiLink.objects.count(),
            "query": WikiQuery.objects.count(),
            "categorie": WikiCategory.objects.count() if clean_categories else 0,
            "linguaggi query": WikiQueryLanguage.objects.count() if clean_languages else 0,
        }

        self.stdout.write("Verranno cancellati definitivamente (hard delete):")
        for label, n in counts.items():
            self.stdout.write(f"  - {label}: {n}")

        if not confirm:
            self.stdout.write(self.style.WARNING(
                "\nAnteprima soltanto: nessuna scrittura eseguita. Rilancia con --confirm per procedere davvero."
            ))
            return

        with transaction.atomic():
            # Ordine obbligato per via delle FK PROTECT: prima allegati e link,
            # poi le pagine, poi (opzionalmente) categorie ormai orfane.
            n_att, _ = WikiAttachment.objects.all().delete()
            n_links, _ = WikiLink.objects.all().delete()
            n_pages, _ = WikiPage.objects.all().delete()
            n_queries, _ = WikiQuery.objects.all().delete()

            n_categories = 0
            if clean_categories:
                n_categories, _ = WikiCategory.objects.all().delete()

            n_languages = 0
            if clean_languages:
                n_languages, _ = WikiQueryLanguage.objects.all().delete()

        self.stdout.write(self.style.SUCCESS(
            "\nReset completato: "
            f"{n_pages} pagine, {n_att} allegati, {n_links} link, {n_queries} query, "
            f"{n_categories} categorie, {n_languages} linguaggi query cancellati."
        ))
