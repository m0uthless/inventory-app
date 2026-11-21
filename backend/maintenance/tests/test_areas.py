"""Manutenzione per area (decisioni di Fede del 21/11): area sul piano, visibilità come le issue.

- superuser o `maintenance.view_all_areas` → tutti i piani;
- utente con un'area → piani della sua area e piani senza area;
- utente senza area → tutti.
Un piano con un'area lo modificano solo i membri dell'area (o il superuser).
I job di sistema (scadenze per notifiche e riepilogo) vedono tutto.
"""
from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from attendance.models import LeaveArea
from core.models import UserProfile
from core.testing import make_archie_user
from maintenance.api.plans import todo_rows_for_jobs
from maintenance.models import MaintenanceEvent, MaintenancePlan
from maintenance.tests.test_todo import setup  # noqa: F401  (fixture: cliente, server scaduti SRV-1/SRV-2, workstation)

pytestmark = pytest.mark.django_db


def _area(label):
    return LeaveArea.objects.create(key=f"a_{uuid.uuid4().hex[:6]}", label=label)


def _user(area=None, *extra):
    u = make_archie_user(username=f"m_{uuid.uuid4().hex[:6]}", password="pw")
    u.user_permissions.add(*Permission.objects.filter(content_type__app_label="maintenance").exclude(codename="view_all_areas"))
    u.user_permissions.add(*Permission.objects.filter(codename__in=extra))
    p, _ = UserProfile.objects.get_or_create(user=u)
    p.leave_area = area
    p.save(update_fields=["leave_area"])
    u = get_user_model().objects.get(pk=u.pk)
    c = APIClient(); c.force_authenticate(user=u)
    return c


@pytest.fixture
def areas(setup):  # noqa: F811
    bo, rn = _area("Bologna"), _area("Romagna")
    plans = list(MaintenancePlan.objects.filter(customer=setup["cust"]).order_by("id"))
    p_over, p_soon = plans[0], plans[1]
    p_over.area = rn; p_over.save()          # «Server scaduti» → Romagna
    # «Workstation» resta senza area
    return {"bo": bo, "rn": rn, "p_over": p_over, "p_soon": p_soon}


def _plan_ids(c):
    r = c.get("/api/maintenance-plans/", {"page_size": 100})
    data = r.json()
    return {p["id"] for p in (data["results"] if isinstance(data, dict) else data)}


def test_user_of_other_area_sees_only_own_and_unassigned(areas):
    bo = _user(areas["bo"])
    assert _plan_ids(bo) == {areas["p_soon"].id}
    todo = bo.get("/api/maintenance-plans/todo/", {"page_size": 200}).json()["results"]
    assert {r["plan_id"] for r in todo} <= {areas["p_soon"].id}
    assert bo.get(f"/api/maintenance-plans/{areas['p_over'].id}/").status_code == 404


def test_own_area_and_view_all_and_no_area_see_everything_they_should(areas):
    assert _plan_ids(_user(areas["rn"])) == {areas["p_over"].id, areas["p_soon"].id}
    assert _plan_ids(_user(areas["bo"], "view_all_areas")) == {areas["p_over"].id, areas["p_soon"].id}
    assert _plan_ids(_user(None)) == {areas["p_over"].id, areas["p_soon"].id}


def test_only_members_of_the_area_edit_its_plans(areas):
    viewer = _user(areas["bo"], "view_all_areas")
    assert viewer.patch(f"/api/maintenance-plans/{areas['p_over'].id}/", {"title": "x"}, format="json").status_code == 403
    member = _user(areas["rn"])
    r = member.patch(f"/api/maintenance-plans/{areas['p_over'].id}/", {"title": "Server RN"}, format="json")
    assert r.status_code == 200, r.data
    assert r.json()["area"] == areas["rn"].id and r.json()["area_label"] == "Romagna"


def test_events_follow_plan_visibility(areas, setup):  # noqa: F811
    ev = MaintenanceEvent.objects.create(plan=areas["p_over"], inventory=setup["s1"], performed_at=timezone.localdate() - timedelta(days=1), result="ok")
    bo = _user(areas["bo"])
    r = bo.get("/api/maintenance-events/", {"page_size": 100}).json()
    ids = {e["id"] for e in (r["results"] if isinstance(r, dict) else r)}
    assert ev.id not in ids


def test_area_filter_and_jobs_see_all(areas):
    rn = _user(areas["rn"])
    assert {p["id"] for p in rn.get("/api/maintenance-plans/", {"area": areas["rn"].id}).json()["results"]} == {areas["p_over"].id}
    assert {p["id"] for p in rn.get("/api/maintenance-plans/", {"area": "none"}).json()["results"]} == {areas["p_soon"].id}
    assert areas["p_over"].id in {r["plan_id"] for r in todo_rows_for_jobs()}


def test_inventory_panel_hides_plans_of_other_areas(areas, setup):  # noqa: F811
    bo = _user(areas["bo"], "view_inventory")
    bo.handler._force_user.user_permissions.add(*Permission.objects.filter(codename="view_inventory"))
    r = bo.get(f"/api/inventories/{setup['s1'].id}/maintenance/")
    assert r.status_code == 200, r.content
    assert areas["p_over"].id not in {p["id"] for p in r.json()["plans"]}


def test_in_app_notifications_only_to_users_who_see_the_plan(areas):
    from django.core.management import call_command

    from notifications.models import Notification

    # «Server scaduti» (Romagna) riprogrammato tra 5 giorni: SRV-1 e SRV-2 entrano nella finestra.
    MaintenancePlan.objects.filter(pk=areas["p_over"].pk).update(next_due_date=timezone.localdate() + timedelta(days=5))
    bo_user = _user(areas["bo"]).handler._force_user
    rn_user = _user(areas["rn"]).handler._force_user
    call_command("refresh_notifications")
    mine = lambda u: set(Notification.objects.filter(recipient=u, notification_type="maintenance_due").values_list("source_key", flat=True))  # noqa: E731
    assert any(k.startswith(f"{areas['p_over'].id}:") for k in mine(rn_user))
    assert not any(k.startswith(f"{areas['p_over'].id}:") for k in mine(bo_user))


def test_can_edit_flag(areas):
    viewer = _user(areas["bo"], "view_all_areas")
    rows = {p["id"]: p["can_edit"] for p in viewer.get("/api/maintenance-plans/").json()["results"]}
    assert rows == {areas["p_over"].id: False, areas["p_soon"].id: True}


def test_todo_and_stats_accept_area_filter(areas):
    rn = _user(areas["rn"])
    rows = rn.get("/api/maintenance-plans/todo/", {"area": areas["rn"].id, "page_size": 200}).json()["results"]
    assert rows and {r["plan_id"] for r in rows} == {areas["p_over"].id}
    assert all(r["plan_area_label"] == "Romagna" for r in rows)
    none_rows = rn.get("/api/maintenance-plans/todo/", {"area": "none", "page_size": 200}).json()["results"]
    assert areas["p_over"].id not in {r["plan_id"] for r in none_rows}
    assert rn.get("/api/maintenance-plans/todo-stats/", {"area": areas["rn"].id}).status_code == 200
