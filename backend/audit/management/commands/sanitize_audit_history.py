"""audit/management/commands/sanitize_audit_history.py

0.9.1 (SEC-001, bonifica storica — audit 2026-08-19): il fix in
audit/utils.log_event (_sanitize_changes) protegge tutti gli AuditEvent
creati DA ORA IN POI, ma non tocca quelli già salvati prima del fix — in
particolare gli eventi "create"/"update" generati da
CustomerVpnAccessViewSet, che possono contenere password VPN in chiaro
nella colonna `changes`.

Questo comando riapplica la stessa sanitizzazione (_sanitize_changes) a
ogni AuditEvent già esistente, sovrascrivendo `changes` con la versione
mascherata. Idempotente: un evento già sanitizzato non viene toccato una
seconda volta (l'output di _sanitize_changes su un valore già "••••"
resta "••••", quindi il confronto before/after non lo marca come dirty).

Uso:
    docker compose -f docker-compose.yml -f docker-compose.dev.yml \
        run --entrypoint "" backend python manage.py sanitize_audit_history --dry-run

    docker compose -f docker-compose.yml -f docker-compose.dev.yml \
        run --entrypoint "" backend python manage.py sanitize_audit_history
"""
from __future__ import annotations

import sys

from django.core.management.base import BaseCommand
from django.db import transaction

from audit.models import AuditEvent
from audit.utils import sanitize_changes


class Command(BaseCommand):
    help = (
        "Bonifica gli AuditEvent già salvati riapplicando la sanitizzazione "
        "centrale di log_event (SEC-001): maschera i valori dei campi "
        "sensibili (password, token, secret, ecc.) ancora in chiaro nella "
        "colonna changes. Non tocca metadata/path (già sanitizzati al "
        "momento del salvataggio da _sanitize_metadata, non da questo fix)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Mostra quanti eventi verrebbero modificati senza scrivere nulla.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=500,
            help="Numero di righe da processare per batch (default: 500).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Salta la richiesta di conferma interattiva.",
        )

    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]
        batch_size: int = options["batch_size"]
        force: bool = options["force"]

        if not dry_run and not force:
            self.stdout.write(
                self.style.WARNING(
                    "\nATTENZIONE: questa operazione sovrascrive changes su "
                    "AuditEvent esistenti in produzione.\n"
                    "Assicurati di avere un backup del database prima di "
                    "procedere (i valori mascherati non sono recuperabili "
                    "dall'audit dopo questa operazione).\n"
                )
            )
            confirm = input("Digita 'si' per confermare: ").strip().lower()
            if confirm not in ("si", "sì", "yes", "y"):
                self.stdout.write("Operazione annullata.")
                return

        stats = {"total": 0, "dirty": 0, "updated": 0, "errors": 0}
        qs = AuditEvent.objects.all().only("id", "changes")

        for event in qs.iterator(chunk_size=batch_size):
            stats["total"] += 1
            try:
                sanitized = sanitize_changes(event.changes)
            except Exception as e:
                stats["errors"] += 1
                self.stderr.write(
                    self.style.ERROR(f"  AuditEvent #{event.id}: errore sanitizzazione: {e}")
                )
                continue

            if sanitized == (event.changes or {}):
                continue

            stats["dirty"] += 1
            if not dry_run:
                try:
                    with transaction.atomic():
                        event.changes = sanitized
                        event.save(update_fields=["changes"])
                    stats["updated"] += 1
                except Exception as e:
                    stats["errors"] += 1
                    self.stderr.write(
                        self.style.ERROR(f"  AuditEvent #{event.id}: errore salvataggio: {e}")
                    )

        self.stdout.write("")
        if dry_run:
            self.stdout.write(self.style.WARNING("=== DRY RUN — nessuna modifica applicata ==="))
        else:
            self.stdout.write(self.style.SUCCESS("=== Bonifica completata ==="))

        self.stdout.write(f"  AuditEvent esaminati       : {stats['total']}")
        self.stdout.write(f"  Da mascherare (trovati)    : {stats['dirty']}")
        if not dry_run:
            self.stdout.write(f"  Effettivamente aggiornati  : {stats['updated']}")
        if stats["errors"]:
            self.stdout.write(self.style.ERROR(f"  Errori                     : {stats['errors']}"))
            sys.exit(1)
