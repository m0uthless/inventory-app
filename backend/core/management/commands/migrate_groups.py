from __future__ import annotations

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand


# Rinomina: vecchio nome → nuovo nome (solo legacy, non crea nuovi gruppi)
RENAMES = {
    "viewer":       "user",
    "auslbo_users": "user_auslbo",
}


class Command(BaseCommand):
    help = (
        "Rinomina i gruppi legacy secondo la nuova struttura. "
        "Non crea gruppi con nomi fissi: i gruppi vengono gestiti "
        "liberamente tramite Django Admin."
    )

    def handle(self, *args, **options):
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

        self.stdout.write(self.style.SUCCESS("\nMigrazione gruppi legacy completata."))
        self.stdout.write(
            "\nI gruppi di ARCHIE vengono gestiti da Django Admin.\n"
            "Assegna il permesso 'core.access_archie' al gruppo che deve\n"
            "accedere al frontend Archie principale.\n"
            "L'accesso al portal AUSL BO è controllato dal profilo AuslBoUserProfile.\n"
        )
