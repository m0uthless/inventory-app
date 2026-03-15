import pytest

from crm.models import Customer, Site
from inventory.models import Inventory


@pytest.mark.django_db
def test_inventory_list_includes_navigation_fields(
    api_client,
    superuser,
    customer_status,
    site_status,
    inventory_status,
    inventory_type,
):
    api_client.force_authenticate(user=superuser)

    customer = Customer.objects.create(name="Acme Corp", status=customer_status)
    site = Site.objects.create(
        customer=customer,
        name="Primary DC",
        display_name="Milano DC",
        status=site_status,
    )
    inventory = Inventory.objects.create(
        customer=customer,
        site=site,
        name="DB Server 01",
        hostname="db-01",
        knumber="K-100",
        serial_number="SN-100",
        status=inventory_status,
        type=inventory_type,
        os_pwd="top-secret",
    )

    res = api_client.get("/api/inventories/")

    assert res.status_code == 200
    payload = res.json()
    row = next(item for item in payload["results"] if item["id"] == inventory.id)
    assert row["customer"] == customer.id
    assert row["customer_name"] == customer.name
    assert row["site"] == site.id
    assert row["site_name"] == site.name
    assert row["site_display_name"] == site.display_name
    assert row["name"] == inventory.name
    assert "os_pwd" not in row
