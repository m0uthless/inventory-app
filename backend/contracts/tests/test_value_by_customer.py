"""Azione `value_by_customer`: valore dei contratti per cliente (sezione «Valore»).

`scope=active` (default): contratti attivi non scaduti, come `active_value` di `stats`.
`scope=all`: tutto lo storico non eliminato (attivi, scaduti, chiusi), senza bozze.
Solo con `contracts.view_contract_value`.
"""
from __future__ import annotations

import pytest
from django.utils import timezone

from contracts.models import ContractStatus
from contracts.tests.test_expiry_stats import _customer, _make, _user

pytestmark = pytest.mark.django_db
URL = "/api/contracts/value-by-customer/"


def test_requires_value_permission():
    assert _user().get(URL).status_code == 403


def test_active_scope_sums_running_contracts_per_customer():
    a, b = _customer(), _customer()
    a.province = "RA"; a.save()
    _make(a, 100, value="1000.00"); _make(a, 20, value="500.00")       # attivi
    _make(a, -5, value="9000.00")                                        # scaduto
    _make(a, 100, status=ContractStatus.CHIUSO, value="7000.00")
    _make(a, 100, status=ContractStatus.BOZZA, value="8000.00")
    _make(b, 100, value="2000.00")
    rows = _user("view_contract_value").get(URL).json()["results"]
    assert [r["customer_id"] for r in rows] == [b.id, a.id]               # per valore decrescente
    ra = next(r for r in rows if r["customer_id"] == a.id)
    assert ra == {"customer_id": a.id, "customer_name": a.name, "province": "RA", "value": "1500.00", "contracts": 2}


def test_all_scope_includes_expired_and_closed_but_not_drafts():
    a = _customer()
    _make(a, 100, value="1000.00"); _make(a, -5, value="9000.00")
    _make(a, 100, status=ContractStatus.CHIUSO, value="7000.00")
    _make(a, 100, status=ContractStatus.BOZZA, value="8000.00")
    rows = _user("view_contract_value").get(URL, {"scope": "all"}).json()["results"]
    assert rows == [{"customer_id": a.id, "customer_name": a.name, "province": None, "value": "17000.00", "contracts": 3}]


def test_deleted_contracts_and_customers_without_value_are_left_out():
    a, b = _customer(), _customer()
    c = _make(a, 100, value="1000.00"); c.deleted_at = timezone.now(); c.save()
    _make(b, -5, value="300.00")                                          # solo scaduti
    assert _user("view_contract_value").get(URL).json()["results"] == []
