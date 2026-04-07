from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from core.models import CustomerStatus, InventoryStatus, InventoryType
from crm.models import Customer
from inventory.models import Inventory
from maintenance.models import MaintenancePlan, MaintenanceEvent, Tech, ScheduleType, IntervalUnit

pytestmark = pytest.mark.django_db


def _superuser():
    User = get_user_model()
    import uuid
    return User.objects.create_superuser(
        username=f"maint_upload_{uuid.uuid4().hex[:6]}",
        email="a@example.com",
        password="pw",
    )


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _event(user):
    customer_status = CustomerStatus.objects.get_or_create(key="maint_upload_cs", defaults={"label": "Active"})[0]
    inventory_status = InventoryStatus.objects.get_or_create(key="maint_upload_is", defaults={"label": "Active"})[0]
    inventory_type = InventoryType.objects.get_or_create(key="maint_upload_it", defaults={"label": "Server"})[0]
    customer = Customer.objects.create(name="MaintUpload", status=customer_status)
    inventory = Inventory.objects.create(customer=customer, name="SrvUpload", status=inventory_status, type=inventory_type)
    tech = Tech.objects.create(first_name="Mario", last_name="Rossi", email="mario@example.com")
    plan = MaintenancePlan.objects.create(
        title="Piano upload",
        customer=customer,
        schedule_type=ScheduleType.INTERVAL,
        interval_unit=IntervalUnit.YEARS,
        interval_value=1,
        next_due_date="2027-01-01",
    )
    plan.inventory_types.set([inventory_type])
    return MaintenanceEvent.objects.create(
        plan=plan,
        inventory=inventory,
        tech=tech,
        created_by=user,
        performed_at="2026-03-01",
        result="ok",
    )


def test_upload_pdf_rejects_wrong_extension():
    user = _superuser()
    client = _auth_client(user)
    event = _event(user)

    res = client.post(
        f'/api/maintenance-events/{event.id}/upload-pdf/',
        {'pdf_file': SimpleUploadedFile('note.txt', b'not-a-pdf', content_type='text/plain')},
        format='multipart',
    )

    assert res.status_code == 400, res.data
    assert 'pdf_file' in res.data


def test_upload_pdf_accepts_valid_pdf():
    user = _superuser()
    client = _auth_client(user)
    event = _event(user)

    res = client.post(
        f'/api/maintenance-events/{event.id}/upload-pdf/',
        {'pdf_file': SimpleUploadedFile('rapportino.pdf', b'%PDF-1.4\n%valid\n', content_type='application/pdf')},
        format='multipart',
    )

    assert res.status_code == 200, res.data
