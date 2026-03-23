"""inventory/management/commands/encrypt_rotate.py

Ruota la FIELD_ENCRYPTION_KEY ri-cifrando tutti i secrets dell'inventario
(os_pwd, app_pwd, vnc_pwd) dalla vecchia chiave alla nuova.

Uso tipico (key rotation):
    # 1. Imposta la vecchia chiave come OLD_FIELD_ENCRYPTION_KEY
    # 2. Imposta la nuova chiave come FIELD_ENCRYPTION_KEY
    # 3. Esegui con --dry-run per preview
    # 4. Esegui senza --dry-run per applicare
    # 5. Rimuovi OLD_FIELD_ENCRYPTION_KEY dall'ambiente

    docker compose exec backend python manage.py encrypt_rotate --dry-run
    docker compose exec backend python manage.py encrypt_rotate

Scenari supportati:
    A) Rotazione chiave (OLD_FIELD_ENCRYPTION_KEY → FIELD_ENCRYPTION_KEY):
       decifra con la vecchia, ricicifra con la nuova.

    B) Prima cifratura (campi plaintext → FIELD_ENCRYPTION_KEY):
       equivalente a encrypt_inventory_secrets, ma con report più dettagliato.

    C) Verifica integrità (--check):
       tenta di decifrare tutti i campi cifrati con la chiave attuale
       e riporta quanti sono corretti / corrotti / plaintext.
"""
from __future__ import annotations

import os
import sys
from typing import Optional

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.crypto import PREFIX, decrypt, encrypt, get_fernet, is_encrypted
from inventory.models import Inventory

SECRET_FIELDS = ("os_pwd", "app_pwd", "vnc_pwd")


def _get_old_fernet():
    """Restituisce il Fernet per la vecchia chiave, se configurata."""
    old_key = os.environ.get("OLD_FIELD_ENCRYPTION_KEY", "").strip()
    if not old_key:
        return None
    try:
        from cryptography.fernet import Fernet
        key_b = old_key.encode("utf-8") if isinstance(old_key, str) else old_key
        return Fernet(key_b)
    except Exception as e:
        raise CommandError(
            f"OLD_FIELD_ENCRYPTION_KEY non valida: {e}\n"
            "Assicurati che sia una chiave Fernet base64url valida a 32 byte."
        ) from e


def _decrypt_with_old(value: str, old_fernet) -> Optional[str]:
    """Decifra un valore con la vecchia chiave Fernet."""
    if not is_encrypted(value):
        return value  # plaintext legacy
    token = value[len(PREFIX):]
    try:
        return old_fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except Exception:
        return None  # token corrotto o chiave sbagliata


class Command(BaseCommand):
    help = (
        "Ruota la FIELD_ENCRYPTION_KEY ri-cifrando i secrets dell'inventario. "
        "Imposta OLD_FIELD_ENCRYPTION_KEY=<vecchia_chiave> nell'ambiente "
        "per decifrare con la vecchia chiave e ricicifra con quella nuova."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Mostra quante righe verrebbero aggiornate senza scrivere nulla.",
        )
        parser.add_argument(
            "--check",
            action="store_true",
            help=(
                "Verifica che tutti i campi cifrati siano decifrabili con la chiave attuale. "
                "Non modifica nessun dato."
            ),
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
        check_mode: bool = options["check"]
        batch_size: int = options["batch_size"]
        force: bool = options["force"]

        # Verifica che la nuova chiave sia valida prima di toccare dati
        try:
            new_fernet = get_fernet()
        except Exception as e:
            raise CommandError(f"FIELD_ENCRYPTION_KEY non valida o mancante: {e}") from e

        if check_mode:
            self._run_check(new_fernet)
            return

        old_fernet = _get_old_fernet()

        if old_fernet:
            self.stdout.write(
                self.style.WARNING(
                    "OLD_FIELD_ENCRYPTION_KEY rilevata: modalità rotazione chiave attiva.\n"
                    "I campi cifrati verranno decifrati con la vecchia chiave "
                    "e riciifrati con la nuova."
                )
            )
        else:
            self.stdout.write(
                "OLD_FIELD_ENCRYPTION_KEY non impostata: modalità prima cifratura / "
                "ricicifra con la chiave attuale."
            )

        if not dry_run and not force:
            self.stdout.write(
                self.style.WARNING(
                    "\nATTENZIONE: questa operazione modifica i dati in produzione.\n"
                    "Assicurati di avere un backup del database prima di procedere.\n"
                )
            )
            confirm = input("Digita 'si' per confermare: ").strip().lower()
            if confirm not in ("si", "sì", "yes", "y"):
                self.stdout.write("Operazione annullata.")
                return

        stats = {"total": 0, "updated": 0, "skipped": 0, "errors": 0, "plaintext": 0}
        qs = Inventory.objects.all().only("id", *SECRET_FIELDS)

        for inv in qs.iterator(chunk_size=batch_size):
            stats["total"] += 1
            changed = False
            error = False

            for field in SECRET_FIELDS:
                val: Optional[str] = getattr(inv, field, None)
                if not val:
                    continue

                if old_fernet:
                    # Rotazione: decifra con vecchia, ricicifra con nuova
                    if is_encrypted(val):
                        plaintext = _decrypt_with_old(val, old_fernet)
                        if plaintext is None:
                            # Potrebbe essere già cifrato con la nuova chiave
                            try:
                                decrypt(val)  # usa la chiave attuale
                                # Già cifrato con la nuova chiave — skip
                                continue
                            except Exception:
                                self.stderr.write(
                                    self.style.ERROR(
                                        f"  inventory #{inv.id} campo {field}: "
                                        "impossibile decifrare né con la vecchia né con la nuova chiave. "
                                        "Salta."
                                    )
                                )
                                stats["errors"] += 1
                                error = True
                                continue
                        new_val = encrypt(plaintext)
                        setattr(inv, field, new_val)
                        changed = True
                    else:
                        # Plaintext legacy: cifra con la nuova chiave
                        stats["plaintext"] += 1
                        setattr(inv, field, encrypt(val))
                        changed = True
                else:
                    # Nessuna old key: cifra plaintext o ricicifra con chiave attuale
                    if not is_encrypted(val):
                        stats["plaintext"] += 1
                        setattr(inv, field, encrypt(val))
                        changed = True
                    # Se già cifrato con la stessa chiave, skip
                    else:
                        try:
                            plaintext = decrypt(val)
                            new_val = encrypt(plaintext)
                            if new_val != val:
                                setattr(inv, field, new_val)
                                changed = True
                        except Exception:
                            stats["errors"] += 1
                            self.stderr.write(
                                self.style.ERROR(
                                    f"  inventory #{inv.id} campo {field}: "
                                    "impossibile decifrare con la chiave attuale."
                                )
                            )
                            error = True

            if changed and not error:
                stats["updated"] += 1
                if not dry_run:
                    try:
                        with transaction.atomic():
                            inv.save(update_fields=[*SECRET_FIELDS, "updated_at"])
                    except Exception as e:
                        stats["errors"] += 1
                        stats["updated"] -= 1
                        self.stderr.write(
                            self.style.ERROR(f"  inventory #{inv.id}: errore salvataggio: {e}")
                        )
            elif not changed and not error:
                stats["skipped"] += 1

        # Report finale
        self.stdout.write("")
        if dry_run:
            self.stdout.write(self.style.WARNING("=== DRY RUN — nessuna modifica applicata ==="))
        else:
            self.stdout.write(self.style.SUCCESS("=== Rotazione completata ==="))

        self.stdout.write(f"  Inventory totali esaminati : {stats['total']}")
        self.stdout.write(f"  Aggiornati                 : {stats['updated']}")
        self.stdout.write(f"  Già aggiornati (skip)      : {stats['skipped']}")
        self.stdout.write(f"  Plaintext trovati          : {stats['plaintext']}")
        if stats["errors"]:
            self.stdout.write(
                self.style.ERROR(f"  Errori                     : {stats['errors']}")
            )
            sys.exit(1)

    def _run_check(self, current_fernet):
        """Verifica che tutti i campi cifrati siano decifrabili."""
        self.stdout.write("=== Verifica integrità cifratura ===")
        stats = {"total": 0, "ok": 0, "plaintext": 0, "corrupted": 0, "empty": 0}

        qs = Inventory.objects.all().only("id", *SECRET_FIELDS)
        for inv in qs.iterator(chunk_size=500):
            stats["total"] += 1
            for field in SECRET_FIELDS:
                val: Optional[str] = getattr(inv, field, None)
                if not val:
                    stats["empty"] += 1
                    continue
                if not is_encrypted(val):
                    stats["plaintext"] += 1
                    continue
                token = val[len(PREFIX):]
                try:
                    current_fernet.decrypt(token.encode("utf-8"))
                    stats["ok"] += 1
                except Exception:
                    stats["corrupted"] += 1
                    self.stderr.write(
                        self.style.ERROR(
                            f"  CORROTTO: inventory #{inv.id}, campo {field}"
                        )
                    )

        self.stdout.write(f"  Inventory esaminati : {stats['total']}")
        self.stdout.write(f"  Campi OK (cifrati)  : {stats['ok']}")
        self.stdout.write(f"  Campi plaintext     : {stats['plaintext']}")
        self.stdout.write(f"  Campi vuoti         : {stats['empty']}")
        if stats["corrupted"]:
            self.stdout.write(
                self.style.ERROR(f"  Campi CORROTTI      : {stats['corrupted']}")
            )
            sys.exit(1)
        else:
            self.stdout.write(self.style.SUCCESS("  Nessun campo corrotto trovato."))
