"""Test dei modelli del modulo Contratti: scadenze e unicità del codice."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from contracts.models import Contract, ContractStatus
from core.models import CustomerStatus
from crm.models import Customer

pytestmark = pytest.mark.django_db

TODAY = date(2026, 10, 27)


def _contract(**kw):
    status = CustomerStatus.objects.get_or_create(
        key="contracts_cs", defaults={"label": "Active"},
    )[0]
    customer = kw.pop("customer", None) or Customer.objects.get_or_create(
        name="Cliente Contratti", defaults={"status": status},
    )[0]
    data = dict(
        customer=customer, code="C-1", title="Contratto", status=ContractStatus.ATTIVO,
        start_date=date(2026, 1, 1), end_date=TODAY + timedelta(days=200), notice_days=90,
    )
    data.update(kw)
    return Contract.objects.create(**data)


def test_notice_deadline():
    c = _contract(end_date=date(2027, 3, 31), notice_days=90)
    assert c.notice_deadline == date(2026, 12, 31)


@pytest.mark.parametrize("status", [ContractStatus.BOZZA, ContractStatus.DISDETTO])
def test_expiry_state_bozza_and_disdetto_are_none(status):
    c = _contract(status=status, end_date=TODAY - timedelta(days=10))
    assert c.expiry_state_on(TODAY) == "none"


def test_expiry_state_expired():
    c = _contract(end_date=date(2026, 10, 26))
    assert c.expiry_state_on(TODAY) == "expired"


def test_expiry_state_expiring():
    c = _contract(end_date=TODAY + timedelta(days=30))
    assert c.expiry_state_on(TODAY) == "expiring"
    c2 = _contract(code="C-2", end_date=TODAY + timedelta(days=31), notice_days=0)
    assert c2.expiry_state_on(TODAY) == "ok"


def test_expiry_state_notice():
    c = _contract(end_date=TODAY + timedelta(days=60), notice_days=90)
    assert c.expiry_state_on(TODAY) == "notice"


def test_expiry_state_ok():
    c = _contract(end_date=TODAY + timedelta(days=200), notice_days=90)
    assert c.expiry_state_on(TODAY) == "ok"


def test_code_unique_only_among_active():
    first = _contract(code="DUP")
    with pytest.raises(IntegrityError), transaction.atomic():
        _contract(code="DUP")
    first.deleted_at = timezone.now()
    first.save()
    assert _contract(code="DUP").pk


def test_notice_deadline_clamped_near_date_min():
    # end_date a ridosso di date.min: niente OverflowError (romperebbe la lista).
    c = _contract(code="C-MIN", end_date=date.min + timedelta(days=5), notice_days=90)
    assert c.notice_deadline == date.min
    c.expiry_state_on(TODAY)
