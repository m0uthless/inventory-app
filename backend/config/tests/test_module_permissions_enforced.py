"""Permessi veri per Rimborso spese e Bug e feature (decisione di Fede del 21/11).

Prima la pagina e l'API erano aperte a ogni utente Archie e i permessi della matrice
non controllavano nulla. Ora: vedere = `view_*`, creare = `add_*`; le regole di
proprietà (chi vede quali note, segreteria, segnalazioni) restano quelle di prima.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from core.testing import make_archie_user

pytestmark = pytest.mark.django_db


def _client(*perms):
    u = make_archie_user(username=f"m_{uuid.uuid4().hex[:6]}", password="pw")
    for p in perms:
        app, code = p.split(".")
        u.user_permissions.add(Permission.objects.get(content_type__app_label=app, codename=code))
    c = APIClient(); c.force_authenticate(user=u)
    return c


@pytest.mark.parametrize("url", ["/api/expense-reports/", "/api/expense-items/", "/api/expense-receipts/", "/api/expense-km-trips/"])
def test_expenses_need_view_permission(url):
    assert _client().get(url).status_code == 403
    assert _client("expenses.view_expensereport").get(url).status_code == 200


def test_creating_an_expense_report_needs_add_permission():
    body = {"year": 2026, "month": 11}
    assert _client("expenses.view_expensereport").post("/api/expense-reports/", body, format="json").status_code == 403
    r = _client("expenses.view_expensereport", "expenses.add_expensereport").post("/api/expense-reports/", body, format="json")
    assert r.status_code in (200, 201), r.data


def test_report_requests_need_view_and_add_permissions():
    assert _client().get("/api/feedback-items/").status_code == 403
    assert _client("feedback.view_reportrequest").get("/api/feedback-items/").status_code == 200
    body = {"kind": "bug", "description": "Prova"}
    assert _client("feedback.view_reportrequest").post("/api/feedback-items/", body, format="json").status_code == 403
