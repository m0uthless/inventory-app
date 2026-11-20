"""Promemoria di rinnovo dei contratti (vedi contracts/reminders.py).

Gira nel servizio `cron` ogni 15 minuti ma agisce solo alle 8:00 locali; è
idempotente (una data già registrata non si rimanda). `--force` ignora l'orario.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from contracts import reminders
from core.modules import is_module_enabled

SEND_HOUR = 8  # ora locale (TIME_ZONE=Europe/Rome)


class Command(BaseCommand):
    help = "Manda i promemoria di rinnovo dei contratti dovuti oggi."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Esegue a qualunque ora.")

    def handle(self, *args, **options):
        now_local = timezone.localtime()
        if not options["force"] and now_local.hour != SEND_HOUR:
            self.stdout.write(f"[contract_reminders] Fuori orario (ore locali: {now_local.hour}), nessuna azione.")
            return
        if not is_module_enabled("contracts"):
            self.stdout.write("[contract_reminders] Modulo Contratti spento, nessuna azione.")
            return
        n = reminders.send_due(now_local.date())
        self.stdout.write(self.style.SUCCESS(f"[contract_reminders] {n} promemoria inviati."))
