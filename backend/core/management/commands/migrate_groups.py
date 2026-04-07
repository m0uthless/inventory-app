from __future__ import annotations

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand


# Rinomina: vecchio nome → nuovo nome
RENAMES = {
    "viewer":       "user",
    "auslbo_users": "user_auslbo",
}

# Gruppi da creare se non esistono già
CREATE = [
    "admin",
    "editor",
    "user",
    "admin_auslbo",
    "editor_auslbo",
    "user_auslbo",
]


class Command(BaseCommand):
    help = "Rinomina i vecchi gruppi e crea i nuovi gruppi secondo la nuova struttura."

    def handle(self, *args, **options):
        # 1. Rinomina gruppi esistenti
        for old_name, new_name in RENAMES.items():
            try:
                group = Group.objects.get(name=old_name)
                if not Group.objects.filter(name=new_name).exists():
                    group.name = new_name
                    group.save()
                    self.stdout.write(
                        self.style.SUCCESS(f"  Rinominato: '{old_name}' → '{new_name}'")
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  Skippato: '{new_name}' esiste già, '{old_name}' non rinominato."
                        )
                    )
            except Group.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f"  Gruppo '{old_name}' non trovato, skip rinomina.")
                )

        # 2. Crea gruppi mancanti
        for name in CREATE:
            group, created = Group.objects.get_or_create(name=name)
            if created:
                self.stdout.write(self.style.SUCCESS(f"  Creato gruppo: '{name}'"))
            else:
                self.stdout.write(f"  Gruppo già esistente: '{name}'")

        self.stdout.write(self.style.SUCCESS("\nMigrazione gruppi completata."))
        self.stdout.write(
            "\nRicorda di assegnare i permessi Django ai gruppi dal Django Admin:\n"
            "  admin       → permessi completi su tutti i modelli\n"
            "  editor      → add/change su inventory, device, crm, maintenance, wiki, issues\n"
            "  user        → view su tutti i modelli (sola lettura)\n"
            "  admin_auslbo, editor_auslbo → come vuoi (gestiti da Django Admin)\n"
            "  user_auslbo → view sui modelli esposti al portal\n"
        )
