"""crm/tests/test_customer_list_filters.py

Filtri della lista Clienti usati dalla UI:
 - has_vpn: clienti con / senza accesso VPN configurato.
 - has_contact: clienti con / senza contatto primario di livello cliente.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import CustomerStatus
from crm.models import Contact, Customer, CustomerVpnAccess

pytestmark = pytest.mark.django_db

User = get_user_model()


def _uid(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:6]}"


@pytest.fixture
def client():
    user = User.objects.create_superuser(username=_uid("su_"), email="s@e.com", password="pw")
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def status():
    s, _ = CustomerStatus.objects.get_or_create(key=_uid("cs_"), defaults={"label": "Active"})
    return s


def _ids(res):
    data = res.json()
    return {r["id"] for r in data.get("results", data)}


def test_has_vpn_filter(client, status):
    with_vpn = Customer.objects.create(name=_uid("co_"), status=status)
    CustomerVpnAccess.objects.create(customer=with_vpn, utenza="tech")
    without_vpn = Customer.objects.create(name=_uid("co_"), status=status)

    yes = _ids(client.get("/api/customers/?has_vpn=true"))
    no = _ids(client.get("/api/customers/?has_vpn=false"))

    assert with_vpn.id in yes and without_vpn.id not in yes
    assert without_vpn.id in no and with_vpn.id not in no


def test_has_contact_filter(client, status):
    with_contact = Customer.objects.create(name=_uid("co_"), status=status)
    Contact.objects.create(customer=with_contact, name="Mario Rossi", is_primary=True)
    without_contact = Customer.objects.create(name=_uid("co_"), status=status)

    yes = _ids(client.get("/api/customers/?has_contact=true"))
    no = _ids(client.get("/api/customers/?has_contact=false"))

    assert with_contact.id in yes and without_contact.id not in yes
    assert without_contact.id in no and with_contact.id not in no


def test_filters_absent_return_all(client, status):
    a = Customer.objects.create(name=_uid("co_"), status=status)
    b = Customer.objects.create(name=_uid("co_"), status=status)
    CustomerVpnAccess.objects.create(customer=b, utenza="tech")

    ids = _ids(client.get("/api/customers/"))
    assert {a.id, b.id} <= ids
