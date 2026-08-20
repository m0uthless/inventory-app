"""Test per il multi-cliente (0.9.0, punti 3+4+5 roadmap).

Copre: PortalUserProfile.is_active con la nuova regola (default deve essere
tra i customers assegnati), /api/portal/me/ (cliente attivo + lista, blocco
esplicito), /api/portal/switch-customer/ (validazione, persistenza in
sessione, self-healing).
"""
import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import CustomerStatus
from crm.models import Customer
from portal.models import PortalUserProfile

User = get_user_model()


@pytest.fixture
def customer_status(db):
    obj, _ = CustomerStatus.objects.get_or_create(
        key="active_portal_multi_tests", defaults={"label": "Active"},
    )
    return obj


def _make_customer(customer_status, suffix=None):
    suffix = suffix or uuid.uuid4().hex[:6]
    return Customer.objects.create(name=f"Cust_{suffix}", status=customer_status)


def _make_portal_user(customer_status, customers, default=None):
    """Utente portale con più clienti assegnati; default = customers[0] se omesso."""
    user = User.objects.create_user(username=f"portal_{uuid.uuid4().hex[:6]}", password="pw")
    default = default or customers[0]
    profile = PortalUserProfile.objects.create(user=user, customer=default)
    profile.customers.set(customers)
    return user, profile


@pytest.mark.django_db
def test_is_active_true_when_default_is_among_assigned(customer_status):
    c1 = _make_customer(customer_status, "a")
    c2 = _make_customer(customer_status, "b")
    _, profile = _make_portal_user(customer_status, [c1, c2], default=c1)
    assert profile.is_active is True


@pytest.mark.django_db
def test_is_active_false_when_default_removed_from_assigned(customer_status):
    c1 = _make_customer(customer_status, "a")
    c2 = _make_customer(customer_status, "b")
    _, profile = _make_portal_user(customer_status, [c1, c2], default=c1)

    profile.customers.remove(c1)
    profile.refresh_from_db()
    assert profile.is_active is False


@pytest.mark.django_db
def test_is_active_false_when_default_customer_deleted(customer_status):
    c1 = _make_customer(customer_status, "a")
    _, profile = _make_portal_user(customer_status, [c1], default=c1)

    c1.deleted_at = __import__("django.utils.timezone", fromlist=["now"]).now()
    c1.save()
    profile.refresh_from_db()
    assert profile.is_active is False


@pytest.mark.django_db
def test_me_returns_active_customer_and_full_list(customer_status):
    c1 = _make_customer(customer_status, "a")
    c2 = _make_customer(customer_status, "b")
    user, _ = _make_portal_user(customer_status, [c1, c2], default=c1)

    client = APIClient()
    client.force_authenticate(user=user)
    resp = client.get("/api/portal/me/")

    assert resp.status_code == 200
    assert resp.data["customer"]["id"] == c1.id
    assert {c["id"] for c in resp.data["customers"]} == {c1.id, c2.id}


@pytest.mark.django_db
def test_switch_customer_persists_in_session(customer_status):
    c1 = _make_customer(customer_status, "a")
    c2 = _make_customer(customer_status, "b")
    user, _ = _make_portal_user(customer_status, [c1, c2], default=c1)

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post("/api/portal/switch-customer/", {"customer_id": c2.id}, format="json")
    assert resp.status_code == 200
    assert resp.data["customer"]["id"] == c2.id

    # Una richiesta successiva nella stessa sessione deve vedere c2 come attivo.
    resp2 = client.get("/api/portal/me/")
    assert resp2.data["customer"]["id"] == c2.id


@pytest.mark.django_db
def test_switch_customer_rejects_unassigned_customer(customer_status):
    c1 = _make_customer(customer_status, "a")
    c_other = _make_customer(customer_status, "other")
    user, _ = _make_portal_user(customer_status, [c1], default=c1)

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post("/api/portal/switch-customer/", {"customer_id": c_other.id}, format="json")
    assert resp.status_code == 400

    # /me deve restare invariato sul default.
    resp2 = client.get("/api/portal/me/")
    assert resp2.data["customer"]["id"] == c1.id


@pytest.mark.django_db
def test_me_returns_explicit_403_when_blocked(customer_status):
    c1 = _make_customer(customer_status, "a")
    c2 = _make_customer(customer_status, "b")
    user, profile = _make_portal_user(customer_status, [c1, c2], default=c1)

    profile.customers.remove(c1)  # rimuove il default dagli assegnati

    client = APIClient()
    client.force_authenticate(user=user)
    resp = client.get("/api/portal/me/")

    assert resp.status_code == 403
    assert resp.data["blocked"] is True


@pytest.mark.django_db
def test_session_self_heals_when_active_customer_no_longer_assigned(customer_status):
    """Se l'utente aveva scelto c2 in sessione e poi c2 viene rimosso dagli
    assegnati (ma il default c1 resta valido), la richiesta successiva deve
    ricadere sul default invece di restare bloccata su un customer_id ormai
    invalido in sessione."""
    c1 = _make_customer(customer_status, "a")
    c2 = _make_customer(customer_status, "b")
    user, profile = _make_portal_user(customer_status, [c1, c2], default=c1)

    client = APIClient()
    client.force_authenticate(user=user)
    client.post("/api/portal/switch-customer/", {"customer_id": c2.id}, format="json")

    profile.customers.remove(c2)

    resp = client.get("/api/portal/me/")
    assert resp.status_code == 200
    assert resp.data["customer"]["id"] == c1.id
