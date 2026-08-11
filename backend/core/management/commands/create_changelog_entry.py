import sys

from django.core.management.base import BaseCommand, CommandError
from django.utils.dateparse import parse_date

from core.models import ChangelogEntry


class Command(BaseCommand):
    """
    Crea una ChangelogEntry leggendo il corpo (markdown) da stdin.

    Pensato per essere chiamato da release-push.sh subito dopo il tag
    di release, passando la sezione del CHANGELOG.md appena chiusa:

        cat section.md | docker compose -f docker-compose.yml \\
            -f docker-compose.dev.yml run --rm -T --entrypoint "" backend \\
            python manage.py create_changelog_entry \\
            --version "0.8.1" --date "2026-08-11"

    Se non specificato, --title diventa "Versione {version}".
    Se una ChangelogEntry con la stessa version esiste già, il comando
    si ferma senza duplicare (usare --force per sovrascrivere il body).
    """

    help = "Crea una ChangelogEntry dal body markdown passato su stdin."

    def add_arguments(self, parser):
        parser.add_argument("--version", required=True, help="Es. 0.8.1")
        parser.add_argument("--date", required=True, help="Formato YYYY-MM-DD")
        parser.add_argument("--title", default=None, help="Default: 'Versione {version}'")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Sovrascrive il body se esiste già una entry per questa versione.",
        )

    def handle(self, *args, **options):
        version = options["version"].strip()
        date_str = options["date"].strip()
        title = (options["title"] or f"Versione {version}").strip()
        force = options["force"]

        release_date = parse_date(date_str)
        if release_date is None:
            raise CommandError(f"Data non valida: '{date_str}' (atteso YYYY-MM-DD)")

        body = sys.stdin.read().strip()
        if not body:
            raise CommandError(
                "Body vuoto: passare il markdown della sezione via stdin "
                "(es. `cat section.md | manage.py create_changelog_entry ...`)"
            )

        existing = ChangelogEntry.objects.filter(version=version).first()
        if existing and not force:
            self.stdout.write(
                self.style.WARNING(
                    f"Esiste già una ChangelogEntry per la versione '{version}' "
                    f"(id={existing.id}). Uso --force per sovrascriverla. Salto."
                )
            )
            return

        if existing and force:
            existing.title = title
            existing.body = body
            existing.date = release_date
            existing.save(update_fields=["title", "body", "date", "updated_at"])
            self.stdout.write(
                self.style.SUCCESS(f"ChangelogEntry '{version}' aggiornata (id={existing.id}).")
            )
            return

        entry = ChangelogEntry.objects.create(
            version=version,
            title=title,
            body=body,
            date=release_date,
        )
        self.stdout.write(
            self.style.SUCCESS(f"ChangelogEntry '{version}' creata (id={entry.id}).")
        )
