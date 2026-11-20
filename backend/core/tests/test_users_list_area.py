import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from attendance.models import LeaveArea
from core.models import UserProfile
from core.testing import grant_via_group, make_archie_user

pytestmark = pytest.mark.django_db

User = get_user_model()
URL = "/api/users/"


def _area(label="Area"):
    return LeaveArea.objects.create(key=f"area_{uuid.uuid4().hex[:6]}", label=label)


def _user(area=None, *, active=True):
    username = f"u_{uuid.uuid4().hex[:6]}"
    user = make_archie_user(username=username, password="pw", is_active=active)
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.leave_area = area
    profile.save(update_fields=["leave_area"])
    return User.objects.get(pk=user.pk)


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _ids(resp):
    data = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    return {row["id"] for row in data}


def test_users_expose_leave_area():
    area = _area()
    me = _user(area)
    resp = _client(me).get(URL)
    row = next(r for r in (resp.data["results"] if isinstance(resp.data, dict) else resp.data) if r["id"] == me.id)
    assert row["leave_area"] == area.id


def test_leave_area_filter_returns_only_that_area():
    a1, a2 = _area(), _area()
    u1, u2, nobody = _user(a1), _user(a2), _user(None)
    client = _client(u1)
    assert _ids(client.get(URL, {"leave_area": a1.id})) == {u1.id}
    assert _ids(client.get(URL, {"leave_area": a2.id})) == {u2.id}
    assert nobody.id in _ids(client.get(URL))


def test_leave_area_filter_excludes_inactive_and_ignores_garbage():
    area = _area()
    active = _user(area)
    _user(area, active=False)
    client = _client(active)
    assert _ids(client.get(URL, {"leave_area": area.id})) == {active.id}
    assert active.id in _ids(client.get(URL, {"leave_area": "abc"}))


def test_users_list_exposes_issue_assignee_flag():
    me = _user()
    assignee = grant_via_group(_user(), "issues.be_assignee")
    tech = grant_via_group(_user(), "servicenow.be_technician")
    data = _client(me).get(URL).data
    rows = {r["id"]: r for r in (data["results"] if isinstance(data, dict) else data)}
    assert rows[assignee.id]["is_issue_assignee"] is True
    assert rows[assignee.id]["is_servicenow_technician"] is False
    assert rows[tech.id]["is_issue_assignee"] is False
    assert rows[tech.id]["is_servicenow_technician"] is True
    assert rows[me.id]["is_issue_assignee"] is False
