"""B-19 (QA 2026-11-15): un utente senza permessi `expenses.*` compila la
propria nota spese (voci, tragitti, scontrini), ma non tocca quelle altrui né
una nota non più modificabile."""
from __future__ import annotations

import uuid

import pytest
from rest_framework.test import APIClient

from core.testing import make_archie_user as _make_archie_user


def make_archie_user(*args, **kwargs):
    """Utente Archie con l'accesso al modulo (expenses): dal 21/11 i permessi contano davvero."""
    from django.contrib.auth.models import Permission

    u = _make_archie_user(*args, **kwargs)
    u.user_permissions.add(*Permission.objects.filter(content_type__app_label="expenses", codename__in=["view_expensereport", "add_expensereport"]))
    return type(u).objects.get(pk=u.pk)
from expenses.models import ExpenseCategory, ExpenseItem, ExpenseReportStatus

pytestmark = pytest.mark.django_db


def _client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _report(client):
    resp = client.post("/api/expense-reports/", {"year": 2026, "month": 4}, format="json")
    assert resp.status_code == 201, resp.data
    return resp.data["id"]


def test_owner_without_expense_permissions_fills_the_report():
    owner = make_archie_user(username=f"own_{uuid.uuid4().hex[:6]}", password="pw")
    c = _client(owner)
    report_id = _report(c)
    km_item = ExpenseItem.objects.get(report_id=report_id, category=ExpenseCategory.RIMBORSO_KM)
    other_item = ExpenseItem.objects.filter(report_id=report_id).exclude(category=ExpenseCategory.RIMBORSO_KM).first()

    trip = c.post(
        "/api/expense-km-trips/",
        {"item": km_item.pk, "date": "2026-04-02", "destination": "Bologna", "km": 42},
        format="json",
    )
    assert trip.status_code == 201, trip.data

    item = c.patch(f"/api/expense-items/{other_item.pk}/", {"amount": "12.50"}, format="json")
    assert item.status_code == 200, item.data

    assert c.delete(f"/api/expense-km-trips/{trip.data['id']}/").status_code == 204


def test_other_user_and_closed_report_are_protected():
    owner = make_archie_user(username=f"own_{uuid.uuid4().hex[:6]}", password="pw")
    intruder = make_archie_user(username=f"int_{uuid.uuid4().hex[:6]}", password="pw")
    c = _client(owner)
    report_id = _report(c)
    km_item = ExpenseItem.objects.get(report_id=report_id, category=ExpenseCategory.RIMBORSO_KM)
    trip = c.post(
        "/api/expense-km-trips/",
        {"item": km_item.pk, "date": "2026-04-02", "destination": "Bologna", "km": 42},
        format="json",
    ).data

    # Le note altrui non sono nemmeno visibili.
    assert _client(intruder).delete(f"/api/expense-km-trips/{trip['id']}/").status_code == 404

    km_item.report.status = ExpenseReportStatus.INVIATA
    km_item.report.save(update_fields=["status"])
    assert c.delete(f"/api/expense-km-trips/{trip['id']}/").status_code == 403
