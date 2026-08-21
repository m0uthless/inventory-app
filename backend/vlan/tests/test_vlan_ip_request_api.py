"""Test per VlanIpRequestViewSet: creazione (richiedente/stato automatici),
validazioni (IP fuori subnet, customer mismatch), workflow approve/reject e
permessi (approve/reject riservati a IsAdminPortal).
"""
import pytest

from vlan.models import Vlan, VlanIpRequest
from vlan.tests.conftest import make_customer, make_internal_user, make_site

pytestmark = pytest.mark.django_db


def _make_vlan(customer, site, **overrides):
    defaults = dict(
        customer=customer, site=site, vlan_id=700, name="VLAN richieste",
        network="10.30.0.0/29", subnet="255.255.255.248", gateway="10.30.0.1",
    )
    defaults.update(overrides)
    return Vlan.objects.create(**defaults)


# ─── Creazione ───────────────────────────────────────────────────────────────

def test_create_request_sets_richiedente_and_pending_status(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(customer, site)

    resp = api_client.post(
        "/api/vlan-ip-requests/",
        {"customer": customer.id, "vlan": vlan.id, "ip": "10.30.0.2", "modalita": "pacs"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["stato"] == "pending"
    assert resp.data["richiedente"] == superuser.id


def test_create_request_ignores_client_supplied_stato(api_client, superuser, customer_status, site_status):
    """stato è read_only: anche se il client prova a impostarlo, resta 'pending'."""
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(customer, site, vlan_id=701, network="10.31.0.0/29",
                       subnet="255.255.255.248", gateway="10.31.0.1")

    resp = api_client.post(
        "/api/vlan-ip-requests/",
        {"customer": customer.id, "vlan": vlan.id, "ip": "10.31.0.2", "modalita": "pacs", "stato": "approved"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["stato"] == "pending"


def test_create_request_rejects_ip_outside_vlan(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(customer, site, vlan_id=702, network="10.32.0.0/29",
                       subnet="255.255.255.248", gateway="10.32.0.1")

    resp = api_client.post(
        "/api/vlan-ip-requests/",
        {"customer": customer.id, "vlan": vlan.id, "ip": "8.8.8.8", "modalita": "pacs"},
        format="json",
    )
    assert resp.status_code == 400
    assert "ip" in resp.data


def test_create_request_rejects_vlan_from_different_customer(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer_a = make_customer(superuser, customer_status, "reqa")
    customer_b = make_customer(superuser, customer_status, "reqb")
    site_a = make_site(superuser, customer_a, site_status, "reqa")
    vlan_a = _make_vlan(customer_a, site_a, vlan_id=703, network="10.33.0.0/29",
                         subnet="255.255.255.248", gateway="10.33.0.1")

    resp = api_client.post(
        "/api/vlan-ip-requests/",
        {"customer": customer_b.id, "vlan": vlan_a.id, "ip": "10.33.0.2", "modalita": "pacs"},
        format="json",
    )
    assert resp.status_code == 400
    assert "vlan" in resp.data


# ─── Approve / Reject ─────────────────────────────────────────────────────

def test_approve_pending_request(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(customer, site, vlan_id=704, network="10.34.0.0/29",
                       subnet="255.255.255.248", gateway="10.34.0.1")
    req = VlanIpRequest.objects.create(customer=customer, vlan=vlan, ip="10.34.0.2", modalita="pacs")

    resp = api_client.post(f"/api/vlan-ip-requests/{req.id}/approve/")
    assert resp.status_code == 200, resp.data
    assert resp.data["stato"] == "approved"
    assert resp.data["approvato_da"] == superuser.id

    req.refresh_from_db()
    assert req.stato == VlanIpRequest.Stato.APPROVED
    assert req.approvato_at is not None


def test_reject_pending_request_appends_motivo_to_note(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(customer, site, vlan_id=705, network="10.35.0.0/29",
                       subnet="255.255.255.248", gateway="10.35.0.1")
    req = VlanIpRequest.objects.create(customer=customer, vlan=vlan, ip="10.35.0.2", modalita="pacs")

    resp = api_client.post(f"/api/vlan-ip-requests/{req.id}/reject/", {"motivo": "IP già riservato altrove"}, format="json")
    assert resp.status_code == 200, resp.data
    assert resp.data["stato"] == "rejected"

    req.refresh_from_db()
    assert "Motivo rifiuto: IP già riservato altrove" in req.note


def test_approve_already_approved_request_returns_400(api_client, superuser, customer_status, site_status):
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(customer, site, vlan_id=706, network="10.36.0.0/29",
                       subnet="255.255.255.248", gateway="10.36.0.1")
    req = VlanIpRequest.objects.create(customer=customer, vlan=vlan, ip="10.36.0.2", modalita="pacs")

    api_client.post(f"/api/vlan-ip-requests/{req.id}/approve/")
    resp = api_client.post(f"/api/vlan-ip-requests/{req.id}/approve/")
    assert resp.status_code == 400


def test_approve_requires_admin_permission(api_client, customer_status, site_status):
    """Un utente interno che può leggere/scrivere le VLAN (device.change_device)
    ma non ha vlan.change_vlanIprequest non può approvare le richieste.

    0.9.1: make_internal_user(can_edit=True) concede ANCHE
    change_vlaniprequest (è in _FULL_CRUD_CODENAMES) — con can_edit=True
    puro questo test non testava più il caso negativo che dice di testare
    (mascherato finora dal crash FOR UPDATE sistemato separatamente, che
    faceva fallire la richiesta con un errore 500 prima ancora di
    arrivare al controllo permessi). Usiamo can_edit=False + extra_perms
    mirati: device/vlan in scrittura, MA non vlaniprequest.
    """
    internal_user = make_internal_user(can_edit=False, extra_perms=[
        "view_device", "add_device", "change_device", "delete_device",
        "view_vlan", "add_vlan", "change_vlan", "delete_vlan",
    ])
    api_client.force_authenticate(user=internal_user)
    customer = make_customer(internal_user, customer_status)
    site = make_site(internal_user, customer, site_status)
    vlan = _make_vlan(customer, site, vlan_id=707, network="10.37.0.0/29",
                       subnet="255.255.255.248", gateway="10.37.0.1")
    req = VlanIpRequest.objects.create(customer=customer, vlan=vlan, ip="10.37.0.2", modalita="pacs")

    resp = api_client.post(f"/api/vlan-ip-requests/{req.id}/approve/")
    assert resp.status_code == 403


def test_approve_allowed_with_explicit_vlan_permission(api_client, customer_status, site_status):
    """Dopo la fix del case-mismatch (vlan.change_vlaniprequest, minuscolo),
    un utente non-superuser con il permesso Django corretto può approvare."""
    from django.contrib.auth.models import Permission

    internal_user = make_internal_user(can_edit=True)
    internal_user.user_permissions.add(Permission.objects.get(codename="change_vlaniprequest"))
    api_client.force_authenticate(user=internal_user)
    customer = make_customer(internal_user, customer_status)
    site = make_site(internal_user, customer, site_status)
    vlan = _make_vlan(customer, site, vlan_id=708, network="10.38.0.0/29",
                       subnet="255.255.255.248", gateway="10.38.0.1")
    req = VlanIpRequest.objects.create(customer=customer, vlan=vlan, ip="10.38.0.2", modalita="pacs")

    resp = api_client.post(f"/api/vlan-ip-requests/{req.id}/approve/")
    assert resp.status_code == 200, resp.data


def test_approve_works_for_superuser(api_client, customer_status, site_status, superuser):
    """A causa del bug sopra, solo i superuser possono approvare/rifiutare
    richieste in pratica, indipendentemente dai permessi Django assegnati."""
    api_client.force_authenticate(user=superuser)
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(customer, site, vlan_id=709, network="10.39.0.0/29",
                       subnet="255.255.255.248", gateway="10.39.0.1")
    req = VlanIpRequest.objects.create(customer=customer, vlan=vlan, ip="10.39.0.2", modalita="pacs")

    resp = api_client.post(f"/api/vlan-ip-requests/{req.id}/approve/")
    assert resp.status_code == 200, resp.data
