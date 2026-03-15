import pytest
from django.utils import timezone

from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType
from crm.models import Customer, Site, Contact
from inventory.models import Inventory
from maintenance.models import MaintenancePlan


@pytest.fixture
def active_lookups(db):
    customer_status, _ = CustomerStatus.objects.get_or_create(
        key="active", defaults={"label": "Active", "is_active": True, "sort_order": 1}
    )
    site_status, _ = SiteStatus.objects.get_or_create(
        key="active", defaults={"label": "Active", "is_active": True, "sort_order": 1}
    )
    inventory_status, _ = InventoryStatus.objects.get_or_create(
        key="active", defaults={"label": "Active", "is_active": True, "sort_order": 1}
    )
    inventory_type, _ = InventoryType.objects.get_or_create(
        key="server", defaults={"label": "Server", "is_active": True, "sort_order": 1}
    )
    return customer_status, site_status, inventory_status, inventory_type


class TestRestoreDependencyPolicy:
    def test_site_restore_is_blocked_if_customer_still_deleted(self, api_client, superuser, active_lookups):
        customer_status, site_status, _, _ = active_lookups
        customer = Customer.objects.create(name="Deleted Customer", status=customer_status, deleted_at=timezone.now())
        site = Site.objects.create(customer=customer, name="Deleted Site", status=site_status, deleted_at=timezone.now())

        api_client.force_authenticate(user=superuser)
        res = api_client.post(f"/api/sites/{site.id}/restore/")

        assert res.status_code == 409
        site.refresh_from_db()
        assert site.deleted_at is not None
        assert "cliente" in res.json()["detail"].lower()

    def test_contact_bulk_restore_reports_blocked_rows(self, api_client, superuser, active_lookups):
        customer_status, site_status, _, _ = active_lookups
        customer = Customer.objects.create(name="Deleted Customer", status=customer_status, deleted_at=timezone.now())
        site = Site.objects.create(customer=customer, name="Deleted Site", status=site_status, deleted_at=timezone.now())
        contact = Contact.objects.create(
            customer=customer,
            site=site,
            name="Mario Rossi",
            deleted_at=timezone.now(),
        )

        api_client.force_authenticate(user=superuser)
        res = api_client.post("/api/contacts/bulk_restore/", {"ids": [contact.id]}, format="json")

        assert res.status_code == 200
        body = res.json()
        assert body["count"] == 0
        assert body["blocked_count"] == 1
        assert body["blocked"][0]["id"] == contact.id
        contact.refresh_from_db()
        assert contact.deleted_at is not None

    def test_inventory_bulk_restore_only_restores_records_with_active_parents(self, api_client, superuser, active_lookups):
        customer_status, site_status, inventory_status, inventory_type = active_lookups
        customer_ok = Customer.objects.create(name="Customer OK", status=customer_status)
        site_ok = Site.objects.create(customer=customer_ok, name="HQ", status=site_status)
        inv_ok = Inventory.objects.create(
            customer=customer_ok,
            site=site_ok,
            name="Server OK",
            status=inventory_status,
            type=inventory_type,
            deleted_at=timezone.now(),
        )

        customer_deleted = Customer.objects.create(name="Customer Deleted", status=customer_status, deleted_at=timezone.now())
        site_deleted = Site.objects.create(customer=customer_deleted, name="Old HQ", status=site_status, deleted_at=timezone.now())
        inv_blocked = Inventory.objects.create(
            customer=customer_deleted,
            site=site_deleted,
            name="Server Blocked",
            status=inventory_status,
            type=inventory_type,
            deleted_at=timezone.now(),
        )

        api_client.force_authenticate(user=superuser)
        res = api_client.post(
            "/api/inventories/bulk_restore/",
            {"ids": [inv_ok.id, inv_blocked.id]},
            format="json",
        )

        assert res.status_code == 200
        body = res.json()
        assert body["count"] == 1
        assert inv_ok.id in body["restored"]
        assert body["blocked_count"] == 1
        assert body["blocked"][0]["id"] == inv_blocked.id
        inv_ok.refresh_from_db()
        inv_blocked.refresh_from_db()
        assert inv_ok.deleted_at is None
        assert inv_blocked.deleted_at is not None

    def test_maintenance_plan_restore_is_blocked_if_customer_deleted(self, api_client, superuser, active_lookups):
        customer_status, _, _, inventory_type = active_lookups
        customer = Customer.objects.create(name="Deleted Customer", status=customer_status, deleted_at=timezone.now())
        plan = MaintenancePlan.objects.create(
            customer=customer,
            title="Annual Check",
            schedule_type="interval",
            interval_unit="months",
            interval_value=12,
            next_due_date=timezone.localdate(),
            deleted_at=timezone.now(),
        )
        plan.inventory_types.add(inventory_type)

        api_client.force_authenticate(user=superuser)
        res = api_client.post(f"/api/maintenance-plans/{plan.id}/restore/")

        assert res.status_code == 409
        plan.refresh_from_db()
        assert plan.deleted_at is not None
        assert "cliente" in res.json()["detail"].lower()
