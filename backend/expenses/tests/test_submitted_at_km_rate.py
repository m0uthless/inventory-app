"""Restyle Nota spese: data di invio (`submitted_at`) e tariffa €/km del
proprietario della nota (`km_rate`) nel serializer."""
import uuid
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from expenses.models import ExpenseItem, TechnicianKmRate
from core.testing import make_archie_user as _make_archie_user


def make_archie_user(*args, **kwargs):
    """Utente Archie con l'accesso al modulo (expenses): dal 21/11 i permessi contano davvero."""
    from django.contrib.auth.models import Permission

    u = _make_archie_user(*args, **kwargs)
    u.user_permissions.add(*Permission.objects.filter(content_type__app_label="expenses", codename__in=["view_expensereport", "add_expensereport"]))
    return type(u).objects.get(pk=u.pk)

pytestmark = pytest.mark.django_db


def _user(**kw):
    return make_archie_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw", **kw)


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _report_with_amount(client):
    r = client.post("/api/expense-reports/", {"year": 2026, "month": 10}, format="json")
    assert r.status_code == 201, r.data
    ExpenseItem.objects.filter(report_id=r.data["id"], category="pasti").update(amount=Decimal("12.50"))
    return r.data["id"]


def test_submit_sets_submitted_at_and_reject_keeps_it():
    owner = _user()
    sec = _user(is_staff=True)
    c = _client(owner)
    rid = _report_with_amount(c)

    data = c.get(f"/api/expense-reports/{rid}/").data
    assert data["submitted_at"] is None

    sent = c.post(f"/api/expense-reports/{rid}/submit/").data
    assert sent["status"] == "inviata"
    assert sent["submitted_at"] is not None

    rejected = _client(sec).post(f"/api/expense-reports/{rid}/reject/", {"reason": "Manca uno scontrino"}, format="json").data
    assert rejected["status"] == "rifiutata"
    assert rejected["submitted_at"] == sent["submitted_at"]


def test_km_rate_is_the_owner_rate_not_the_viewer():
    owner = _user()
    sec = _user(is_staff=True)
    TechnicianKmRate.objects.create(user=owner, rate_per_km=Decimal("0.420"))
    TechnicianKmRate.objects.create(user=sec, rate_per_km=Decimal("0.300"))
    rid = _report_with_amount(_client(owner))

    as_sec = _client(sec).get(f"/api/expense-reports/{rid}/").data
    assert as_sec["km_rate"] == "0.420"

    other = _user()
    rid2 = _client(other).post("/api/expense-reports/", {"year": 2026, "month": 9}, format="json").data["id"]
    assert _client(other).get(f"/api/expense-reports/{rid2}/").data["km_rate"] is None
