from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import CustomerStatus, InventoryStatus, InventoryType, SiteStatus
from crm.models import Customer, Site
from custom_fields.models import CustomFieldDefinition
from inventory.models import Inventory

pytestmark = pytest.mark.django_db


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _user():
    User = get_user_model()
    return User.objects.create_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw")


def test_customer_restore_allowed_with_change_permission_only():
    owner = _user()
    actor = _user()
    actor.user_permissions.add(Permission.objects.get(codename="change_customer"))
    status_obj = CustomerStatus.objects.get_or_create(key="mix_active", defaults={"label": "Active"})[0]
    customer = Customer.objects.create(
        name="ACME", status=status_obj, created_by=owner, updated_by=owner, deleted_at=timezone.now()
    )

    r = _client(actor).post(f"/api/customers/{customer.id}/restore/")
    assert r.status_code == 204
    customer.refresh_from_db()
    assert customer.deleted_at is None
    assert customer.updated_by_id == actor.id


def test_inventory_bulk_restore_updates_updated_by_and_count():
    owner = _user()
    actor = _user()
    actor.user_permissions.add(Permission.objects.get(codename="change_inventory"))

    cs = CustomerStatus.objects.get_or_create(key="mix_cust", defaults={"label": "Active"})[0]
    ss = SiteStatus.objects.get_or_create(key="mix_site", defaults={"label": "Active"})[0]
    ist = InventoryStatus.objects.get_or_create(key="mix_inv_status", defaults={"label": "Active"})[0]
    it = InventoryType.objects.get_or_create(key="mix_type", defaults={"label": "Server"})[0]

    customer = Customer.objects.create(name="ACME", status=cs, created_by=owner, updated_by=owner)
    site = Site.objects.create(customer=customer, name="HQ", status=ss, created_by=owner, updated_by=owner)
    inv = Inventory.objects.create(
        customer=customer, site=site, name="INV", status=ist, type=it,
        created_by=owner, updated_by=owner, deleted_at=timezone.now()
    )

    r = _client(actor).post("/api/inventory/bulk_restore/", {"ids": [inv.id]}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["count"] == 1
    inv.refresh_from_db()
    assert inv.deleted_at is None
    assert inv.updated_by_id == actor.id


def test_custom_field_bulk_restore_uses_generic_restore_permission():
    actor = _user()
    actor.user_permissions.add(Permission.objects.get(codename="change_customfielddefinition"))
    field = CustomFieldDefinition.objects.create(
        entity="customer", key=f"k_{uuid.uuid4().hex[:4]}", label="L", field_type="text", deleted_at=timezone.now()
    )

    r = _client(actor).post("/api/custom-fields/bulk_restore/", {"ids": [field.id]}, format="json")
    assert r.status_code == 200, r.data
    field.refresh_from_db()
    assert field.deleted_at is None
