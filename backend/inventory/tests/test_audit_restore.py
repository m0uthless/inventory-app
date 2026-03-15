import pytest

from crm.models import Customer, Site
from inventory.models import Inventory


@pytest.fixture
def base_inventory_soft_deleted(
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
    # soft delete
    inv.deleted_at = inv.updated_at
    inv.save(update_fields=["deleted_at"])
    return inv


def test_inventory_restore_creates_audit_event(api_client, superuser, base_inventory_soft_deleted):
    """Ensure restore endpoint emits an audit event.

    We assert on delta-count rather than specific action fields to keep the test
    resilient if audit schema evolves (e.g. action naming).
    """
    from audit.models import AuditEvent

    before = AuditEvent.objects.count()

    api_client.force_authenticate(user=superuser)
    inv = base_inventory_soft_deleted
    res = api_client.post(f"/api/inventories/{inv.id}/restore/")

    assert res.status_code in (200, 204)

    after = AuditEvent.objects.count()
    assert after == before + 1

    inv.refresh_from_db()
    assert inv.deleted_at is None
