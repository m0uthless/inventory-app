"""Filtro `expiry` e azione `stats` dei contratti (restyle della pagina).

Il filtro traduce in query lo stesso stato calcolato da `Contract.expiry_state_on`;
`stats` dà gli indicatori della pagina. Il valore economico compare solo con
`contracts.view_contract_value`.
"""
from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from contracts.models import Contract, ContractStatus
from core.models import CustomerStatus
from crm.models import Customer

pytestmark = pytest.mark.django_db
User = get_user_model()


def _user(*perms: str):
    user = User.objects.create_user(username=f"ctr_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(*Permission.objects.filter(codename__in=["access_archie", "view_contract", *perms]))
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _customer():
    status = CustomerStatus.objects.get_or_create(key="ctr_stats_cs", defaults={"label": "Active"})[0]
    return Customer.objects.create(name=f"Ctr_{uuid.uuid4().hex[:6]}", status=status)


def _make(customer, days_to_end: int, notice_days=90, status=ContractStatus.ATTIVO, value="1000.00"):
    today = timezone.localdate()
    return Contract.objects.create(
        customer=customer, code=f"C-{uuid.uuid4().hex[:6]}", title="Contratto", status=status,
        start_date=today - timedelta(days=400), end_date=today + timedelta(days=days_to_end),
        notice_days=notice_days, total_value=value,
    )


@pytest.fixture
def contracts():
    cu = _customer()
    return {
        "expired": _make(cu, -5),
        "expiring": _make(cu, 20),
        "notice": _make(cu, 60, notice_days=90),
        "ok": _make(cu, 300, notice_days=90),
        "draft": _make(cu, 300, status=ContractStatus.BOZZA),
        "cancelled": _make(cu, 300, status=ContractStatus.DISDETTO),
    }


@pytest.mark.parametrize("state", ["expired", "expiring", "notice", "ok"])
def test_expiry_filter_matches_model_state(contracts, state):
    rows = _user().get("/api/contracts/", {"expiry": state}).data["results"]
    ids = {r["id"] for r in rows}
    assert contracts[state].id in ids
    assert all(r["expiry_state"] == state for r in rows)


def test_expiry_filter_attention_groups_notice_and_expiring(contracts):
    ids = {r["id"] for r in _user().get("/api/contracts/", {"expiry": "attention"}).data["results"]}
    assert ids == {contracts["notice"].id, contracts["expiring"].id}


def test_stats_counts_and_value_only_with_perm(contracts):
    s = _user().get("/api/contracts/stats/").data
    assert s["by_expiry"] == {"ok": 1, "notice": 1, "expiring": 1, "expired": 1}
    assert s["by_status"] == {"bozza": 1, "attivo": 4, "disdetto": 1}
    assert s["active"] == 4
    assert "active_value" not in s
    assert [d["id"] for d in s["next_deadlines"]][:3] == [contracts["expiring"].id, contracts["notice"].id, contracts["ok"].id]

    with_value = _user("view_contract_value").get("/api/contracts/stats/").data
    # Valore dei contratti attivi non ancora scaduti.
    assert with_value["active_value"] == "3000.00"
