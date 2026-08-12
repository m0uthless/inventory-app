from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import connection, transaction


OLD_APP = "auslbo"
NEW_APP = "portal"
OLD_TABLE = "auslbo_auslbouserprofile"
NEW_TABLE = "portal_portaluserprofile"
OLD_MODEL = "auslbouserprofile"
NEW_MODEL = "portaluserprofile"


class Command(BaseCommand):
    """Rinomina in-place lo storico dell'app `auslbo` in `portal` (0.9.0).

    Operazione UNA TANTUM, da eseguire su ogni ambiente (dev/prod) DOPO aver
    deployato il codice con l'app rinominata ma PRIMA di lanciare
    `manage.py migrate` (che altrimenti, non trovando alcuno storico per
    l'app "portal", proverebbe a ricreare da zero una tabella con lo stesso
    nome fisico e fallirebbe).

    Cosa fa, in un'unica transazione:
    1. Rinomina fisicamente la tabella `auslbo_auslbouserprofile` →
       `portal_portaluserprofile`.
    2. Aggiorna la riga di `django_content_type` (app_label + model) così i
       permessi Django restano collegati allo stesso content_type_id, senza
       doverli ricreare (i Gruppi già configurati in produzione restano
       validi).
    3. Aggiorna i `codename`/`name` di `auth_permission` collegati a quel
       content_type, sostituendo `auslbouserprofile` con `portaluserprofile`.
    4. Rietichetta le righe di `django_migrations` con app='auslbo' in
       app='portal', così lo storico risulta continuo e `migrate` non tenta
       di rieseguire `0001_initial` per l'app "portal".

    Idempotente: se la tabella `portal_portaluserprofile` esiste già (o
    quella `auslbo_auslbouserprofile` non esiste più), non fa nulla e lo
    segnala.

    IMPORTANTE: eseguire prima su un dump di prod in locale/staging, con
    backup verificato, in finestra di manutenzione — vedi CHANGELOG 0.9.0.
    """

    help = "Rinomina lo storico DB dell'app auslbo in portal (rename 0.9.0, one-shot)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Mostra cosa verrebbe fatto senza eseguire alcuna modifica.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT to_regclass(%s), to_regclass(%s)",
                [f"public.{OLD_TABLE}", f"public.{NEW_TABLE}"],
            )
            old_exists, new_exists = cursor.fetchone()

        if new_exists is not None:
            self.stdout.write(self.style.WARNING(
                f"'{NEW_TABLE}' esiste già: rename già eseguito in precedenza, nulla da fare."
            ))
            return

        if old_exists is None:
            self.stdout.write(self.style.WARNING(
                f"'{OLD_TABLE}' non esiste (ambiente nuovo, senza storico auslbo): "
                "nulla da rinominare, lascia che 'migrate' crei la tabella da zero."
            ))
            return

        self.stdout.write(f"Trovata '{OLD_TABLE}': avvio rename verso '{NEW_TABLE}'...")

        if dry_run:
            self.stdout.write(self.style.WARNING(
                "--dry-run: nessuna modifica eseguita. Passi che verrebbero fatti:\n"
                f"  1. ALTER TABLE {OLD_TABLE} RENAME TO {NEW_TABLE}\n"
                f"  2. UPDATE django_content_type SET app_label='{NEW_APP}', model='{NEW_MODEL}' "
                f"WHERE app_label='{OLD_APP}' AND model='{OLD_MODEL}'\n"
                f"  3. UPDATE auth_permission SET codename=replace(codename,'{OLD_MODEL}','{NEW_MODEL}'), "
                f"name=replace(name,'{OLD_MODEL}','{NEW_MODEL}') WHERE content_type_id IN (...)\n"
                f"  4. UPDATE django_migrations SET app='{NEW_APP}' WHERE app='{OLD_APP}'\n"
            ))
            return

        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(f"ALTER TABLE {OLD_TABLE} RENAME TO {NEW_TABLE}")

                cursor.execute(
                    "SELECT id FROM django_content_type WHERE app_label = %s AND model = %s",
                    [OLD_APP, OLD_MODEL],
                )
                row = cursor.fetchone()
                content_type_id = row[0] if row else None

                if content_type_id is not None:
                    cursor.execute(
                        "UPDATE django_content_type SET app_label = %s, model = %s WHERE id = %s",
                        [NEW_APP, NEW_MODEL, content_type_id],
                    )
                    cursor.execute(
                        "UPDATE auth_permission "
                        "SET codename = replace(codename, %s, %s), "
                        "    name = replace(name, %s, %s) "
                        "WHERE content_type_id = %s",
                        [OLD_MODEL, NEW_MODEL, OLD_MODEL, NEW_MODEL, content_type_id],
                    )
                    self.stdout.write(self.style.SUCCESS(
                        f"  ContentType #{content_type_id} e relativi permessi riallineati a '{NEW_APP}'."
                    ))
                else:
                    self.stdout.write(self.style.WARNING(
                        "  Nessun ContentType trovato per app_label='auslbo': "
                        "permessi non riallineati (verifica manualmente)."
                    ))

                cursor.execute(
                    "UPDATE django_migrations SET app = %s WHERE app = %s",
                    [NEW_APP, OLD_APP],
                )
                updated = cursor.rowcount
                self.stdout.write(self.style.SUCCESS(
                    f"  {updated} righe di django_migrations rietichettate da '{OLD_APP}' a '{NEW_APP}'."
                ))

        self.stdout.write(self.style.SUCCESS(
            "\nRename completato. Ora puoi lanciare 'manage.py migrate' normalmente: "
            "'portal.0001_initial' risulterà già applicata e non verrà rieseguita."
        ))
