"""Test per il fix 2.3 (audit 2026-07):

- RispacsViewSet (registro RIS/PACS globale) era un ModelViewSet completo
  aperto a QUALUNQUE utente portale autenticato, anche solo lettore, senza
  rispettare i permessi Django né distinguere interni da portale. Ora le
  scritture sono riservate a utenti interni con il permesso Django corretto.
- DeviceRispacsViewSet (tabella associativa Device↔RIS/PACS) non aveva né
  scope tenant né permission_classes: un utente portale con un permesso
  Django sufficiente poteva leggere/creare collegamenti per device di
  qualunque customer.

Segue le convenzioni già in uso in device/tests/ (helper locali, SQLite
in-memory tramite device/tests/conftest.py).
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from core.models import CustomerStatus, SiteStatus
from crm.models import Customer, Site
from device.models import Device, DeviceRispacs, DeviceStatus, DeviceType, Rispacs

pytestmark = pytest.mark.django_db

User = get_user_model()


def _superuser():
    return User.objects.create_superuser(
        username=f"rispacs_e2e_{uuid.uuid4().hex[:6]}", email="a@example.com", password="pw",
    )


def _internal_user(*, perms: list[str] | None = None):
    user = User.objects.create_user(username=f"rispacs_internal_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(Permission.objects.get(codename="access_archie"))
    if perms:
        user.user_permissions.add(*Permission.objects.filter(codename__in=perms))
    return user


def _auslbo_user(customer, *, perms: list[str] | None = None):
    from auslbo.models import AuslBoUserProfile

    user = User.objects.create_user(username=f"rispacs_auslbo_{uuid.uuid4().hex[:6]}", password="pw")
    AuslBoUserProfile.objects.create(user=user, customer=customer)
    if perms:
        user.user_permissions.add(*Permission.objects.filter(codename__in=perms))
    return user


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _make_device(user, *, suffix="a"):
    customer_status = CustomerStatus.objects.get_or_create(
        key=f"rispacs_e2e_cs_{suffix}", defaults={"label": "Active"},
    )[0]
    site_status = SiteStatus.objects.get_or_create(
        key=f"rispacs_e2e_ss_{suffix}", defaults={"label": "Active"},
    )[0]
    device_status = DeviceStatus.objects.get_or_create(name=f"Attivo_rispacs_e2e_{suffix}")[0]
    device_type = DeviceType.objects.get_or_create(name=f"Modalita_rispacs_e2e_{suffix}")[0]
    customer = Customer.objects.create(name=f"RispacsE2E_{suffix}", status=customer_status)
    site = Site.objects.create(customer=customer, name="HQ", status=site_status)
    return Device.objects.create(
        customer=customer, site=site, type=device_type, status=device_status,
        created_by=user, updated_by=user,
    )


# ─── RispacsViewSet: scritture riservate a utenti interni ────────────────────

def test_portal_user_can_read_global_rispacs_registry():
    admin = _superuser()
    Rispacs.objects.create(name="PACS Centrale", ip="10.90.0.10", port=104, aetitle="PACSCTR")

    device_a = _make_device(admin, suffix="rispacsreada")
    reader = _auslbo_user(device_a.customer, perms=["view_rispacs"])
    resp = _auth_client(reader).get("/api/rispacs/")
    assert resp.status_code == 200
    assert resp.data["count"] == 1


def test_portal_user_cannot_create_global_rispacs_entry():
    """FIX 2.3: prima un utente portale, anche solo lettore, poteva creare/
    modificare/cancellare il registro RIS/PACS globale condiviso da tutti
    i clienti."""
    admin = _superuser()
    device_a = _make_device(admin, suffix="rispacswriteblocka")
    portal_user = _auslbo_user(
        device_a.customer,
        perms=["view_rispacs", "add_rispacs", "change_rispacs", "delete_rispacs"],
    )
    client = _auth_client(portal_user)

    resp = client.post(
        "/api/rispacs/", {"name": "PACS Malevolo", "ip": "10.90.0.99", "port": 104}, format="json",
    )
    assert resp.status_code == 403


def test_internal_user_with_permission_can_create_global_rispacs_entry():
    admin = _superuser()
    internal = _internal_user(perms=["view_rispacs", "add_rispacs", "change_rispacs", "delete_rispacs"])
    client = _auth_client(internal)

    resp = client.post(
        "/api/rispacs/", {"name": "PACS Nuovo", "ip": "10.90.0.11", "port": 104}, format="json",
    )
    assert resp.status_code == 201, resp.data


def test_internal_user_without_permission_cannot_delete_global_rispacs_entry():
    admin = _superuser()
    rispacs = Rispacs.objects.create(name="PACS Da Non Toccare", ip="10.90.0.12", port=104)
    internal = _internal_user(perms=["view_rispacs"])  # niente delete_rispacs
    client = _auth_client(internal)

    resp = client.delete(f"/api/rispacs/{rispacs.id}/")
    assert resp.status_code == 403


# ─── DeviceRispacsViewSet: scope tenant + permessi reali ─────────────────────

def test_portal_user_sees_only_own_customer_device_rispacs_links():
    admin = _superuser()
    device_a = _make_device(admin, suffix="devrispacsscopea")
    device_b = _make_device(admin, suffix="devrispacsscopeb")
    rispacs = Rispacs.objects.create(name="PACS Condiviso", ip="10.90.0.20", port=104)
    link_a = DeviceRispacs.objects.create(device=device_a, rispacs=rispacs)
    link_b = DeviceRispacs.objects.create(device=device_b, rispacs=rispacs)

    portal_a = _auslbo_user(device_a.customer, perms=["view_devicerispacs"])
    client = _auth_client(portal_a)

    resp = client.get("/api/device-rispacs/")
    assert resp.status_code == 200
    ids = {r["id"] for r in resp.data["results"]}
    assert link_a.id in ids
    assert link_b.id not in ids


def test_portal_user_cannot_link_rispacs_to_device_of_another_customer():
    admin = _superuser()
    device_b = _make_device(admin, suffix="devrispacswriteb")
    rispacs = Rispacs.objects.create(name="PACS Da Collegare", ip="10.90.0.21", port=104)

    other_customer_status = CustomerStatus.objects.get_or_create(
        key="rispacs_e2e_cs_othertenant", defaults={"label": "Active"},
    )[0]
    other_customer = Customer.objects.create(name="AltroTenant", status=other_customer_status)

    portal_user = _auslbo_user(
        other_customer,
        perms=["view_devicerispacs", "add_devicerispacs", "change_devicerispacs"],
    )
    client = _auth_client(portal_user)

    resp = client.post(
        "/api/device-rispacs/", {"device": device_b.id, "rispacs": rispacs.id}, format="json",
    )
    # device_b non è nel queryset scopato dell'utente portale -> 400
    # (PrimaryKeyRelatedField non lo trova) oppure rifiuto esplicito dal
    # tenant enforcement, a seconda di dove il queryset filtra prima.
    assert resp.status_code == 400
