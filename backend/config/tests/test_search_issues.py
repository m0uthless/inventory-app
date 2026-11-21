"""Issue nella ricerca globale (palette Ctrl K, lista del 21/11, punto 6).

Si cercano per numero e titolo, solo quelle visibili (area) e non eliminate;
spariscono con il modulo Issue spento.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from attendance.models import LeaveArea
from core.models import CustomerStatus, UserProfile
from core.testing import make_archie_user
from crm.models import Customer
from issues.models import Issue

pytestmark = pytest.mark.django_db
URL = "/api/search/"


def _user(area=None):
    u = make_archie_user(username=f"s_{uuid.uuid4().hex[:6]}", password="pw")
    u.user_permissions.add(Permission.objects.get(codename="view_issue"))
    if area:
        p, _ = UserProfile.objects.get_or_create(user=u)
        p.leave_area = area
        p.save(update_fields=["leave_area"])
    u = get_user_model().objects.get(pk=u.pk)
    c = APIClient(); c.force_authenticate(user=u)
    return c, u


def _issue(title, author, **kw):
    st = CustomerStatus.objects.get_or_create(key="srch_cs", defaults={"label": "Active"})[0]
    cu = Customer.objects.create(name=f"Clinica {uuid.uuid4().hex[:4]}", status=st)
    return Issue.objects.create(title=title, customer=cu, created_by=author, **kw)


def test_issues_found_by_title_and_number():
    c, u = _user()
    iss = _issue("Worklist vuota sulla TC", u)
    _issue("Altro", u, deleted_at=timezone.now())
    by_title = [r for r in c.get(URL, {"q": "worklist"}).json()["results"] if r["kind"] == "issue"]
    assert [r["id"] for r in by_title] == [iss.id]
    assert by_title[0]["title"] == f"#{iss.id} Worklist vuota sulla TC"
    assert by_title[0]["path"] == f"/issues?open={iss.id}"
    by_number = [r for r in c.get(URL, {"q": f"#{iss.id}"}).json()["results"] if r["kind"] == "issue"]
    assert [r["id"] for r in by_number] == [iss.id]


def test_issues_of_other_areas_are_not_found():
    mine, other = LeaveArea.objects.create(key="s_mine", label="BO"), LeaveArea.objects.create(key="s_other", label="RN")
    c, u = _user(area=mine)
    _issue("Worklist altrove", u, area=other)
    assert not [r for r in c.get(URL, {"q": "worklist"}).json()["results"] if r["kind"] == "issue"]


def test_without_permission_no_issues():
    u = make_archie_user(username="s_noperm", password="pw")
    c = APIClient(); c.force_authenticate(user=u)
    _issue("Worklist", u)
    assert not [r for r in c.get(URL, {"q": "worklist"}).json()["results"] if r["kind"] == "issue"]
