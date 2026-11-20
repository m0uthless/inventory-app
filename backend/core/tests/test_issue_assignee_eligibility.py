"""Assegnatario delle issue = permesso `issues.be_assignee` (dato da un
gruppo) e accesso ad Archie. Distinto dal permesso tecnico ServiceNow."""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

from core.technicians import eligible_issue_assignee_q, is_eligible_issue_assignee
from core.testing import grant_via_group, make_archie_user

pytestmark = pytest.mark.django_db

User = get_user_model()


def _listed(user) -> bool:
    return User.objects.filter(eligible_issue_assignee_q(), pk=user.pk).exists()


def test_group_permission_makes_assignee():
    user = make_archie_user(username="ass", password="pw")
    grant_via_group(user, "issues.be_assignee")
    assert is_eligible_issue_assignee(user) is True
    assert _listed(user)


def test_without_permission_not_assignee():
    user = make_archie_user(username="nope", password="pw")
    assert is_eligible_issue_assignee(user) is False
    assert not _listed(user)


def test_superuser_without_group_not_assignee():
    su = User.objects.create_superuser(username="root3", password="pw", email="r3@example.com")
    assert is_eligible_issue_assignee(su) is False
    assert not _listed(su)


def test_inactive_user_not_assignee():
    user = make_archie_user(username="off", password="pw")
    grant_via_group(user, "issues.be_assignee")
    user.is_active = False
    user.save(update_fields=["is_active"])
    assert is_eligible_issue_assignee(user) is False
    assert not _listed(user)


def test_portal_user_with_permission_not_assignee():
    user = User.objects.create_user(username="cliente", password="pw")
    grant_via_group(user, "issues.be_assignee")
    assert is_eligible_issue_assignee(user) is False
    assert not _listed(user)


def test_technician_permission_does_not_make_assignee():
    user = make_archie_user(username="tec", password="pw")
    grant_via_group(user, "servicenow.be_technician")
    assert is_eligible_issue_assignee(user) is False
    assert not _listed(user)
