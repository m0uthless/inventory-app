"""Assegnatario delle issue: solo chi ha il permesso di gruppo
`issues.be_assignee` (non basta essere tecnico ServiceNow)."""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from core.models import CustomerStatus
from core.testing import make_issue_assignee, make_technician
from crm.models import Customer
from issues.models import Issue

pytestmark = pytest.mark.django_db

User = get_user_model()


def _admin():
    return User.objects.create_superuser(username=f"su_{uuid.uuid4().hex[:6]}", password="pw", email="su@example.com")


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _issue(author, **kw):
    status = CustomerStatus.objects.get_or_create(key=f"st_{uuid.uuid4().hex[:6]}", defaults={"label": "Attivo"})[0]
    customer = Customer.objects.create(name="Cliente", status=status)
    return Issue.objects.create(title="Issue", customer=customer, created_by=author, **kw)


def test_assign_requires_issue_assignee_permission():
    admin = _admin()
    issue = _issue(admin)
    sn_only = make_technician(username="sn_only", password="pw")

    resp = _client(admin).patch(f"/api/issues/{issue.pk}/", {"assigned_to": sn_only.pk}, format="json")

    assert resp.status_code == 400
    assert "assigned_to" in resp.json()


def test_assign_with_issue_assignee_permission():
    admin = _admin()
    issue = _issue(admin)
    assignee = make_issue_assignee(username="ok", password="pw")

    resp = _client(admin).patch(f"/api/issues/{issue.pk}/", {"assigned_to": assignee.pk}, format="json")

    assert resp.status_code == 200, resp.json()


def test_patch_without_assigned_to_keeps_stale_assignee():
    admin = _admin()
    former = make_issue_assignee(username="ex", password="pw")
    issue = _issue(admin, assigned_to=former)
    Group.objects.filter(user=former).delete()  # ha perso il permesso

    resp = _client(admin).patch(f"/api/issues/{issue.pk}/", {"title": "Nuovo titolo"}, format="json")

    assert resp.status_code == 200, resp.json()
    issue.refresh_from_db()
    assert issue.assigned_to_id == former.pk
