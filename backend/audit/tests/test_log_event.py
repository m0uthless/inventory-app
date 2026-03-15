import pytest

from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory

from audit.models import AuditEvent
from audit.utils import log_event


pytestmark = pytest.mark.django_db


def test_log_event_allows_instance_none_and_sets_request_fields():
    """Regression test: log_event(instance=None) must not fail and must persist.

    content_type is nullable by design for system/bulk events.
    """

    User = get_user_model()
    user = User.objects.create_user(username="u1", password="pass")

    rf = APIRequestFactory()
    req = rf.get("/api/search/?search=x", HTTP_USER_AGENT="pytest")
    req.META["REMOTE_ADDR"] = "127.0.0.1"

    log_event(
        actor=user,
        action="login",
        instance=None,
        changes={"note": "system"},
        request=req,
        subject="system event",
    )

    ev = AuditEvent.objects.get()
    assert ev.content_type is None
    assert ev.object_id == ""
    assert ev.subject == "system event"

    assert ev.path == "/api/search/?search=x"
    assert ev.method == "GET"
    assert str(ev.ip_address) == "127.0.0.1"
    assert "pytest" in (ev.user_agent or "")

    # Metadata should also be present
    assert ev.metadata.get("path") == "/api/search/?search=x"
