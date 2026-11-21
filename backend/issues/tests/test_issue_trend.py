"""Andamento delle issue per il widget della Dashboard (variante B · Arretrato, scelta di Fede).

Per ogni periodo: aperte nel periodo, risolte nel periodo (`closed_at`) e quante restano
aperte alla fine. Solo issue visibili (area) e non eliminate.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import CustomerStatus
from core.testing import make_archie_user
from crm.models import Customer
from issues.models import Issue

pytestmark = pytest.mark.django_db


def _client():
    u = make_archie_user(username=f"t_{uuid.uuid4().hex[:6]}", password="pw")
    u.user_permissions.add(Permission.objects.get(content_type__app_label="issues", codename="view_issue"))
    c = APIClient(); c.force_authenticate(user=u)
    return c, u


def _issue(author, opened, closed=None, **kw):
    st = CustomerStatus.objects.get_or_create(key="tr_cs", defaults={"label": "A"})[0]
    cu = Customer.objects.create(name=f"C{uuid.uuid4().hex[:4]}", status=st)
    return Issue.objects.create(title="T", customer=cu, created_by=author, opened_at=opened, closed_at=closed,
                                status="resolved" if closed else "open", **kw)


def test_daily_trend_counts_opened_closed_and_backlog():
    c, u = _client()
    today = timezone.localdate()
    _issue(u, today - timedelta(days=30))                         # aperta da prima: arretrato di partenza
    _issue(u, today - timedelta(days=3))                          # aperta 3 giorni fa
    _issue(u, today - timedelta(days=5), today - timedelta(days=1))  # aperta 5 gg fa, risolta ieri
    _issue(u, today - timedelta(days=2), deleted_at=timezone.now())  # eliminata: non conta
    d = c.get("/api/issues/trend/", {"period": "day"}).json()
    pts = d["points"]
    assert d["period"] == "day" and len(pts) == 14
    assert pts[-1]["end"] == today.isoformat()
    by_end = {p["end"]: p for p in pts}
    assert by_end[(today - timedelta(days=3)).isoformat()]["opened"] == 1
    assert by_end[(today - timedelta(days=1)).isoformat()]["closed"] == 1
    assert pts[-1]["open"] == 2
    assert by_end[(today - timedelta(days=4)).isoformat()]["open"] == 2   # la prima e quella dei 5 giorni
    assert d["open_now"] == 2


def test_weekly_and_monthly_shapes():
    c, _ = _client()
    w = c.get("/api/issues/trend/", {"period": "week"}).json()
    m = c.get("/api/issues/trend/", {"period": "month"}).json()
    assert len(w["points"]) == 12 and len(m["points"]) == 12
    assert date.fromisoformat(m["points"][-1]["start"]).day == 1
    assert c.get("/api/issues/trend/", {"period": "anno"}).status_code == 400
