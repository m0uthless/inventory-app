import pytest

from audit.models import AuditEvent
from audit.utils import log_event
from crm.models import Customer


@pytest.mark.django_db
def test_audit_detail_normalizes_changes_and_exposes_entity_path(api_client, superuser, customer_status):
    customer = Customer.objects.create(
        name="Acme",
        display_name="Acme Srl",
        status=customer_status,
        created_by=superuser,
        updated_by=superuser,
    )
    log_event(
        actor=superuser,
        action=AuditEvent.Action.UPDATE,
        instance=customer,
        changes={
            "name": {"before": "Acme", "after": "Acme Srl"},
            "notes": {"from": None, "to": "note"},
        },
        subject=str(customer),
    )
    ev = AuditEvent.objects.latest("id")

    api_client.force_authenticate(user=superuser)
    res = api_client.get(f"/api/audit-events/{ev.id}/")

    assert res.status_code == 200
    assert res.data["entity_path"] == f"/customers?open={customer.id}"
    assert res.data["changes"]["name"] == {"from": "Acme", "to": "Acme Srl"}
    assert res.data["changes"]["notes"] == {"from": None, "to": "note"}
