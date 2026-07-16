"""Test per l'API di VlanViewSet: CRUD, permessi (lettura libera, scrittura
riservata a IsAuslBoEditor), e le action ip-pool / exclude-ip / unexclude-ip.
"""
import pytest

from device.models import Device, DeviceStatus, DeviceType
from core.models import InventoryStatus, InventoryType
from inventory.models import Inventory
from vlan.models import Vlan, VlanExcludedIp
from vlan.tests.conftest import make_customer, make_internal_user, make_site

pytestmark = pytest.mark.django_db


def _vlan_payload(customer, site, **overrides):
    payload = dict(
        customer=customer.id, site=site.id, vlan_id=600, name="VLAN API",
        network="10.10.0.0/29", subnet="255.255.255.248", gateway="10.10.0.1",
    )
    payload.update(overrides)
    return payload


def _make_vlan_direct(customer, site, **overrides):
    defaults = dict(
        customer=customer, site=site, vlan_id=601, name="VLAN diretta",
        network="10.11.0.0/29", subnet="255.255.255.248", gateway="10.11.0.1",
    )
    defaults.update(overrides)
    return Vlan.objects.create(**defaults)


def _make_inventory(user, customer, site, *, local_ip=None, suffix="a"):
    inv_status, _ = InventoryStatus.objects.get_or_create(
        key=f"active_vlan_api_{suffix}", defaults={"label": "Active"},
    )
    inv_type, _ = InventoryType.objects.get_or_create(
        key=f"server_vlan_api_{suffix}", defaults={"label": "Server"},
    )
    return Inventory.objects.create(
        customer=customer, site=site, name=f"Inv_{suffix}",
        type=inv_type, status=inv_status, local_ip=local_ip,
        created_by=user, updated_by=user,
    )


def _make_device(customer, site, *, ip=None, suffix="a"):
    device_status, _ = DeviceStatus.objects.get_or_create(name=f"Attivo_{suffix}")
    device_type, _ = DeviceType.objects.get_or_create(name=f"Modality_{suffix}")
    return Device.objects.create(
        customer=customer, site=site, type=device_type, status=device_status, ip=ip,
    )


# ─── CRUD ────────────────────────────────────────────────────────────────────

def test_create_vlan_as_internal_user(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)

    resp = api_client.post("/api/vlans/", _vlan_payload(customer, site), format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["vlan_id"] == 600


def test_create_vlan_rejects_site_from_different_customer(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer_a = make_customer(superuser, customer_status, "a")
    customer_b = make_customer(superuser, customer_status, "b")
    site_b = make_site(superuser, customer_b, site_status, "b")

    resp = api_client.post("/api/vlans/", _vlan_payload(customer_a, site_b), format="json")
    assert resp.status_code == 400
    assert "site" in resp.data


def test_delete_vlan_is_a_hard_delete(api_client, superuser, customer_status, site_status):
    """VlanViewSet non usa SoftDeleteAuditMixin: pur avendo il campo
    deleted_at (ereditato da TimeStampedModel), il DELETE via API rimuove
    davvero la riga — non è recuperabile da nessuna action 'restore'."""
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan_direct(customer, site, vlan_id=602, network="10.12.0.0/29",
                              subnet="255.255.255.248", gateway="10.12.0.1")

    resp = api_client.delete(f"/api/vlans/{vlan.id}/")
    assert resp.status_code in (200, 204)
    assert not Vlan.objects.filter(pk=vlan.id).exists()


def test_read_allowed_without_edit_permission(api_client, customer_status, site_status):
    """La lettura è consentita a qualunque utente interno o AUSL BO, anche
    senza device.change_device (IsAuslBoEditor lascia passare i SAFE_METHODS)."""
    internal_user = make_internal_user(can_edit=False)
    api_client.force_authenticate(user=internal_user)

    resp = api_client.get("/api/vlans/")
    assert resp.status_code == 200


def test_write_requires_editor_permission(api_client, customer_status, site_status):
    internal_user = make_internal_user(can_edit=False)
    api_client.force_authenticate(user=internal_user)
    customer = make_customer(internal_user, customer_status)
    site = make_site(internal_user, customer, site_status)

    resp = api_client.post("/api/vlans/", _vlan_payload(customer, site), format="json")
    assert resp.status_code == 403


def test_anonymous_cannot_access_vlans(api_client):
    resp = api_client.get("/api/vlans/")
    assert resp.status_code in (401, 403)


# ─── ip-pool ────────────────────────────────────────────────────────────────

def test_ip_pool_marks_network_broadcast_and_gateway(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan_direct(customer, site, vlan_id=610, network="10.20.0.0/29",
                              subnet="255.255.255.248", gateway="10.20.0.1")

    resp = api_client.get(f"/api/vlans/{vlan.id}/ip-pool/")
    assert resp.status_code == 200
    entries = {e["ip"]: e for e in resp.data}

    assert entries["10.20.0.0"]["kind"] == "network"
    assert entries["10.20.0.7"]["kind"] == "broadcast"
    assert entries["10.20.0.1"]["kind"] == "gateway"
    assert entries["10.20.0.1"]["used_by"] == "Gateway"


def test_ip_pool_reports_used_ip_from_inventory_and_device(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan_direct(customer, site, vlan_id=611, network="10.21.0.0/29",
                              subnet="255.255.255.248", gateway="10.21.0.1")
    _make_inventory(superuser, customer, site, local_ip="10.21.0.2", suffix="ippool1")
    _make_device(customer, site, ip="10.21.0.3", suffix="ippool1")

    resp = api_client.get(f"/api/vlans/{vlan.id}/ip-pool/")
    entries = {e["ip"]: e for e in resp.data}

    assert entries["10.21.0.2"]["status"] == "used"
    assert entries["10.21.0.2"]["used_by_type"] == "inventory"
    assert entries["10.21.0.3"]["status"] == "used"
    assert entries["10.21.0.3"]["used_by_type"] == "device"
    # Un host libero della stessa subnet resta 'free'.
    assert entries["10.21.0.4"]["status"] == "free"


def test_ip_pool_reports_reserved_from_pending_request(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan_direct(customer, site, vlan_id=612, network="10.22.0.0/29",
                              subnet="255.255.255.248", gateway="10.22.0.1")

    api_client.post(
        "/api/vlan-ip-requests/",
        {"customer": customer.id, "vlan": vlan.id, "ip": "10.22.0.2", "modalita": "pacs"},
        format="json",
    )

    resp = api_client.get(f"/api/vlans/{vlan.id}/ip-pool/")
    entries = {e["ip"]: e for e in resp.data}
    assert entries["10.22.0.2"]["status"] == "reserved"
    assert entries["10.22.0.2"]["used_by_type"] == "request"


def test_ip_pool_reports_manually_excluded(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan_direct(customer, site, vlan_id=613, network="10.23.0.0/29",
                              subnet="255.255.255.248", gateway="10.23.0.1")
    VlanExcludedIp.objects.create(vlan=vlan, ip="10.23.0.2", excluded_by=superuser)

    resp = api_client.get(f"/api/vlans/{vlan.id}/ip-pool/")
    entries = {e["ip"]: e for e in resp.data}
    assert entries["10.23.0.2"]["status"] == "excluded"
    assert entries["10.23.0.2"]["excluded"] is True


# ─── exclude-ip / unexclude-ip ────────────────────────────────────────────

def test_exclude_ip_creates_excluded_record(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan_direct(customer, site, vlan_id=620, network="10.24.0.0/29",
                              subnet="255.255.255.248", gateway="10.24.0.1")

    resp = api_client.post(f"/api/vlans/{vlan.id}/exclude-ip/", {"ip": "10.24.0.2", "note": "guasto"}, format="json")
    assert resp.status_code == 200
    assert VlanExcludedIp.objects.filter(vlan=vlan, ip="10.24.0.2", note="guasto").exists()


def test_exclude_ip_rejects_ip_outside_vlan(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan_direct(customer, site, vlan_id=621, network="10.25.0.0/29",
                              subnet="255.255.255.248", gateway="10.25.0.1")

    resp = api_client.post(f"/api/vlans/{vlan.id}/exclude-ip/", {"ip": "192.168.1.1"}, format="json")
    assert resp.status_code == 400


def test_unexclude_ip_removes_excluded_record(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan_direct(customer, site, vlan_id=622, network="10.26.0.0/29",
                              subnet="255.255.255.248", gateway="10.26.0.1")
    VlanExcludedIp.objects.create(vlan=vlan, ip="10.26.0.2")

    resp = api_client.post(f"/api/vlans/{vlan.id}/unexclude-ip/", {"ip": "10.26.0.2"}, format="json")
    assert resp.status_code == 200
    assert not VlanExcludedIp.objects.filter(vlan=vlan, ip="10.26.0.2").exists()


def test_unexclude_ip_not_found_returns_404(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan_direct(customer, site, vlan_id=623, network="10.27.0.0/29",
                              subnet="255.255.255.248", gateway="10.27.0.1")

    resp = api_client.post(f"/api/vlans/{vlan.id}/unexclude-ip/", {"ip": "10.27.0.2"}, format="json")
    assert resp.status_code == 404
