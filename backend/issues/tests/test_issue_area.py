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


# ── Sola lettura per le altre aree ────────────────────────────────────────────

AREA_MSG = "Puoi modificare solo le issue della tua area."


def _other_area_setup():
    me = _staff(_area())
    issue = _issue(_area())
    return me, issue


def test_other_area_cannot_patch():
    me, issue = _other_area_setup()
    resp = _client(me).patch(f"/api/issues/{issue.pk}/", {"title": "X"}, format="json")
    assert resp.status_code == 403
    assert resp.json()["detail"] == AREA_MSG


def test_other_area_cannot_delete():
    me, issue = _other_area_setup()
    assert _client(me).delete(f"/api/issues/{issue.pk}/").status_code == 403
    issue.refresh_from_db()
    assert issue.deleted_at is None


def test_other_area_cannot_restore():
    me, issue = _other_area_setup()
    issue.deleted_at = timezone.now()
    issue.save(update_fields=["deleted_at"])
    c = _client(me)
    assert c.post(f"/api/issues/{issue.pk}/restore/").status_code == 403
    c.post("/api/issues/bulk_restore/", {"ids": [issue.pk]}, format="json")
    issue.refresh_from_db()
    assert issue.deleted_at is not None


def test_other_area_cannot_comment():
    me, issue = _other_area_setup()
    c = _client(me)
    assert c.get(f"/api/issues/{issue.pk}/comments/").status_code == 200
    assert c.post(f"/api/issues/{issue.pk}/comments/", {"body": "ciao"}, format="json").status_code == 403


def test_other_area_cannot_edit_comment():
    me, issue = _other_area_setup()
    comment = issue.comments.create(author=me, body="mio")
    resp = _client(me).patch(f"/api/issues/{issue.pk}/comments/{comment.pk}/", {"body": "x"}, format="json")
    assert resp.status_code == 403


def test_other_area_cannot_link_wiki():
    me, issue = _other_area_setup()
    me.user_permissions.add(Permission.objects.get(content_type__app_label="wiki", codename="view_wikipage"))
    me = User.objects.get(pk=me.pk)
    resp = _client(me).post(f"/api/issues/{issue.pk}/wiki/", {"page": 1}, format="json")
    assert resp.status_code == 403


def test_member_can_move_issue_to_other_area_then_cannot_edit():
    mine, other = _area(), _area()
    me = _staff(mine)
    issue = _issue(mine)
    c = _client(me)
    assert c.patch(f"/api/issues/{issue.pk}/", {"area": other.id}, format="json").status_code == 200
    assert c.patch(f"/api/issues/{issue.pk}/", {"title": "Dopo"}, format="json").status_code == 403


def test_user_without_area_reads_but_cannot_edit():
    me = _staff(None)
    issue = _issue(_area())
    c = _client(me)
    data = c.get(f"/api/issues/{issue.pk}/").json()
    assert data["can_edit"] is False
    assert c.patch(f"/api/issues/{issue.pk}/", {"title": "X"}, format="json").status_code == 403


def test_superuser_can_edit_any_area():
    su = User.objects.create_superuser(username=f"su_{uuid.uuid4().hex[:6]}", password="pw", email="su@example.com")
    issue = _issue(_area())
    assert _client(su).patch(f"/api/issues/{issue.pk}/", {"title": "X"}, format="json").status_code == 200


# ── Contatore per area ────────────────────────────────────────────────────────

def _active_issues(area, n):
    for _ in range(n):
        _issue(area, status="open")


def test_summary_area_mine_counts_own_and_unassigned():
    mine, other = _area(), _area()
    me = _staff(mine)
    _active_issues(mine, 2)
    _active_issues(None, 1)
    _active_issues(other, 3)
    data = _client(me).get("/api/issues/summary/", {"area": "mine"}).json()
    assert data["active_count"] == 3


def test_summary_area_mine_without_profile_area_is_global():
    me = _staff(None)
    _active_issues(_area(), 2)
    _active_issues(None, 1)
    data = _client(me).get("/api/issues/summary/", {"area": "mine"}).json()
    assert data["active_count"] == 3


def test_summary_without_param_is_global():
    me = _staff(_area())
    _active_issues(_area(), 2)
    _active_issues(None, 1)
    assert _client(me).get("/api/issues/summary/").json()["active_count"] == 3


# ── Revisione finale: assegnatario invariato, link Wiki generici ─────────────

def _full_form(issue, **over):
    """Come il modulo «Tutti i campi…»: rimanda sempre area e assegnatario."""
    return {"title": "Titolo nuovo", "area": issue.area_id, "assigned_to": issue.assigned_to_id, **over}


def test_full_form_with_unchanged_assignee_who_left_group_passes():
    from django.contrib.auth.models import Group
    me = _staff(None)
    stale = _assignee(None)
    issue = _issue(None, assigned_to=stale)
    Group.objects.filter(user=stale).delete()
    resp = _client(me).patch(f"/api/issues/{issue.pk}/", _full_form(issue), format="json")
    assert resp.status_code == 200, resp.json()


def test_full_form_with_unchanged_assignee_who_changed_area_passes():
    area = _area()
    me = _staff(area)
    member = _assignee(area)
    issue = _issue(area, assigned_to=member)
    _in_area(member, _area())  # l'assegnatario cambia area
    resp = _client(me).patch(f"/api/issues/{issue.pk}/", _full_form(issue), format="json")
    assert resp.status_code == 200, resp.json()


def test_full_form_changing_area_still_checks_unchanged_assignee():
    old, new = _area(), _area("Nuova")
    me = _staff(old)
    issue = _issue(old, assigned_to=_assignee(old))
    resp = _client(me).patch(f"/api/issues/{issue.pk}/", _full_form(issue, area=new.id), format="json")
    assert resp.status_code == 400
    assert "assigned_to" in resp.json()


def _wiki_page():
    from wiki.models import WikiPage
    return WikiPage.objects.create(title="Procedura", slug=f"p-{uuid.uuid4().hex[:6]}", content_markdown="# P", is_published=True)


def _wiki_user(area):
    me = _staff(area)
    me.user_permissions.add(*Permission.objects.filter(content_type__app_label="wiki"))
    return User.objects.get(pk=me.pk)


def test_generic_wiki_links_api_cannot_link_other_area_issue():
    me = _wiki_user(_area())
    issue = _issue(_area())
    resp = _client(me).post("/api/wiki-links/", {"page": _wiki_page().pk, "entity_type": "issue", "entity_id": issue.pk}, format="json")
    assert resp.status_code == 403


def test_generic_wiki_links_api_cannot_delete_other_area_issue_link():
    from wiki.models import WikiLink
    me = _wiki_user(_area())
    issue = _issue(_area())
    link = WikiLink.objects.create(page=_wiki_page(), entity_type="issue", entity_id=issue.pk)
    assert _client(me).delete(f"/api/wiki-links/{link.pk}/").status_code == 403


def test_generic_wiki_links_api_allows_own_area_issue():
    area = _area()
    me = _wiki_user(area)
    issue = _issue(area)
    resp = _client(me).post("/api/wiki-links/", {"page": _wiki_page().pk, "entity_type": "issue", "entity_id": issue.pk}, format="json")
    assert resp.status_code == 201, resp.json()
