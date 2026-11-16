"""Scadenze (/maintenance-plans/todo/) e indicatori (/maintenance-plans/todo-stats/)."""
from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import CustomerStatus, InventoryStatus, InventoryType, SiteStatus
from crm.models import Customer, Site
from inventory.models import Inventory
from maintenance.models import IntervalUnit, MaintenanceEvent, MaintenancePlan, MaintenancePlanInventory, ScheduleType

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    user = get_user_model().objects.create_superuser(username=f"adm_{uuid.uuid4().hex[:6]}", email="a@example.com", password="pw")
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def setup():
    cs = CustomerStatus.objects.get_or_create(key="todo_cs", defaults={"label": "Active"})[0]
    ss = SiteStatus.objects.get_or_create(key="todo_ss", defaults={"label": "Active"})[0]
    ist = InventoryStatus.objects.get_or_create(key="in_use", defaults={"label": "In use"})[0]
    srv = InventoryType.objects.get_or_create(key="todo_srv", defaults={"label": "Server"})[0]
    ws = InventoryType.objects.get_or_create(key="todo_ws", defaults={"label": "Workstation"})[0]
    cust = Customer.objects.create(name="TodoCo", status=cs)
    site = Site.objects.create(customer=cust, name="HQ", status=ss)
    today = timezone.localdate()

    def inv(name, t):
        return Inventory.objects.create(customer=cust, site=site, name=name, status=ist, type=t)

    def plan(title, due, types):
        p = MaintenancePlan.objects.create(
            title=title, customer=cust, schedule_type=ScheduleType.INTERVAL,
            interval_unit=IntervalUnit.YEARS, interval_value=1, next_due_date=due,
        )
        p.inventory_types.set(types)
        return p

    p_over = plan("Server scaduti", today - timedelta(days=5), [srv])
    p_soon = plan("Workstation", today + timedelta(days=10), [ws])
    s1, s2 = inv("SRV-1", srv), inv("SRV-2", srv)
    w1, w2 = inv("WS-1", ws), inv("WS-2", ws)
    # WS-2 già fatta nel ciclo corrente → esce dalle scadenze
    MaintenanceEvent.objects.create(plan=p_soon, inventory=w2, performed_at=today - timedelta(days=3), result="ok")
    # SRV-1: esecuzione del ciclo precedente → resta da fare, ma con l'ultima esecuzione
    MaintenanceEvent.objects.create(plan=p_over, inventory=s1, performed_at=today - timedelta(days=400), result="partial")
    # WS-1: scadenza spostata più avanti
    MaintenancePlanInventory.objects.create(plan=p_soon, inventory=w1, due_date_override=today + timedelta(days=90))
    return {"cust": cust, "s1": s1, "s2": s2, "w1": w1, "w2": w2, "today": today}


def _ids(resp):
    return {r["inventory_id"] for r in resp.data["results"]}


def test_todo_excludes_done_and_reports_last_execution(client, setup):
    rows = client.get("/api/maintenance-plans/todo/").data["results"]
    by_inv = {r["inventory_id"]: r for r in rows}
    assert set(by_inv) == {setup["s1"].id, setup["s2"].id, setup["w1"].id}
    assert by_inv[setup["s1"].id]["last_result"] == "partial"
    assert by_inv[setup["s2"].id]["last_result"] is None


@pytest.mark.parametrize("due,expected", [("overdue", {"s1", "s2"}), ("later", {"w1"}), ("override", {"w1"}), ("next30", set())])
def test_todo_due_filter(client, setup, due, expected):
    assert _ids(client.get("/api/maintenance-plans/todo/", {"due": due})) == {setup[k].id for k in expected}


def test_todo_type_filter(client, setup):
    assert _ids(client.get("/api/maintenance-plans/todo/", {"type": "Workstation"})) == {setup["w1"].id}


def test_todo_stats(client, setup):
    s = client.get("/api/maintenance-plans/todo-stats/").data
    assert (s["total"], s["overdue"], s["next30"], s["later"], s["override"]) == (3, 2, 0, 1, 1)
    assert s["coverage"] == {"done": 1, "total": 4}
    assert s["overdue_by_customer"][0]["count"] == 2
    assert s["next_visits"][0]["count"] == 3
    assert len(s["months"]) == 12
    assert s["months"][0]["overdue"] == 2  # le scadute contano nel mese corrente
    assert s["events_this_month"] >= 0
    assert s["types"] == ["Server", "Workstation"]


# ─── Piani: da fare / scadute per piano, filtro state, plan-stats ─────────────

def _plans(client, **params):
    return {p["title"]: p for p in client.get("/api/maintenance-plans/", {"page_size": 100, **params}).data["results"]}


def test_plan_list_reports_todo_and_overdue(client, setup):
    plans = _plans(client)
    assert (plans["Server scaduti"]["todo_count"], plans["Server scaduti"]["overdue_count"]) == (2, 2)
    assert (plans["Workstation"]["todo_count"], plans["Workstation"]["overdue_count"]) == (1, 0)


def test_plan_state_filter(client, setup):
    today = setup["today"]
    old = MaintenancePlan.objects.create(title="Archiviato", customer=setup["cust"], schedule_type=ScheduleType.INTERVAL,
                                         interval_unit=IntervalUnit.YEARS, interval_value=1, next_due_date=today.replace(year=today.year - 1))
    assert set(_plans(client, state="overdue")) == {"Server scaduti"}
    assert set(_plans(client, state="archived")) == {old.title}
    assert set(_plans(client, state="active")) == {"Server scaduti", "Workstation"}
    # completato: tutte le coppie fatte nel ciclo
    MaintenanceEvent.objects.create(plan=MaintenancePlan.objects.get(title="Workstation"), inventory=setup["w1"], performed_at=today - timedelta(days=1), result="ok")
    assert set(_plans(client, state="completed")) == {"Workstation"}


def test_plan_stats(client, setup):
    s = client.get("/api/maintenance-plans/plan-stats/").data
    assert (s["active"], s["covered"], s["done"], s["with_overdue"], s["completed"]) == (2, 4, 1, 1, 0)


# ─── Rapportini: filtri e indicatori ─────────────────────────────────────────

def test_events_filters_and_stats(client, setup):
    rows = client.get("/api/maintenance-events/", {"results": "partial,ko"}).data["results"]
    assert {r["result"] for r in rows} == {"partial"}
    assert len(client.get("/api/maintenance-events/", {"has_pdf": "false"}).data["results"]) == 2
    s = client.get("/api/maintenance-events/stats/").data
    assert (s["total"], s["follow_up"], s["no_pdf"], s["not_planned"]) == (2, 1, 2, 0)
