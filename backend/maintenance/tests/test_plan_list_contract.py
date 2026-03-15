from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType
from crm.models import Customer, Site
from inventory.models import Inventory
from maintenance.models import MaintenancePlan, MaintenanceEvent, Tech, ScheduleType, IntervalUnit

pytestmark = pytest.mark.django_db


def _superuser():
    User = get_user_model()
    import uuid
    return User.objects.create_superuser(
        username=f"admin_{uuid.uuid4().hex[:6]}",
        email="a@example.com",
        password="pw",
    )


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _statuses():
    customer_status = CustomerStatus.objects.get_or_create(key="maint_active_t", defaults={"label": "Active"})[0]
    site_status = SiteStatus.objects.get_or_create(key="maint_active_t", defaults={"label": "Active"})[0]
    inventory_status = InventoryStatus.objects.get_or_create(key="maint_active_t", defaults={"label": "Active"})[0]
    inventory_type = InventoryType.objects.get_or_create(key="server_t", defaults={"label": "Server"})[0]
    return customer_status, site_status, inventory_status, inventory_type


def test_maintenance_plan_list_keeps_contract_fields_with_annotations():
    customer_status, site_status, inventory_status, inventory_type = _statuses()
    user = _superuser()
    client = _auth_client(user)

    customer = Customer.objects.create(name="MaintCo", status=customer_status)
    site = Site.objects.create(customer=customer, name="HQ", status=site_status)
    Inventory.objects.create(
        customer=customer,
        site=site,
        name="Srv-1",
        status=inventory_status,
        type=inventory_type,
    )

    plan = MaintenancePlan.objects.create(
        title="Piano annuale",
        customer=customer,
        schedule_type=ScheduleType.INTERVAL,
        interval_unit=IntervalUnit.YEARS,
        interval_value=1,
        next_due_date="2027-01-01",
    )
    plan.inventory_types.set([inventory_type])

    tech = Tech.objects.create(first_name="Mario", last_name="Rossi", email="mario@example.com")
    MaintenanceEvent.objects.create(
        plan=plan,
        inventory=Inventory.objects.get(name="Srv-1"),
        tech=tech,
        performed_at="2026-02-20",
        result="ok",
    )

    res = client.get("/api/maintenance-plans/")
    assert res.status_code == 200
    rows = res.json().get("results", res.json())
    row = next(r for r in rows if r["id"] == plan.id)
    assert row["inventory_type_labels"] == ["Server"]
    assert row["covered_count"] == 1
    assert row["last_done_date"] == "2026-02-20"
