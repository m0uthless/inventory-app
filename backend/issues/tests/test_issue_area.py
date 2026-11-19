"""Issue per area (spec 2026-11-19, Parte 2): area facoltativa, sola
lettura per le altre aree, assegnatario membro dell'area."""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from attendance.models import LeaveArea
from core.models import CustomerStatus, UserProfile
from core.testing import make_archie_user, make_issue_assignee
from crm.models import Customer
from issues.models import Issue

pytestmark = pytest.mark.django_db

User = get_user_model()


def _area(label="Area"):
    return LeaveArea.objects.create(key=f"a_{uuid.uuid4().hex[:6]}", label=label)


def _in_area(user, area):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.leave_area = area
    profile.save(update_fields=["leave_area"])
    return User.objects.get(pk=user.pk)


def _staff(area=None):
    """Utente Archie con i permessi completi sulle issue."""
    user = make_archie_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(*Permission.objects.filter(content_type__app_label="issues"))
    return _in_area(user, area)


def _assignee(area=None):
    return _in_area(make_issue_assignee(username=f"a_{uuid.uuid4().hex[:6]}", password="pw"), area)


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _customer():
    status = CustomerStatus.objects.get_or_create(key=f"st_{uuid.uuid4().hex[:6]}", defaults={"label": "Attivo"})[0]
    return Customer.objects.create(name="Cliente", status=status)


def _issue(area=None, **kw):
    author = kw.pop("created_by", None) or _staff()
    return Issue.objects.create(title="Issue", customer=_customer(), created_by=author, area=area, **kw)


def test_create_with_area():
    area = _area()
    me = _staff(area)
    resp = _client(me).post("/api/issues/", {"title": "T", "customer": _customer().id, "area": area.id}, format="json")
    assert resp.status_code == 201, resp.json()
    assert Issue.objects.get(pk=resp.json()["id"]).area_id == area.id


def test_area_label_and_can_edit_for_member():
    area = _area("Radiologia")
    me = _staff(area)
    data = _client(me).get(f"/api/issues/{_issue(area).pk}/").json()
    assert data["area"] == area.id
    assert data["area_label"] == "Radiologia"
    assert data["can_edit"] is True


def test_can_edit_false_for_other_area():
    me = _staff(_area())
    data = _client(me).get(f"/api/issues/{_issue(_area()).pk}/").json()
    assert data["can_edit"] is False


def test_can_edit_true_without_area():
    me = _staff(_area())
    data = _client(me).get(f"/api/issues/{_issue(None).pk}/").json()
    assert data["area"] is None
    assert data["area_label"] is None
    assert data["can_edit"] is True


def test_assignee_must_belong_to_area():
    area = _area("Radiologia")
    me = _staff(area)
    outsider = _assignee(_area())
    resp = _client(me).patch(f"/api/issues/{_issue(area).pk}/", {"assigned_to": outsider.pk}, format="json")
    assert resp.status_code == 400
    assert resp.json()["assigned_to"] == ["L'assegnatario deve far parte dell'area «Radiologia»."]


def test_assignee_of_the_area_is_accepted():
    area = _area()
    me = _staff(area)
    member = _assignee(area)
    resp = _client(me).patch(f"/api/issues/{_issue(area).pk}/", {"assigned_to": member.pk}, format="json")
    assert resp.status_code == 200, resp.json()


def test_assignee_without_area_any_assignee():
    me = _staff(_area())
    anyone = _assignee(_area())
    resp = _client(me).patch(f"/api/issues/{_issue(None).pk}/", {"assigned_to": anyone.pk}, format="json")
    assert resp.status_code == 200, resp.json()


def test_changing_area_rejects_assignee_from_other_area():
    old, new = _area(), _area("Nuova")
    me = _staff(old)
    member_old = _assignee(old)
    issue = _issue(old, assigned_to=member_old)
    resp = _client(me).patch(f"/api/issues/{issue.pk}/", {"area": new.id}, format="json")
    assert resp.status_code == 400
    assert "assigned_to" in resp.json()


def test_patch_untouched_area_and_assignee_skips_check():
    area = _area()
    me = _staff(area)
    stale = _assignee(_area())  # assegnatario fuori area (dato preesistente)
    issue = _issue(area, assigned_to=stale)
    resp = _client(me).patch(f"/api/issues/{issue.pk}/", {"title": "Nuovo"}, format="json")
    assert resp.status_code == 200, resp.json()


def test_filter_by_area():
    a1, a2 = _area(), _area()
    me = _staff(a1)
    i1, i2, i0 = _issue(a1), _issue(a2), _issue(None)
    body = _client(me).get("/api/issues/", {"area": a1.id}).json()
    ids = {r["id"] for r in (body["results"] if isinstance(body, dict) else body)}
    assert i1.pk in ids and i2.pk not in ids and i0.pk not in ids


def test_deleted_area_keeps_issue_readable():
    area = _area("Vecchia")
    me = _staff(area)
    issue = _issue(area)
    area.deleted_at = timezone.now()
    area.save(update_fields=["deleted_at"])
    resp = _client(me).get(f"/api/issues/{issue.pk}/")
    assert resp.status_code == 200
    assert resp.json()["area_label"] == "Vecchia"
