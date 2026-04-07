from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType
from crm.models import Customer, Site
from inventory.models import Inventory
from maintenance.models import MaintenancePlan, MaintenanceEvent, ScheduleType, IntervalUnit, Tech

pytestmark = pytest.mark.django_db


def _superuser():
    User = get_user_model()
    return User.objects.create_superuser(
        username=f"maint_media_{uuid.uuid4().hex[:6]}",
        email="a@example.com",
        password="pw",
    )


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _statuses():
    customer_status = CustomerStatus.objects.get_or_create(key="maint_media_cs", defaults={"label": "Active"})[0]
    site_status = SiteStatus.objects.get_or_create(key="maint_media_ss", defaults={"label": "Active"})[0]
    inventory_status = InventoryStatus.objects.get_or_create(key="maint_media_is", defaults={"label": "Active"})[0]
    inventory_type = InventoryType.objects.get_or_create(key="maint_media_it", defaults={"label": "Server"})[0]
    return customer_status, site_status, inventory_status, inventory_type


def test_maintenance_pdf_uses_protected_api_url_and_x_accel_redirect():
    customer_status, site_status, inventory_status, inventory_type = _statuses()
    user = _superuser()
    client = _auth_client(user)

    customer = Customer.objects.create(name="MaintMedia", status=customer_status)
    site = Site.objects.create(customer=customer, name="HQ", status=site_status)
    inventory = Inventory.objects.create(
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
    event = MaintenanceEvent.objects.create(
        plan=plan,
        inventory=inventory,
        tech=tech,
        created_by=user,
        performed_at="2026-02-20",
        result="ok",
        pdf_file=SimpleUploadedFile('rapportino.pdf', b'%PDF-1.4 fake', content_type='application/pdf'),
    )

    detail = client.get(f'/api/maintenance-events/{event.id}/')
    assert detail.status_code == 200, detail.data
    assert detail.data['pdf_url'].endswith(f'/api/maintenance-events/{event.id}/pdf/')
    assert '/api/media/maintenance_events/' not in detail.data['pdf_url']

    preview = client.get(f'/api/maintenance-events/{event.id}/pdf/')
    assert preview.status_code == 200
    assert preview['X-Accel-Redirect'].startswith('/protected_media/maintenance_events/')
    assert preview['Content-Disposition'].startswith('inline;')
