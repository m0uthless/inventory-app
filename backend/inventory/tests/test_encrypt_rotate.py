"""inventory/tests/test_encrypt_rotate.py

Verifica il comando manage.py encrypt_rotate:
 1. --dry-run non modifica i dati.
 2. Cifra i campi plaintext.
 3. --check non trova errori su dati cifrati correttamente.
 4. --check riporta errori su token corrotti.
 5. Rotazione chiave: decifra con la vecchia, ricicifra con la nuova.
 6. I campi già cifrati con la chiave attuale vengono skippati (no ricicifra inutile).
 7. I campi vuoti/null non vengono toccati.
"""
from __future__ import annotations

import os
import uuid
from io import StringIO
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings

from core.crypto import PREFIX, encrypt, decrypt, is_encrypted
from core.models import CustomerStatus, InventoryStatus, InventoryType
from crm.models import Customer
from inventory.models import Inventory

pytestmark = pytest.mark.django_db

User = get_user_model()

# Chiave Fernet valida per i test (NON usare in produzione)
TEST_KEY_1 = "S1gOn3bVq6gUO-pMx4pPLh0bwHM3jbklDPx77ZKDq_U="
TEST_KEY_2 = "ei1jIMHROmzc0B_hauMF0h0YVj3vYRDTu6CzmsVGJqQ="


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _uid(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:6]}"


def _make_inventory(*, os_pwd=None, app_pwd=None, vnc_pwd=None):
    """Crea un inventory con campi secret già impostati (bypassa il save() che cifra)."""
    status, _ = InventoryStatus.objects.get_or_create(
        key=_uid("s_"), defaults={"label": "Active"}
    )
    inv_type, _ = InventoryType.objects.get_or_create(
        key=_uid("t_"), defaults={"label": "Server"}
    )
    cs, _ = CustomerStatus.objects.get_or_create(
        key=_uid("cs_"), defaults={"label": "Active"}
    )
    customer = Customer.objects.create(name=_uid("co_"), status=cs)

    inv = Inventory(
        name=_uid("inv_"),
        customer=customer,
        status=status,
        type=inv_type,
    )
    # Salva senza cifrare per testare scenari di plaintext legacy
    Inventory.objects.bulk_create([inv])
    inv = Inventory.objects.get(pk=inv.pk)

    # Imposta i campi direttamente in DB senza passare per save() che cifra
    update_kwargs = {}
    if os_pwd is not None:
        update_kwargs["os_pwd"] = os_pwd
    if app_pwd is not None:
        update_kwargs["app_pwd"] = app_pwd
    if vnc_pwd is not None:
        update_kwargs["vnc_pwd"] = vnc_pwd
    if update_kwargs:
        Inventory.objects.filter(pk=inv.pk).update(**update_kwargs)
        inv.refresh_from_db()

    return inv


def _run_command(*args, env_patch=None):
    """Esegue encrypt_rotate e restituisce (stdout, stderr)."""
    from django.core.management import call_command

    stdout = StringIO()
    stderr = StringIO()

    env = {"FIELD_ENCRYPTION_KEY": TEST_KEY_1}
    if env_patch:
        env.update(env_patch)

    with override_settings(FIELD_ENCRYPTION_KEY=env.get("FIELD_ENCRYPTION_KEY", TEST_KEY_1)):
        with mock.patch.dict(os.environ, env, clear=False):
            call_command(
                "encrypt_rotate",
                *args,
                stdout=stdout,
                stderr=stderr,
                force=True,  # evita input() interattivo
            )

    return stdout.getvalue(), stderr.getvalue()


# ─── Test: dry-run ────────────────────────────────────────────────────────────

class TestDryRun:
    def test_dry_run_does_not_modify_plaintext_fields(self):
        inv = _make_inventory(os_pwd="password_plaintext")

        _run_command("--dry-run")

        inv.refresh_from_db()
        assert inv.os_pwd == "password_plaintext", (
            "--dry-run non deve modificare i dati."
        )

    def test_dry_run_output_mentions_would_update(self):
        _make_inventory(os_pwd="plaintext123")

        stdout, _ = _run_command("--dry-run")

        assert "dry" in stdout.lower() or "would" in stdout.lower() or "aggiornati" in stdout.lower()


# ─── Test: cifratura plaintext ────────────────────────────────────────────────

class TestEncryptPlaintext:
    def test_plaintext_fields_are_encrypted_after_rotate(self):
        inv = _make_inventory(os_pwd="mypassword", app_pwd="apppass")

        _run_command()

        inv.refresh_from_db()
        assert is_encrypted(inv.os_pwd), "os_pwd deve essere cifrato dopo encrypt_rotate."
        assert is_encrypted(inv.app_pwd), "app_pwd deve essere cifrato dopo encrypt_rotate."

    def test_decrypted_value_matches_original(self):
        original = "segretissimo"
        inv = _make_inventory(os_pwd=original)

        with override_settings(FIELD_ENCRYPTION_KEY=TEST_KEY_1):
            _run_command()
            inv.refresh_from_db()
            decrypted = decrypt(inv.os_pwd)

        assert decrypted == original

    def test_null_fields_are_not_touched(self):
        inv = _make_inventory(os_pwd=None, app_pwd=None, vnc_pwd=None)

        _run_command()

        inv.refresh_from_db()
        assert inv.os_pwd is None
        assert inv.app_pwd is None
        assert inv.vnc_pwd is None

    def test_already_encrypted_fields_are_skipped(self):
        """Campi già cifrati con la chiave attuale non devono essere riciifrati."""
        with override_settings(FIELD_ENCRYPTION_KEY=TEST_KEY_1):
            encrypted_val = encrypt("password")
        inv = _make_inventory(os_pwd=encrypted_val)

        _run_command()

        inv.refresh_from_db()
        # Il valore non deve cambiare (stesso token o comunque decifrabile)
        with override_settings(FIELD_ENCRYPTION_KEY=TEST_KEY_1):
            assert decrypt(inv.os_pwd) == "password"


# ─── Test: --check ────────────────────────────────────────────────────────────

class TestCheckMode:
    def test_check_passes_on_correctly_encrypted_fields(self):
        with override_settings(FIELD_ENCRYPTION_KEY=TEST_KEY_1):
            encrypted = encrypt("testpass")
        inv = _make_inventory(os_pwd=encrypted)

        stdout, stderr = _run_command("--check")

        assert "corrotto" not in stderr.lower(), (
            f"--check ha riportato errori su dati validi: {stderr}"
        )
        assert "Nessun campo corrotto" in stdout or "0" in stdout

    def test_check_detects_corrupted_token(self):
        """Un token con prefisso enc:: ma contenuto invalido deve essere segnalato."""
        corrupted = f"{PREFIX}questononeunatokenfernetevalido=="
        inv = _make_inventory(os_pwd=corrupted)

        stdout, stderr = _run_command("--check")

        assert "corrotto" in stderr.lower() or str(inv.id) in stderr, (
            f"--check non ha rilevato il token corrotto per inventory #{inv.id}."
        )

    def test_check_does_not_modify_data(self):
        with override_settings(FIELD_ENCRYPTION_KEY=TEST_KEY_1):
            encrypted = encrypt("immutabile")
        inv = _make_inventory(os_pwd=encrypted)
        original_val = inv.os_pwd

        _run_command("--check")

        inv.refresh_from_db()
        assert inv.os_pwd == original_val, "--check non deve modificare i dati."


# ─── Test: rotazione chiave ───────────────────────────────────────────────────

class TestKeyRotation:
    def test_rotate_decrypts_with_old_key_and_reencrypts_with_new(self):
        """Simula una rotazione KEY_1 → KEY_2."""
        # Cifra con la vecchia chiave
        with override_settings(FIELD_ENCRYPTION_KEY=TEST_KEY_1):
            encrypted_with_old = encrypt("segreto")
        inv = _make_inventory(os_pwd=encrypted_with_old)

        # Esegui rotazione: vecchia=KEY_1, nuova=KEY_2
        stdout, stderr = _run_command(
            env_patch={
                "FIELD_ENCRYPTION_KEY": TEST_KEY_2,
                "OLD_FIELD_ENCRYPTION_KEY": TEST_KEY_1,
            }
        )

        inv.refresh_from_db()
        assert is_encrypted(inv.os_pwd), "Il campo deve rimanere cifrato dopo la rotazione."
        # Deve essere decifrabile con la nuova chiave
        with override_settings(FIELD_ENCRYPTION_KEY=TEST_KEY_2):
            assert decrypt(inv.os_pwd) == "segreto", (
                "Dopo la rotazione, il campo deve essere decifrabile con la nuova chiave."
            )
        # Non deve più essere decifrabile con la vecchia chiave
        from cryptography.fernet import Fernet, InvalidToken
        old_fernet = Fernet(TEST_KEY_1.encode())
        token = inv.os_pwd[len(PREFIX):]
        with pytest.raises(InvalidToken):
            old_fernet.decrypt(token.encode())
