"""Test delle API `/api/contracts/` e `/api/sellers/` (modulo Contratti, fase 1).

Copre permessi (view_contract, view_contract_value, esclusione Portal),
validazioni (date, device di altro cliente, notice_days), filtro per anno,
documento PDF, soft delete/restore e anagrafica venditori.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from contracts.models import Contract, ContractStatus, Seller
from core.models import CustomerStatus, SiteStatus
from crm.models import Customer, Site
from device.models import Device, DeviceStatus, DeviceType

pytestmark = pytest.mark.django_db

User = get_user_model()

ALL_CONTRACT_PERMS = ["view_contract", "add_contract", "change_contract", "delete_contract"]


# ─── Helper ──────────────────────────────────────────────────────────────────

def _internal_user(perms: list[str] | None = None):
    user = User.objects.create_user(username=f"contracts_int_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(Permission.objects.get(codename="access_archie"))
    if perms:
        user.user_permissions.add(*Permission.objects.filter(codename__in=perms))
    return user


def _portal_user(customer, perms: list[str] | None = None):
    from portal.models import PortalUserProfile

    user = User.objects.create_user(username=f"contracts_portal_{uuid.uuid4().hex[:6]}", password="pw")
    profile = PortalUserProfile.objects.create(user=user, customer=customer)
    profile.customers.add(customer)
    if perms:
        user.user_permissions.add(*Permission.objects.filter(codename__in=perms))
    return user


def _client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _customer(suffix="a"):
    status = CustomerStatus.objects.get_or_create(key="contracts_api_cs", defaults={"label": "Active"})[0]
    return Customer.objects.create(name=f"ContrattiAPI_{suffix}", status=status)


def _device(customer, suffix="a"):
    site_status = SiteStatus.objects.get_or_create(key="contracts_api_ss", defaults={"label": "Active"})[0]
    device_status = DeviceStatus.objects.get_or_create(name="Attivo_contracts_api")[0]
    device_type = DeviceType.objects.get_or_create(name="Modalita_contracts_api")[0]
    site = Site.objects.create(customer=customer, name=f"HQ_{suffix}", status=site_status)
    return Device.objects.create(
        customer=customer, site=site, type=device_type, status=device_status,
        model="CT 64", serial_number=f"SN-{suffix}-{uuid.uuid4().hex[:6]}",
    )


def _contract(customer, **kw):
    data = dict(
        customer=customer, code=f"C-{uuid.uuid4().hex[:6]}", title="Contratto",
        status=ContractStatus.ATTIVO, start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        total_value="1000.00",
    )
    data.update(kw)
    return Contract.objects.create(**data)


def _payload(customer, **kw):
    data = {
        "code": f"C-{uuid.uuid4().hex[:6]}",
        "title": "Assistenza annuale",
        "customer": customer.id,
        "contract_type": "assistenza",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "attivo",
    }
    data.update(kw)
    return data


# ─── Permessi ────────────────────────────────────────────────────────────────

def test_list_requires_view_contract():
    assert _client(_internal_user()).get("/api/contracts/").status_code == 403
    assert _client(_internal_user(["view_contract"])).get("/api/contracts/").status_code == 200


def test_portal_user_forbidden():
    customer = _customer("portal")
    user = _portal_user(customer, ["view_contract", "view_seller"])
    client = _client(user)
    session = client.session
    session["ambito"] = "portal"
    session.save()
    client.cookies["sessionid"] = session.session_key

    assert client.get("/api/contracts/").status_code == 403
    assert client.get("/api/sellers/").status_code == 403


# ─── Creazione e validazioni ─────────────────────────────────────────────────

def test_create_contract_without_devices():
    customer = _customer()
    client = _client(_internal_user(ALL_CONTRACT_PERMS))

    resp = client.post("/api/contracts/", _payload(customer), format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["devices"] == []

    resp = client.post("/api/contracts/", _payload(customer, devices=[]), format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["devices"] == []


def test_create_contract_with_devices():
    customer = _customer()
    d1 = _device(customer, "d1")
    client = _client(_internal_user(ALL_CONTRACT_PERMS))

    resp = client.post("/api/contracts/", _payload(customer, devices=[d1.id]), format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["devices"] == [d1.id]
    assert resp.data["devices_detail"][0]["id"] == d1.id
    assert resp.data["devices_detail"][0]["serial_number"] == d1.serial_number


def test_device_of_other_customer_rejected():
    customer = _customer("mine")
    other = _customer("other")
    foreign = _device(other, "foreign")
    client = _client(_internal_user(ALL_CONTRACT_PERMS))

    resp = client.post("/api/contracts/", _payload(customer, devices=[foreign.id]), format="json")
    assert resp.status_code == 400
    assert "devices" in resp.data
    assert not Contract.objects.exists()


def test_end_before_start_rejected():
    customer = _customer()
    client = _client(_internal_user(ALL_CONTRACT_PERMS))

    resp = client.post(
        "/api/contracts/", _payload(customer, start_date="2026-06-01", end_date="2026-05-31"), format="json",
    )
    assert resp.status_code == 400
    assert "end_date" in resp.data


def test_notice_days_capped():
    customer = _customer()
    client = _client(_internal_user(ALL_CONTRACT_PERMS))

    resp = client.post("/api/contracts/", _payload(customer, notice_days=3651), format="json")
    assert resp.status_code == 400
    assert "notice_days" in resp.data


# ─── Valore economico ────────────────────────────────────────────────────────

def test_total_value_hidden_without_perm():
    customer = _customer()
    c = _contract(customer)

    client = _client(_internal_user(["view_contract"]))
    item = client.get("/api/contracts/").data["results"][0]
    assert "total_value" not in item
    assert "total_value" not in client.get(f"/api/contracts/{c.id}/").data

    client = _client(_internal_user(["view_contract", "view_contract_value"]))
    assert client.get(f"/api/contracts/{c.id}/").data["total_value"] == "1000.00"


def test_total_value_not_writable_without_perm():
    customer = _customer()
    c = _contract(customer)
    client = _client(_internal_user(["view_contract", "change_contract"]))

    resp = client.patch(f"/api/contracts/{c.id}/", {"total_value": "999.00"}, format="json")
    assert resp.status_code == 200, resp.data
    c.refresh_from_db()
    assert str(c.total_value) == "1000.00"


# ─── Campi calcolati e filtri ────────────────────────────────────────────────

def test_expiry_state_and_notice_deadline_in_payload():
    customer = _customer()
    today = timezone.localdate()
    end = today + timedelta(days=60)
    c = _contract(customer, start_date=today - timedelta(days=300), end_date=end, notice_days=90)

    data = _client(_internal_user(["view_contract"])).get(f"/api/contracts/{c.id}/").data
    assert data["notice_deadline"] == (end - timedelta(days=90)).isoformat()
    assert data["expiry_state"] == "notice"
    assert data["status_label"] == "Attivo"


def test_year_filter():
    customer = _customer()
    inside = _contract(customer, start_date=date(2025, 1, 1), end_date=date(2027, 12, 31))
    outside = _contract(customer, start_date=date(2023, 1, 1), end_date=date(2024, 12, 31))

    resp = _client(_internal_user(["view_contract"])).get("/api/contracts/?year=2026")
    assert resp.status_code == 200
    ids = {row["id"] for row in resp.data["results"]}
    assert inside.id in ids
    assert outside.id not in ids


# ─── Documento PDF ───────────────────────────────────────────────────────────

def test_document_upload_download_delete(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    customer = _customer()
    c = _contract(customer)
    client = _client(_internal_user(ALL_CONTRACT_PERMS))
    url = f"/api/contracts/{c.id}/document/"

    pdf = SimpleUploadedFile("contratto.pdf", b"%PDF-1.4 minimal test content", content_type="application/pdf")
    resp = client.post(url, {"file": pdf}, format="multipart")
    assert resp.status_code == 201, resp.data
    assert resp.data["document_filename"] == "contratto.pdf"
    assert resp.data["document_url"].endswith(url)

    resp = client.get(url)
    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/pdf"
    assert "contratto.pdf" in resp["Content-Disposition"]

    resp = client.delete(url)
    assert resp.status_code == 204
    c.refresh_from_db()
    assert not c.document
    assert c.document_original_filename == ""


# ─── Soft delete / restore ───────────────────────────────────────────────────

def test_soft_delete_and_restore():
    customer = _customer()
    c = _contract(customer)
    client = _client(_internal_user(ALL_CONTRACT_PERMS))

    assert client.delete(f"/api/contracts/{c.id}/").status_code == 204
    c.refresh_from_db()
    assert c.deleted_at is not None

    assert client.post(f"/api/contracts/{c.id}/restore/").status_code in (200, 204)
    c.refresh_from_db()
    assert c.deleted_at is None


# ─── Venditori ───────────────────────────────────────────────────────────────

def test_sellers_crud_and_user_link():
    linked = User.objects.create_user(username=f"venditore_{uuid.uuid4().hex[:6]}", password="pw")
    client = _client(_internal_user(["view_seller", "add_seller", "change_seller", "delete_seller"]))

    resp = client.post(
        "/api/sellers/", {"name": "Mario Rossi", "email": "mario@example.com", "user": linked.id}, format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["user_username"] == linked.username
    seller_id = resp.data["id"]

    resp = client.patch(f"/api/sellers/{seller_id}/", {"phone": "0511234567"}, format="json")
    assert resp.status_code == 200
    assert resp.data["phone"] == "0511234567"

    resp = client.get("/api/sellers/?search=Mario")
    assert [row["id"] for row in resp.data["results"]] == [seller_id]

    assert client.delete(f"/api/sellers/{seller_id}/").status_code == 204
    assert Seller.objects.get(pk=seller_id).deleted_at is not None
