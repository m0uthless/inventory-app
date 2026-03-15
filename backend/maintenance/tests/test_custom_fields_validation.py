import pytest

from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType
from crm.models import Customer, Site
from inventory.models import Inventory
from custom_fields.models import CustomFieldDefinition


@pytest.mark.django_db
def test_maintenance_plan_custom_fields_invalid_type_returns_400(api_client, superuser):
    CustomFieldDefinition.objects.create(
        entity=CustomFieldDefinition.Entity.MAINTENANCE_PLAN,
        key="visit_count",
        label="Numero visite",
        field_type=CustomFieldDefinition.FieldType.NUMBER,
        required=False,
    )

    customer_status = CustomerStatus.objects.create(key="active", label="Attivo")
    site_status = SiteStatus.objects.create(key="active", label="Attivo")
    inventory_status = InventoryStatus.objects.create(key="active", label="Attivo")
    inventory_type = InventoryType.objects.create(key="server", label="Server")

    customer = Customer.objects.create(name="MaintCo", status=customer_status)
    site = Site.objects.create(customer=customer, name="HQ", status=site_status)
    Inventory.objects.create(
        customer=customer,
        site=site,
        name="Srv-1",
        status=inventory_status,
        type=inventory_type,
    )

    api_client.force_authenticate(user=superuser)
    payload = {
        "customer": customer.id,
        "inventory_types": [inventory_type.id],
        "title": "Piano trimestrale",
        "schedule_type": "interval",
        "interval_unit": "months",
        "interval_value": 3,
        "next_due_date": "2026-04-01",
        "custom_fields": {"visit_count": "NOT_A_NUMBER"},
    }
    resp = api_client.post("/api/maintenance-plans/", payload, format="json")
    assert resp.status_code == 400
    assert "custom_fields" in resp.data
    assert "visit_count" in resp.data["custom_fields"]


@pytest.mark.django_db
def test_maintenance_plan_custom_fields_alias_is_canonicalized(api_client, superuser):
    CustomFieldDefinition.objects.create(
        entity=CustomFieldDefinition.Entity.MAINTENANCE_PLAN,
        key="service_window",
        label="Finestra servizio",
        field_type=CustomFieldDefinition.FieldType.TEXT,
        required=False,
        aliases=["finestra servizio"],
    )

    customer_status = CustomerStatus.objects.create(key="active", label="Attivo")
    inventory_type = InventoryType.objects.create(key="server", label="Server")
    customer = Customer.objects.create(name="MaintCo", status=customer_status)

    api_client.force_authenticate(user=superuser)
    payload = {
        "customer": customer.id,
        "inventory_types": [inventory_type.id],
        "title": "Piano annuale",
        "schedule_type": "interval",
        "interval_unit": "years",
        "interval_value": 1,
        "next_due_date": "2026-12-31",
        "custom_fields": {"finestra servizio": "Weekend"},
    }
    resp = api_client.post("/api/maintenance-plans/", payload, format="json")
    assert resp.status_code == 201
    assert resp.data["custom_fields"] == {"service_window": "Weekend"}
