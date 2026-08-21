"""Test di regressione per la sanitizzazione centrale 0.9.1 (SEC-001,
audit 2026-08-19): password (e altri campi sensibili) non devono mai
comparire in chiaro in AuditEvent.changes, indipendentemente da come il
chiamante ha costruito il dizionario `changes`.

Copre:
- log_event() maschera i campi sensibili anche quando `changes` è
  costruito a mano senza passare da build_changes/to_change_value_for_field
  (il bug originale di CustomerVpnAccessViewSet.create);
- CustomerVpnAccessViewSet.create/partial_update via API reale non
  scrivono la password in chiaro nell'audit;
- il PATCH ora registra davvero un diff (prima calcolava `before` e non
  lo usava — bug trovato durante questo fix, non SEC-001 in sé);
- sanitize_audit_history (management command) bonifica eventi già
  esistenti e resta idempotente.
"""
import uuid

import pytest
from django.contrib.auth.models import Permission
from django.contrib.auth import get_user_model
from django.core.management import call_command

from audit.models import AuditEvent
from audit.utils import log_event, sanitize_changes
from crm.models import Customer, CustomerVpnAccess

User = get_user_model()

pytestmark = pytest.mark.django_db


def _make_vpn_editor() -> "User":
    user = User.objects.create_user(username=f"vpnedit_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(Permission.objects.get(codename="access_archie"))
    user.user_permissions.add(Permission.objects.get(codename="add_customervpnaccess"))
    user.user_permissions.add(Permission.objects.get(codename="change_customervpnaccess"))
    user.user_permissions.add(Permission.objects.get(codename="view_customer"))
    return user


class TestSanitizeChangesUtility:
    def test_masks_sensitive_field_regardless_of_construction(self):
        """Riproduce esattamente il pattern bacato originale:
        {field: {"from": None, "to": raw_value}} costruito a mano."""
        changes = {
            "password": {"from": None, "to": "SuperSegreta123!"},
            "applicativo": {"from": None, "to": "Fortinet"},
        }
        sanitized = sanitize_changes(changes)
        # _mask_value lascia None invariato per design (distingue "valore
        # non impostato" da "valore mascherato"): qui "from" era None
        # (creazione), quindi resta None, mentre "to" (il valore reale
        # impostato) viene mascherato.
        assert sanitized["password"] == {"from": None, "to": "••••"}
        assert sanitized["applicativo"] == {"from": None, "to": "Fortinet"}

    def test_idempotent_on_already_masked_values(self):
        already = {"password": {"from": "••••", "to": "••••"}}
        assert sanitize_changes(already) == already

    def test_empty_or_none_changes(self):
        assert sanitize_changes(None) == {}
        assert sanitize_changes({}) == {}


def test_log_event_never_persists_raw_password_from_handcrafted_changes():
    user = User.objects.create_user(username="loguser", password="pw")
    log_event(
        actor=user,
        action="create",
        instance=None,
        changes={"password": {"from": None, "to": "PlainTextSecret!"}},
        subject="test",
    )
    ev = AuditEvent.objects.latest("id")
    assert "PlainTextSecret!" not in str(ev.changes)
    assert ev.changes["password"] == {"from": None, "to": "••••"}


def test_vpn_create_via_api_does_not_leak_password_in_audit(api_client, customer_status):
    customer = Customer.objects.create(name="VpnAudit1", status=customer_status)
    editor = _make_vpn_editor()
    api_client.force_authenticate(user=editor)

    resp = api_client.post(
        f"/api/customers/{customer.id}/vpn/",
        {"applicativo": "Fortinet", "utenza": "tech", "password_input": "PlainTextSecret!"},
        format="json",
    )
    assert resp.status_code == 201

    ev = AuditEvent.objects.latest("id")
    assert "PlainTextSecret!" not in str(ev.changes)
    assert ev.changes.get("password") == {"from": None, "to": "••••"}
    # Il campo non sensibile resta leggibile: l'audit deve restare utile.
    assert ev.changes.get("applicativo") == {"from": None, "to": "Fortinet"}


def test_vpn_patch_now_records_a_real_diff_without_leaking_password(api_client, customer_status):
    """Copre anche il bug trovato (before calcolato e mai usato: il PATCH
    non registrava alcun changes)."""
    customer = Customer.objects.create(name="VpnAudit2", status=customer_status)
    CustomerVpnAccess.objects.create(customer=customer, applicativo="Old", password="OldPass!")
    editor = _make_vpn_editor()
    api_client.force_authenticate(user=editor)

    resp = api_client.patch(
        f"/api/customers/{customer.id}/vpn/",
        {"password_input": "NewPlainTextSecret!"},
        format="json",
    )
    assert resp.status_code == 200

    ev = AuditEvent.objects.filter(action="update").latest("id")
    assert ev.changes, "il PATCH deve ora registrare un diff (prima non lo faceva)"
    assert "NewPlainTextSecret!" not in str(ev.changes)
    assert "OldPass!" not in str(ev.changes)
    # build_changes() (usato da perform_update via _changes_from_validated)
    # produce {"before": ..., "after": ...}, non {"from": ..., "to": ...}
    # come nel caso create() più sopra (che costruisce il dict a mano).
    # La logica di sanitizzazione è generica sui NOMI delle chiavi — maschera
    # ogni valore nel dict, qualunque sia la chiave — quindi il comportamento
    # è corretto in entrambi i casi; era solo l'asserzione di questo test a
    # usare le chiavi sbagliate.
    assert ev.changes.get("password") == {"before": "••••", "after": "••••"}


def test_sanitize_audit_history_command_cleans_existing_events():
    user = User.objects.create_user(username="dirtyuser", password="pw")
    ev = AuditEvent.objects.create(
        actor=user,
        action="create",
        changes={"password": {"from": None, "to": "LeakedBeforeFix!"}},
        object_repr="pre-fix event",
    )

    call_command("sanitize_audit_history", "--force")

    ev.refresh_from_db()
    assert "LeakedBeforeFix!" not in str(ev.changes)
    assert ev.changes["password"] == {"from": None, "to": "••••"}


def test_sanitize_audit_history_dry_run_does_not_write():
    user = User.objects.create_user(username="dirtyuser2", password="pw")
    ev = AuditEvent.objects.create(
        actor=user,
        action="create",
        changes={"password": {"from": None, "to": "StillLeaked!"}},
        object_repr="pre-fix event 2",
    )

    call_command("sanitize_audit_history", "--dry-run")

    ev.refresh_from_db()
    assert ev.changes["password"]["to"] == "StillLeaked!"


def test_sanitize_audit_history_is_idempotent():
    user = User.objects.create_user(username="cleanuser", password="pw")
    ev = AuditEvent.objects.create(
        actor=user,
        action="create",
        changes={"password": {"from": None, "to": "ToBeMaskedOnce!"}},
        object_repr="event",
    )

    call_command("sanitize_audit_history", "--force")
    ev.refresh_from_db()
    first_pass = dict(ev.changes)

    call_command("sanitize_audit_history", "--force")
    ev.refresh_from_db()
    assert ev.changes == first_pass
