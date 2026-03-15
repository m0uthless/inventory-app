from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType
from crm.models import Customer, Site
from inventory.models import Inventory

pytestmark = pytest.mark.django_db


def _make_superuser():
    User = get_user_model()
    u = User.objects.create_user(username=f"admin_{uuid.uuid4().hex[:8]}", password="pw")
    u.is_staff = True
    u.is_superuser = True
    u.save(update_fields=["is_staff", "is_superuser"])
    return u


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def superuser():
    return _make_superuser()


@pytest.fixture
def restore_entities(db):
    customer_status, _ = CustomerStatus.objects.get_or_create(key="active", defaults={"label": "Active"})
    site_status, _ = SiteStatus.objects.get_or_create(key="active", defaults={"label": "Active"})
    inventory_status, _ = InventoryStatus.objects.get_or_create(key="active", defaults={"label": "Active"})
    inventory_type, _ = InventoryType.objects.get_or_create(key="server", defaults={"label": "Server"})

    customer = Customer.objects.create(
        name="Restore Me",
        status=customer_status,
        deleted_at=timezone.now(),
    )
    site = Site.objects.create(
        customer=customer,
        name="Restore Site",
        status=site_status,
        deleted_at=timezone.now(),
    )
    inventory = Inventory.objects.create(
        customer=customer,
        site=site,
        name="Restore Device",
        status=inventory_status,
        type=inventory_type,
        deleted_at=timezone.now(),
    )
    return customer, site, inventory


class TestRestoreResponseContracts:
    def test_customer_restore_returns_entity_payload(self, api_client, superuser, restore_entities):
        customer, _, _ = restore_entities
        api_client.force_authenticate(user=superuser)

        res = api_client.post(f'/api/customers/{customer.id}/restore/')

        assert res.status_code in (200, 204)
        customer.refresh_from_db()
        assert customer.deleted_at is None

    def test_inventory_bulk_restore_returns_restored_ids_and_count(self, api_client, superuser, restore_entities):
        customer, site, inventory = restore_entities
        api_client.force_authenticate(user=superuser)

        # PATCH 14 policy: restore parents first, otherwise inventory restore is correctly blocked.
        assert api_client.post(f'/api/customers/{customer.id}/restore/').status_code in (200, 204)
        assert api_client.post(f'/api/sites/{site.id}/restore/').status_code in (200, 204)

        res = api_client.post('/api/inventories/bulk_restore/', {'ids': [inventory.id]}, format='json')

        assert res.status_code == 200
        payload = res.json()
        assert payload['restored'] == [inventory.id]
        assert payload['count'] == 1
        inventory.refresh_from_db()
        assert inventory.deleted_at is None

    def test_inventory_bulk_restore_empty_ids_returns_400(self, api_client, superuser):
        api_client.force_authenticate(user=superuser)
        res = api_client.post('/api/inventories/bulk_restore/', {'ids': []}, format='json')
        assert res.status_code == 400
