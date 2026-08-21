"""Test di regressione 0.9.1 (WP-05, archie-atomicworkflows — audit
2026-08-19, REL-001): ExpenseReportViewSet.perform_create creava il
report e le 12 voci fisse (una per categoria) in due passi separati senza
transaction.atomic() — se il bulk_create falliva dopo che il report era
già stato salvato, restava un ExpenseReport "orfano" senza nessuna delle
12 voci attese.
"""
import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import DatabaseError
from rest_framework.test import APIClient

from expenses.models import EXPENSE_CATEGORY_ORDER, ExpenseItem, ExpenseReport

pytestmark = pytest.mark.django_db


def _make_user():
    User = get_user_model()
    return User.objects.create_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw")


def _auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def test_create_report_generates_all_fixed_category_items():
    user = _make_user()
    client = _auth_client(user)

    resp = client.post("/api/expense-reports/", {"year": 2026, "month": 3}, format="json")
    assert resp.status_code == 201, resp.data

    report = ExpenseReport.objects.get(id=resp.data["id"])
    items = list(ExpenseItem.objects.filter(report=report).values_list("category", flat=True))
    assert sorted(items) == sorted(EXPENSE_CATEGORY_ORDER)
    assert len(items) == len(EXPENSE_CATEGORY_ORDER)


def test_create_report_is_atomic_when_items_bulk_create_fails():
    """Riproduce il bug: se bulk_create fallisce DOPO che il report è già
    stato salvato, con il fix non deve restare un report orfano senza
    voci — l'intera transazione va in rollback.

    Il test client Django propaga le eccezioni non gestite invece di
    convertirle in una risposta 500 (comportamento di default, utile qui:
    vogliamo verificare che l'eccezione esca DOPO un rollback pulito, non
    che venga silenziata da un except troppo ampio da qualche parte)."""
    user = _make_user()
    client = _auth_client(user)

    with patch(
        "expenses.api.ExpenseItem.objects.bulk_create",
        side_effect=DatabaseError("simulated failure"),
    ):
        with pytest.raises(DatabaseError):
            client.post("/api/expense-reports/", {"year": 2026, "month": 4}, format="json")

    # Nessun report deve restare a metà nel DB dopo il rollback.
    assert not ExpenseReport.objects.filter(user=user, year=2026, month=4).exists()
