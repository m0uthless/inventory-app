import pytest

from crm.models import Customer
from audit.models import AuditEvent
from audit.utils import log_event
from rest_framework.test import APIRequestFactory


pytestmark = pytest.mark.django_db


def test_log_event_masks_sensitive_query_params_and_metadata(customer_status, superuser):
    customer = Customer.objects.create(
        name="Acme",
        status=customer_status,
        created_by=superuser,
        updated_by=superuser,
    )

    rf = APIRequestFactory()
    req = rf.get("/api/audit-events/?token=abc123&password=hunter2&plain=ok")
    req.META["REMOTE_ADDR"] = "127.0.0.1"

    log_event(
        actor=superuser,
        action=AuditEvent.Action.UPDATE,
        instance=customer,
        request=req,
        metadata={
            "api_key": "very-secret",
            "reason": "manual check",
            "nested": {"access_token": "nested-secret", "safe": "visible"},
        },
        changes={"name": {"before": "Acme", "after": "Acme 2"}},
        subject="Acme",
    )

    ev = AuditEvent.objects.latest("id")
    assert ev.path == "/api/audit-events/?token=%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2&password=%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2&plain=ok"
    assert ev.metadata["query_params"]["token"] == ["••••"]
    assert ev.metadata["query_params"]["password"] == ["••••"]
    assert ev.metadata["query_params"]["plain"] == ["ok"]
    assert ev.metadata["api_key"] == "••••"
    assert ev.metadata["nested"]["access_token"] == "••••"
    assert ev.metadata["nested"]["safe"] == "visible"
    assert ev.metadata["reason"] == "manual check"


def test_audit_detail_exposes_metadata_summary_masked(api_client, superuser, customer_status):
    customer = Customer.objects.create(
        name="Beta",
        status=customer_status,
        created_by=superuser,
        updated_by=superuser,
    )
    rf = APIRequestFactory()
    req = rf.get("/api/customers/?api_key=raw-secret")
    req.META["REMOTE_ADDR"] = "127.0.0.1"

    log_event(
        actor=superuser,
        action=AuditEvent.Action.UPDATE,
        instance=customer,
        request=req,
        metadata={"reason": "bulk import", "api_key": "raw-secret"},
        changes={"notes": {"before": None, "after": "updated"}},
        subject=str(customer),
    )
    ev = AuditEvent.objects.latest("id")

    api_client.force_authenticate(user=superuser)
    res = api_client.get(f"/api/audit-events/{ev.id}/")

    assert res.status_code == 200
    assert res.data["metadata_summary"] == {
        "query_params": {"api_key": ["••••"]},
        "reason": "bulk import",
        "api_key": "••••",
    }
    assert res.data["path"] == "/api/customers/?api_key=%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2"
