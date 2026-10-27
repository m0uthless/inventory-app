"""Regressione: i Device sono gestibili anche dal frontend Archie (solo campi
base) e restano ereditati dal Portal tramite lo scope per `customer` di
DeviceViewSet. Nessun codice nuovo: questi test fissano il comportamento.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from core.models import CustomerStatus, SiteStatus
from crm.models import Customer, Site
from device.models import Device, DeviceStatus, DeviceType

pytestmark = pytest.mark.django_db

User = get_user_model()


def _internal_user(*, perms=None):
    user = User.objects.create_user(username=f"archie_dev_int_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(Permission.objects.get(codename="access_archie"))
    if perms:
        user.user_permissions.add(*Permission.objects.filter(codename__in=perms))
    return user


def _portal_user(customer, *, perms=None):
    from portal.models import PortalUserProfile

    user = User.objects.create_user(username=f"archie_dev_portal_{uuid.uuid4().hex[:6]}", password="pw")
    profile = PortalUserProfile.objects.create(user=user, customer=customer)
    profile.customers.add(customer)
    if perms:
        user.user_permissions.add(*Permission.objects.filter(codename__in=perms))
    return user


def _client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _setup(suffix):
    cs = CustomerStatus.objects.get_or_create(key=f"archie_dev_cs_{suffix}", defaults={"label": "Active"})[0]
    ss = SiteStatus.objects.get_or_create(key=f"archie_dev_ss_{suffix}", defaults={"label": "Active"})[0]
    dstatus = DeviceStatus.objects.get_or_create(name=f"Attivo_archie_dev_{suffix}")[0]
    dtype = DeviceType.objects.get_or_create(name=f"Tipo_archie_dev_{suffix}")[0]
    customer = Customer.objects.create(name=f"ArchieDev_{suffix}", status=cs)
    site = Site.objects.create(customer=customer, name="HQ", status=ss)
    return customer, site, dtype, dstatus


def test_internal_user_creates_device_with_base_fields_only():
    customer, site, dtype, dstatus = _setup("create")
    user = _internal_user(perms=["view_device", "add_device"])
    resp = _client(user).post("/api/devices/", {
        "customer": customer.id, "site": site.id, "type": dtype.id, "status": dstatus.id,
        "model": "M1", "serial_number": "SN-1", "inventario": "INV-1", "note": "nota",
    }, format="json")
    assert resp.status_code == 201, resp.data
    dev = Device.objects.get(pk=resp.data["id"])
    assert dev.customer_id == customer.id
    assert dev.serial_number == "SN-1"
    assert dev.ip is None
    assert dev.wifi is False


def test_device_created_from_archie_visible_to_portal_of_same_customer():
    customer, site, dtype, dstatus = _setup("vis")
    other, _, _, _ = _setup("vis_other")
    staff = _internal_user(perms=["view_device", "add_device"])
    resp = _client(staff).post("/api/devices/", {
        "customer": customer.id, "site": site.id, "type": dtype.id, "status": dstatus.id,
        "serial_number": "SN-1",
    }, format="json")
    assert resp.status_code == 201, resp.data

    own = _client(_portal_user(customer, perms=["view_device"])).get("/api/devices/")
    assert own.status_code == 200
    assert "SN-1" in {d["serial_number"] for d in own.data["results"]}

    foreign = _client(_portal_user(other, perms=["view_device"])).get("/api/devices/")
    assert foreign.status_code == 200
    assert "SN-1" not in {d["serial_number"] for d in foreign.data["results"]}


def test_patch_base_fields_preserves_portal_fields():
    customer, site, dtype, dstatus = _setup("patch")
    user = _internal_user(perms=["view_device", "change_device"])
    dev = Device.objects.create(
        customer=customer, site=site, type=dtype, status=dstatus,
        model="X1", ip="10.0.0.5", wifi=True, reparto="RX",
    )
    resp = _client(user).patch(f"/api/devices/{dev.id}/", {"model": "X2"}, format="json")
    assert resp.status_code == 200, resp.data
    dev.refresh_from_db()
    assert dev.model == "X2"
    assert dev.ip == "10.0.0.5"
    assert dev.wifi is True
    assert dev.reparto == "RX"
