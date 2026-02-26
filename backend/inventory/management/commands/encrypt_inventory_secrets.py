from __future__ import annotations

from django.core.management.base import BaseCommand

from core.crypto import encrypt, is_encrypted
from inventory.models import Inventory


class Command(BaseCommand):
    help = "Encrypt legacy plaintext inventory secret fields (os_pwd/app_pwd/vnc_pwd) at-rest."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many rows would be updated without writing.",
        )

    def handle(self, *args, **options):
        dry_run = bool(options.get("dry_run"))

        qs = Inventory.objects.all().only("id", "os_pwd", "app_pwd", "vnc_pwd")
        updated = 0

        for inv in qs.iterator(chunk_size=500):
            changed = False
            for field in ("os_pwd", "app_pwd", "vnc_pwd"):
                val = getattr(inv, field, None)
                if not val:
                    continue
                if is_encrypted(val):
                    continue
                setattr(inv, field, encrypt(val))
                changed = True

            if changed:
                updated += 1
                if not dry_run:
                    inv.save(update_fields=["os_pwd", "app_pwd", "vnc_pwd", "updated_at"])

        if dry_run:
            self.stdout.write(self.style.WARNING(f"[dry-run] Would update {updated} inventory rows"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Updated {updated} inventory rows"))
