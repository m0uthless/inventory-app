"""
Test suite: ContactViewSet.bulk_restore

Copre:
1. Comportamento corretto del ripristino bulk (deleted_at -> None)
2. Invariante _enforce_primary: dopo il restore di un contatto is_primary=True,
   gli altri contatti primari dello stesso customer/site vengono demoted.
3. Permesso: bulk_restore richiede CanRestoreContact (403 senza permesso).
4. Richiesta body malformata → 400.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import CustomerStatus
from crm.models import Contact, Customer

pytestmark = pytest.mark.django_db

URL = "/api/contacts/bulk_restore/"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(*, superuser: bool = False):
    User = get_user_model()
    u = User.objects.create_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw")
    if superuser:
        u.is_staff = True
        u.is_superuser = True
        u.save(update_fields=["is_staff", "is_superuser"])
    return u


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _make_customer(user) -> Customer:
    cs = CustomerStatus.objects.get_or_create(
        key="active_contact", defaults={"label": "Active"}
    )[0]
    return Customer.objects.create(
        name=f"Co_{uuid.uuid4().hex[:4]}",
        status=cs,
        created_by=user,
        updated_by=user,
    )


def _make_contact(customer, user, *, is_primary: bool = False, deleted: bool = False) -> Contact:
    c = Contact.objects.create(
        customer=customer,
        name=f"Contact_{uuid.uuid4().hex[:4]}",
        is_primary=is_primary,
        created_by=user,
        updated_by=user,
    )
    if deleted:
        c.deleted_at = timezone.now()
        c.save(update_fields=["deleted_at"])
    return c


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_bulk_restore_restores_contacts():
    """I contatti eliminati devono avere deleted_at=None dopo il restore."""
    user = _make_user(superuser=True)
    cust = _make_customer(user)
    c1 = _make_contact(cust, user, deleted=True)
    c2 = _make_contact(cust, user, deleted=True)

    client = _auth_client(user)
    r = client.post(URL, {"ids": [c1.id, c2.id]}, format="json")

    assert r.status_code == 200, r.data
    assert r.data["count"] == 2

    c1.refresh_from_db()
    c2.refresh_from_db()
    assert c1.deleted_at is None
    assert c2.deleted_at is None


def test_bulk_restore_skips_already_active_contacts():
    """Contatti già attivi non vengono inclusi nel restore."""
    user = _make_user(superuser=True)
    cust = _make_customer(user)
    active = _make_contact(cust, user, deleted=False)
    deleted = _make_contact(cust, user, deleted=True)

    client = _auth_client(user)
    r = client.post(URL, {"ids": [active.id, deleted.id]}, format="json")

    assert r.status_code == 200, r.data
    # Solo il deleted viene contato come restored
    assert r.data["count"] == 1
    assert deleted.id in r.data["restored"]
    assert active.id not in r.data["restored"]


def test_bulk_restore_enforce_primary_demotes_existing_primary():
    """
    Invariante _enforce_primary:
    Se ripristino un contatto is_primary=True, l'altro contatto primario attivo
    dello stesso customer deve perdere il flag is_primary.
    """
    user = _make_user(superuser=True)
    cust = _make_customer(user)

    # Contatto primario attivo già esistente
    existing_primary = _make_contact(cust, user, is_primary=True, deleted=False)

    # Contatto primario eliminato che vogliamo ripristinare
    deleted_primary = _make_contact(cust, user, is_primary=True, deleted=True)

    client = _auth_client(user)
    r = client.post(URL, {"ids": [deleted_primary.id]}, format="json")

    assert r.status_code == 200, r.data

    deleted_primary.refresh_from_db()
    existing_primary.refresh_from_db()

    # Il contatto ripristinato deve essere attivo e primario
    assert deleted_primary.deleted_at is None
    assert deleted_primary.is_primary is True

    # Il vecchio primario deve aver perso il flag
    assert existing_primary.is_primary is False


def test_bulk_restore_non_primary_does_not_affect_others():
    """Il restore di contatti non primari non deve toccare altri contatti."""
    user = _make_user(superuser=True)
    cust = _make_customer(user)

    primary = _make_contact(cust, user, is_primary=True, deleted=False)
    non_primary_deleted = _make_contact(cust, user, is_primary=False, deleted=True)

    client = _auth_client(user)
    r = client.post(URL, {"ids": [non_primary_deleted.id]}, format="json")

    assert r.status_code == 200, r.data

    primary.refresh_from_db()
    assert primary.is_primary is True  # invariato


def test_bulk_restore_requires_permission():
    """Utente senza permesso restore deve ricevere 403."""
    user = _make_user(superuser=False)
    owner = _make_user(superuser=True)
    cust = _make_customer(owner)
    contact = _make_contact(cust, owner, deleted=True)

    client = _auth_client(user)
    r = client.post(URL, {"ids": [contact.id]}, format="json")

    assert r.status_code == 403, r.data


def test_bulk_restore_with_change_permission():
    """Utente con change_contact deve poter fare bulk_restore."""
    owner = _make_user(superuser=True)
    cust = _make_customer(owner)
    contact = _make_contact(cust, owner, deleted=True)

    has_perm = _make_user(superuser=False)
    perm = Permission.objects.get(codename="change_contact")
    has_perm.user_permissions.add(perm)

    client = _auth_client(has_perm)
    r = client.post(URL, {"ids": [contact.id]}, format="json")

    assert r.status_code == 200, r.data


def test_bulk_restore_empty_ids_returns_400():
    """Body con lista vuota deve restituire 400."""
    user = _make_user(superuser=True)
    client = _auth_client(user)

    r = client.post(URL, {"ids": []}, format="json")
    assert r.status_code == 400, r.data


def test_bulk_restore_missing_ids_returns_400():
    """Body senza campo ids deve restituire 400."""
    user = _make_user(superuser=True)
    client = _auth_client(user)

    r = client.post(URL, {}, format="json")
    assert r.status_code == 400, r.data
