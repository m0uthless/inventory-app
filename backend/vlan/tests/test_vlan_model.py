"""Test a livello di modello per vlan/models.py: validatori IPv4, clean()
cross-customer, helper di calcolo pool, vincoli di unicità.
"""
import uuid

import pytest
from django.core.exceptions import ValidationError

from vlan.models import Vlan, VlanIpRequest, VlanExcludedIp
from vlan.tests.conftest import make_customer, make_site

pytestmark = pytest.mark.django_db


def _make_vlan(user, customer, site, *, vlan_id=100, network="10.241.0.64/26",
                subnet="255.255.255.192", gateway="10.241.0.65", **overrides):
    defaults = dict(
        customer=customer, site=site, vlan_id=vlan_id, name="VLAN test",
        network=network, subnet=subnet, gateway=gateway,
    )
    defaults.update(overrides)
    vlan = Vlan(**defaults)
    vlan.full_clean()
    vlan.save()
    return vlan


# ─── Validatori IPv4 ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("network", ["10.241.0.64/26", "192.168.1.0/24", "172.16.5.0/30"])
def test_valid_network_passes_validation(superuser, customer_status, site_status, network):
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(superuser, customer, site, network=network, gateway=network.split("/")[0])
    # gateway = network address stesso non è un host valido semanticamente ma
    # _validate_ip accetta qualunque IPv4: qui verifichiamo solo che il
    # network passi la validazione.
    assert vlan.pk is not None


def test_network_not_matching_network_address_is_rejected(superuser, customer_status, site_status):
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    with pytest.raises(ValidationError):
        _make_vlan(superuser, customer, site, network="10.241.0.70/26")  # non è l'indirizzo di rete


def test_network_garbage_string_is_rejected(superuser, customer_status, site_status):
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    with pytest.raises(ValidationError):
        _make_vlan(superuser, customer, site, network="not-an-ip")


def test_invalid_subnet_is_rejected(superuser, customer_status, site_status):
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    with pytest.raises(ValidationError):
        _make_vlan(superuser, customer, site, subnet="not-a-mask")


def test_invalid_gateway_is_rejected(superuser, customer_status, site_status):
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    with pytest.raises(ValidationError):
        _make_vlan(superuser, customer, site, gateway="999.999.999.999")


# ─── Vlan.clean() — coerenza site/customer ────────────────────────────────────

def test_vlan_clean_rejects_site_from_different_customer(superuser, customer_status, site_status):
    customer_a = make_customer(superuser, customer_status, "a")
    customer_b = make_customer(superuser, customer_status, "b")
    site_b = make_site(superuser, customer_b, site_status, "b")

    vlan = Vlan(
        customer=customer_a, site=site_b, vlan_id=200, name="X",
        network="10.0.0.0/29", subnet="255.255.255.248", gateway="10.0.0.1",
    )
    with pytest.raises(ValidationError):
        vlan.full_clean()


# ─── Helper di calcolo pool ────────────────────────────────────────────────

def test_get_network_obj_returns_none_for_invalid_network(superuser, customer_status, site_status):
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(superuser, customer, site, vlan_id=101)
    # Forza un network non parsabile bypassando la validazione (per testare
    # la robustezza dell'helper, non il flusso normale via full_clean()).
    vlan.network = "garbage"
    assert vlan.get_network_obj() is None
    assert vlan.iter_host_ips() == []


def test_iter_host_ips_excludes_network_and_broadcast(superuser, customer_status, site_status):
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    # /30 → 4 indirizzi totali, 2 host utilizzabili
    vlan = _make_vlan(
        superuser, customer, site, vlan_id=102,
        network="10.0.1.0/30", subnet="255.255.255.252", gateway="10.0.1.1",
    )
    hosts = vlan.iter_host_ips()
    assert hosts == ["10.0.1.1", "10.0.1.2"]


# ─── Vincolo unicità VLAN ID per customer (soft-delete aware) ─────────────────

def test_vlan_id_unique_per_customer_among_active(superuser, customer_status, site_status):
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    _make_vlan(superuser, customer, site, vlan_id=300, network="10.0.2.0/29",
               subnet="255.255.255.248", gateway="10.0.2.1")

    dup = Vlan(
        customer=customer, site=site, vlan_id=300, name="Duplicato",
        network="10.0.3.0/29", subnet="255.255.255.248", gateway="10.0.3.1",
    )
    from django.db import IntegrityError, transaction
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            dup.save()


# ─── VlanIpRequest.clean() ────────────────────────────────────────────────

def test_ip_request_rejects_ip_outside_vlan_network(superuser, customer_status, site_status):
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(superuser, customer, site, vlan_id=400, network="10.0.4.0/29",
                       subnet="255.255.255.248", gateway="10.0.4.1")

    req = VlanIpRequest(
        customer=customer, vlan=vlan, ip="192.168.99.99", modalita="pacs",
    )
    with pytest.raises(ValidationError):
        req.full_clean()


def test_ip_request_rejects_vlan_from_different_customer(superuser, customer_status, site_status):
    customer_a = make_customer(superuser, customer_status, "ra")
    customer_b = make_customer(superuser, customer_status, "rb")
    site_a = make_site(superuser, customer_a, site_status, "ra")
    vlan_a = _make_vlan(superuser, customer_a, site_a, vlan_id=401, network="10.0.5.0/29",
                         subnet="255.255.255.248", gateway="10.0.5.1")

    req = VlanIpRequest(customer=customer_b, vlan=vlan_a, ip="10.0.5.2", modalita="pacs")
    with pytest.raises(ValidationError):
        req.full_clean()


def test_ip_request_pending_unique_per_vlan_and_ip(superuser, customer_status, site_status):
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(superuser, customer, site, vlan_id=402, network="10.0.6.0/29",
                       subnet="255.255.255.248", gateway="10.0.6.1")

    VlanIpRequest.objects.create(customer=customer, vlan=vlan, ip="10.0.6.2", modalita="pacs")

    from django.db import IntegrityError, transaction
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            VlanIpRequest.objects.create(customer=customer, vlan=vlan, ip="10.0.6.2", modalita="worklist")


def test_ip_request_same_ip_reusable_once_previous_not_pending(superuser, customer_status, site_status):
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(superuser, customer, site, vlan_id=403, network="10.0.7.0/29",
                       subnet="255.255.255.248", gateway="10.0.7.1")

    first = VlanIpRequest.objects.create(customer=customer, vlan=vlan, ip="10.0.7.2", modalita="pacs")
    first.stato = VlanIpRequest.Stato.APPROVED
    first.save(update_fields=["stato"])

    # Il vincolo è condizionato a stato=pending: una volta approvata/rifiutata,
    # lo stesso IP può essere richiesto di nuovo.
    second = VlanIpRequest.objects.create(customer=customer, vlan=vlan, ip="10.0.7.2", modalita="worklist")
    assert second.pk is not None


# ─── VlanExcludedIp — vincolo unicità ──────────────────────────────────────

def test_excluded_ip_unique_per_vlan(superuser, customer_status, site_status):
    customer = make_customer(superuser, customer_status)
    site = make_site(superuser, customer, site_status)
    vlan = _make_vlan(superuser, customer, site, vlan_id=500, network="10.0.8.0/29",
                       subnet="255.255.255.248", gateway="10.0.8.1")

    VlanExcludedIp.objects.create(vlan=vlan, ip="10.0.8.3")

    from django.db import IntegrityError, transaction
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            VlanExcludedIp.objects.create(vlan=vlan, ip="10.0.8.3")
