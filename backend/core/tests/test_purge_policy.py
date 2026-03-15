from __future__ import annotations

import pytest
from django.utils import timezone

from crm.models import Customer, Site, Contact
from inventory.models import Inventory
from maintenance.models import MaintenancePlan, MaintenanceEvent, Tech, ScheduleType, IntervalUnit, MaintenanceResult


pytestmark = pytest.mark.django_db


def _trash(obj):
    obj.deleted_at = timezone.now()
    fields = ["deleted_at"]
    if hasattr(obj, "updated_by_id"):
        fields.append("updated_by")
    obj.save(update_fields=fields)
    return obj


def test_customer_purge_is_blocked_when_site_exists(api_client, superuser, customer_status, site_status):
    customer = Customer.objects.create(name="Acme", status=customer_status, created_by=superuser, updated_by=superuser)
    Site.objects.create(customer=customer, name="HQ", status=site_status, created_by=superuser, updated_by=superuser)
    _trash(customer)

    api_client.force_authenticate(user=superuser)
    res = api_client.post(f"/api/customers/{customer.id}/purge/")

    assert res.status_code == 409, res.data
    assert "dipendenze" in str(res.data["detail"]).lower()
    assert any(item["label"] == "siti" for item in res.data["blocked"])
    assert Customer.objects.filter(id=customer.id).exists()


def test_contact_bulk_purge_physically_deletes_rows(api_client, superuser, customer_status):
    customer = Customer.objects.create(name="Acme", status=customer_status, created_by=superuser, updated_by=superuser)
    contact = Contact.objects.create(customer=customer, name="Mario", created_by=superuser, updated_by=superuser)
    _trash(contact)

    api_client.force_authenticate(user=superuser)
    res = api_client.post("/api/contacts/bulk_purge/", {"ids": [contact.id]}, format="json")

    assert res.status_code == 200, res.data
    assert res.data["purged"] == [contact.id]
    assert res.data["count"] == 1
    assert not Contact.objects.filter(id=contact.id).exists()


def test_inventory_bulk_purge_is_blocked_when_maintenance_exists(api_client, superuser, customer_status, site_status, inventory_status, inventory_type):
    customer = Customer.objects.create(name="Acme", status=customer_status, created_by=superuser, updated_by=superuser)
    site = Site.objects.create(customer=customer, name="HQ", status=site_status, created_by=superuser, updated_by=superuser)
    inventory = Inventory.objects.create(customer=customer, site=site, name="Srv-1", status=inventory_status, type=inventory_type, created_by=superuser, updated_by=superuser)
    plan = MaintenancePlan.objects.create(
        title="Piano 1",
        customer=customer,
        schedule_type=ScheduleType.INTERVAL,
        interval_unit=IntervalUnit.MONTHS,
        interval_value=1,
        next_due_date="2026-04-01",
    )
    plan.inventory_types.set([inventory_type])
    tech = Tech.objects.create(first_name="Mario", last_name="Rossi", email="mario@example.com")
    MaintenanceEvent.objects.create(
        plan=plan,
        inventory=inventory,
        tech=tech,
        performed_at="2026-03-01",
        result=MaintenanceResult.OK,
    )
    _trash(inventory)

    api_client.force_authenticate(user=superuser)
    res = api_client.post("/api/inventories/bulk_purge/", {"ids": [inventory.id]}, format="json")

    assert res.status_code == 200, res.data
    assert res.data["purged"] == []
    assert res.data["blocked_count"] == 1
    assert res.data["blocked"][0]["id"] == inventory.id
    assert Inventory.objects.filter(id=inventory.id).exists()


def test_maintenance_plan_purge_is_blocked_when_events_exist(api_client, superuser, customer_status, site_status, inventory_status, inventory_type):
    customer = Customer.objects.create(name="Acme", status=customer_status, created_by=superuser, updated_by=superuser)
    site = Site.objects.create(customer=customer, name="HQ", status=site_status, created_by=superuser, updated_by=superuser)
    inventory = Inventory.objects.create(customer=customer, site=site, name="Srv-1", status=inventory_status, type=inventory_type, created_by=superuser, updated_by=superuser)
    plan = MaintenancePlan.objects.create(
        title="Piano 1",
        customer=customer,
        schedule_type=ScheduleType.INTERVAL,
        interval_unit=IntervalUnit.MONTHS,
        interval_value=1,
        next_due_date="2026-04-01",
    )
    plan.inventory_types.set([inventory_type])
    tech = Tech.objects.create(first_name="Mario", last_name="Rossi", email="mario@example.com")
    MaintenanceEvent.objects.create(
        plan=plan,
        inventory=inventory,
        tech=tech,
        performed_at="2026-03-01",
        result=MaintenanceResult.OK,
    )
    _trash(plan)

    api_client.force_authenticate(user=superuser)
    res = api_client.post(f"/api/maintenance-plans/{plan.id}/purge/")

    assert res.status_code == 409, res.data
    assert any(item["label"] == "rapportini manutenzione" for item in res.data["blocked"])
    assert MaintenancePlan.objects.filter(id=plan.id).exists()
