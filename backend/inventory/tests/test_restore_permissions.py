from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType
from crm.models import Customer, Site
from inventory.models import Inventory


pytestmark = pytest.mark.django_db


def _seed_defaults_once():
    # Ensure lookup tables exist with the correct schema/fields.
    # Safe to call multiple times.
    call_command("seed_defaults", verbosity=0)


def _mk_inventory() -> Inventory:
    _seed_defaults_once()

    cs = CustomerStatus.objects.filter(deleted_at__isnull=True).first()
    ss = SiteStatus.objects.filter(deleted_at__isnull=True).first()
    ist = InventoryStatus.objects.filter(deleted_at__isnull=True).first()
    it = InventoryType.objects.filter(deleted_at__isnull=True).first()

    assert cs and ss and ist and it, "seed_defaults did not create required lookup rows"

    cust = Customer.objects.create(name="ACME", status=cs)
    site = Site.objects.create(customer=cust, name="HQ", status=ss)

    inv = Inventory.objects.create(
        customer=cust,          # ✅ REQUIRED (DB NOT NULL)
        site=site,
        name="INV-1",
        status=ist,
        type=it,
        deleted_at=timezone.now(),
    )
    return inv


def _mk_user(*, is_superuser: bool = False):
    User = get_user_model()
    suffix = uuid.uuid4().hex[:8]
    username = ("u_admin_" if is_superuser else "u_viewer_") + suffix
    u = User.objects.create_user(username=username, password="pw123456")
    if is_superuser:
        u.is_staff = True
        u.is_superuser = True
        u.save(update_fields=["is_staff", "is_superuser"])
    return u


def _api_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def test_inventory_restore_requires_permission():
    inv = _mk_inventory()
    user = _mk_user(is_superuser=False)
    c = _api_client(user)

    url = reverse("inventory-restore", kwargs={"pk": inv.pk})
    r = c.post(url, format="json")
    assert r.status_code in (401, 403)


def test_inventory_restore_as_superuser_restores():
    inv = _mk_inventory()
    admin = _mk_user(is_superuser=True)
    c = _api_client(admin)

    url = reverse("inventory-restore", kwargs={"pk": inv.pk})
    r = c.post(url, format="json")
    assert r.status_code in (200, 204)

    inv.refresh_from_db()
    assert inv.deleted_at is None


def test_inventory_bulk_restore_requires_permission():
    inv = _mk_inventory()
    user = _mk_user(is_superuser=False)
    c = _api_client(user)

    url = reverse("inventory-bulk-restore")
    r = c.post(url, {"ids": [inv.pk]}, format="json")
    assert r.status_code in (401, 403)


def test_inventory_bulk_restore_as_superuser_restores():
    inv = _mk_inventory()
    admin = _mk_user(is_superuser=True)
    c = _api_client(admin)

    url = reverse("inventory-bulk-restore")

    # Try common payload shapes for bulk restore.
    for payload in ({"ids": [inv.pk]}, {"pks": [inv.pk]}, {"items": [inv.pk]}):
        r = c.post(url, payload, format="json")
        if r.status_code in (200, 204):
            break

    assert r.status_code in (200, 204)

    inv.refresh_from_db()
    assert inv.deleted_at is None
