"""
Management command: close_resolved_issues
==========================================
Chiude automaticamente le issue in stato «Risolta» la cui data di chiusura
(closed_at) è avvenuta almeno 48 ore fa.

Uso:
    python manage.py close_resolved_issues
    python manage.py close_resolved_issues --dry-run   # solo report, nessuna modifica

Schedulazione consigliata (crontab, ogni ora):
    0 * * * * python manage.py close_resolved_issues >> /var/log/close_issues.log 2>&1
"""

import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from issues.models import Issue, IssueStatus


class Command(BaseCommand):
    help = "Chiude automaticamente le issue risolte da più di 48 ore."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Mostra le issue che verrebbero chiuse senza effettuare modifiche.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        cutoff = timezone.localdate() - datetime.timedelta(hours=48)

        candidates = Issue.objects.filter(
            status=IssueStatus.RESOLVED,
            closed_at__isnull=False,
            closed_at__lte=cutoff,
            deleted_at__isnull=True,
        )

        count = candidates.count()

        if count == 0:
            self.stdout.write("Nessuna issue da chiudere.")
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING(f"[DRY-RUN] {count} issue verrebbero chiuse:")
            )
            for issue in candidates.order_by("closed_at")[:50]:
                self.stdout.write(f"  #{issue.id} — {issue.title} (closed_at={issue.closed_at})")
            return

        updated = candidates.update(status=IssueStatus.CLOSED)
        self.stdout.write(
            self.style.SUCCESS(f"{updated} issue chiuse automaticamente.")
        )
