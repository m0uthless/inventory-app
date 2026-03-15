import pytest

from audit.models import AuditEvent
from crm.models import Customer, Site
from inventory.models import Inventory


@pytest.fixture
def base_inventory(
    db,
    superuser,
    customer_status,
    site_status,
    inventory_status,
    inventory_type,
):
    cust = Customer.objects.create(
        name="ACME",
        status=customer_status,
        created_by=superuser,
        updated_by=superuser,
    )

    site = Site.objects.create(
        customer=cust,
        name="HQ",
        status=site_status,
        created_by=superuser,
        updated_by=superuser,
    )

    inv = Inventory.objects.create(
        customer=cust,
        site=site,
        name="Device 1",
        status=inventory_status,
        type=inventory_type,
        created_by=superuser,
        updated_by=superuser,
    )

    return inv


def test_inventory_restore_endpoint_creates_audit_with_request_meta(api_client, superuser, base_inventory):
    inv = base_inventory

    # simulate soft delete
    inv.deleted_at = inv.updated_at
    inv.save(update_fields=["deleted_at"])

    api_client.force_authenticate(user=superuser)
    url = f"/api/inventories/{inv.id}/restore/"

    # add UA to ensure user_agent is captured
    res = api_client.post(url, HTTP_USER_AGENT="pytest")

    assert res.status_code in (200, 204)

    inv.refresh_from_db()
    assert inv.deleted_at is None

    # audit event should exist and have request metadata populated
    ev = (
        AuditEvent.objects.filter(action=AuditEvent.Action.RESTORE, object_id=str(inv.id))
        .order_by("-created_at")
        .first()
    )
    assert ev is not None

    assert ev.method == "POST"
    assert ev.path is not None and f"/api/inventories/{inv.id}/restore/" in ev.path
    assert ev.ip_address is not None
    assert ev.user_agent == "pytest"
