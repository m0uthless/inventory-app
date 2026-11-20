"""Audit su riassegnazione issue.

La riassegnazione fa partire l'email `issue_assigned`, ma il diff di audit
di IssueViewSet.perform_update copriva solo status/priority: un cambio di
solo assegnatario produceva un evento "update" con changes=None.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from rest_framework.test import APIClient

from audit.models import AuditEvent
from audit.utils import to_change_value_for_field
from core.models import CustomerStatus
from crm.models import Customer
from issues.models import Issue
from core.testing import make_issue_assignee

pytestmark = pytest.mark.django_db

User = get_user_model()


def _user(*, superuser=False):
    u = make_issue_assignee(username=f"u_{uuid.uuid4().hex[:6]}", password="pw")
    if superuser:
        u.is_staff = u.is_superuser = True
        u.save(update_fields=["is_staff", "is_superuser"])
    return u


def _issue(author, assigned_to=None):
    status = CustomerStatus.objects.get_or_create(
        key=f"active_issue_audit_{uuid.uuid4().hex[:6]}", defaults={"label": "Active"}
    )[0]
    customer = Customer.objects.create(name="Cliente Test", status=status)
    return Issue.objects.create(title="Issue", customer=customer, created_by=author, assigned_to=assigned_to)


def _last_update_event(issue):
    ct = ContentType.objects.get_for_model(Issue)
    return AuditEvent.objects.filter(content_type=ct, object_id=str(issue.pk), action="update").latest("id")


@pytest.mark.parametrize("before, after", [("a", "b"), (None, "b"), ("a", None)])
def test_assignee_change_is_recorded_in_audit_changes(before, after):
    author = _user(superuser=True)
    users = {"a": _user(), "b": _user(), None: None}
    issue = _issue(author, assigned_to=users[before])

    client = APIClient()
    client.force_authenticate(user=author)
    new_id = users[after].id if users[after] else None
    resp = client.patch(f"/api/issues/{issue.id}/", {"assigned_to": new_id}, format="json")
    assert resp.status_code == 200, resp.data

    event = _last_update_event(issue)
    assert event.changes == {
        "assigned_to": {
            "from": to_change_value_for_field("assigned_to", users[before]),
            "to": to_change_value_for_field("assigned_to", users[after]),
        }
    }


def test_update_without_assignee_change_does_not_record_assigned_to():
    author = _user(superuser=True)
    issue = _issue(author, assigned_to=_user())

    client = APIClient()
    client.force_authenticate(user=author)
    resp = client.patch(f"/api/issues/{issue.id}/", {"title": "Nuovo titolo"}, format="json")
    assert resp.status_code == 200, resp.data

    assert "assigned_to" not in (_last_update_event(issue).changes or {})



@pytest.mark.parametrize("before, after", [("old", "new"), (None, "new"), ("old", None)])
def test_area_change_is_recorded_in_audit_changes(before, after):
    from attendance.models import LeaveArea

    author = _user(superuser=True)
    areas = {k: LeaveArea.objects.create(key=f"a_{uuid.uuid4().hex[:6]}", label=k) for k in ("old", "new")}
    areas[None] = None
    issue = _issue(author)
    issue.area = areas[before]
    issue.save(update_fields=["area"])

    client = APIClient()
    client.force_authenticate(user=author)
    resp = client.patch(f"/api/issues/{issue.id}/", {"area": areas[after].id if areas[after] else None}, format="json")
    assert resp.status_code == 200, resp.data

    assert _last_update_event(issue).changes == {
        "area": {
            "from": to_change_value_for_field("area", areas[before]),
            "to": to_change_value_for_field("area", areas[after]),
        }
    }
