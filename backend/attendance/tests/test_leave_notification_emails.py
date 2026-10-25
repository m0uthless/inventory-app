"""Email sul workflow di approvazione del Piano Ferie (Absence).

Copre: 1 email ai coordinatori alla submission (anche per richieste
multi-giorno via bulk, non N), 1 email al richiedente all'esito
(validazione di gruppo / rifiuto singolo), skip auto-notifica, niente
email per righe create già VALIDATA da un coordinatore.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core import mail

from attendance.models import Absence, AbsenceReason, AbsenceStatus, DayPart

pytestmark = pytest.mark.django_db

User = get_user_model()
URL = "/api/absences/"


def _make_user(*, coordinator=False, email="user@example.com"):
    u = User.objects.create_user(
        username=f"u-{uuid.uuid4().hex[:8]}", password="pw",
        first_name="Nome", last_name="Cognome", email=email,
    )
    prof = u.profile
    prof.is_leave_coordinator = coordinator
    prof.save()
    return u


def test_employee_submits_single_proposal_emails_coordinator(api_client):
    coord = _make_user(coordinator=True, email="coord@example.com")
    emp = _make_user(email="emp@example.com")
    api_client.force_authenticate(user=emp)

    resp = api_client.post(URL, {"user": emp.id, "date": "2026-10-01", "day_part": DayPart.MATTINA}, format="json")
    assert resp.status_code == 201, resp.data

    assert [m.to for m in mail.outbox] == [["coord@example.com"]]
    assert "Nome" in mail.outbox[0].subject


def test_multi_day_bulk_submission_sends_single_email(api_client):
    coord = _make_user(coordinator=True, email="coord@example.com")
    emp = _make_user(email="emp@example.com")
    api_client.force_authenticate(user=emp)

    resp = api_client.post(f"{URL}bulk/", {
        "user": emp.id,
        "day_part": "entrambe",
        "dates": ["2026-10-05", "2026-10-06", "2026-10-07"],
        "action": "set",
    }, format="json")
    assert resp.status_code == 200, resp.data

    assert len(mail.outbox) == 1  # una richiesta = una email, non 6 righe
    assert mail.outbox[0].to == ["coord@example.com"]


def test_validate_group_emails_requester_once(api_client):
    coord = _make_user(coordinator=True, email="coord@example.com")
    emp = _make_user(email="emp@example.com")
    group = uuid.uuid4()
    for d in ("2026-10-10", "2026-10-11"):
        Absence.objects.create(
            user=emp, date=d, day_part=DayPart.MATTINA,
            reason=AbsenceReason.FERIE, status=AbsenceStatus.PROPOSTA, request_group=group,
        )
    mail.outbox.clear()
    api_client.force_authenticate(user=coord)

    resp = api_client.post(f"{URL}validate-group/", {"request_group": str(group)}, format="json")
    assert resp.status_code == 200, resp.data

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["emp@example.com"]
    assert "validata" in mail.outbox[0].subject


def test_reject_single_entry_emails_requester(api_client):
    coord = _make_user(coordinator=True, email="coord@example.com")
    emp = _make_user(email="emp@example.com")
    a = Absence.objects.create(
        user=emp, date="2026-10-15", day_part=DayPart.POMERIGGIO,
        reason=AbsenceReason.FERIE, status=AbsenceStatus.PROPOSTA, request_group=uuid.uuid4(),
    )
    mail.outbox.clear()
    api_client.force_authenticate(user=coord)

    resp = api_client.post(f"{URL}{a.id}/reject/", {}, format="json")
    assert resp.status_code == 200, resp.data

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["emp@example.com"]
    assert "rifiutata" in mail.outbox[0].subject


def test_coordinator_validating_own_request_gets_no_self_email(api_client):
    coord = _make_user(coordinator=True, email="coord@example.com")
    a = Absence.objects.create(
        user=coord, date="2026-10-20", day_part=DayPart.MATTINA,
        reason=AbsenceReason.FERIE, status=AbsenceStatus.PROPOSTA, request_group=uuid.uuid4(),
    )
    mail.outbox.clear()
    api_client.force_authenticate(user=coord)

    resp = api_client.post(f"{URL}{a.id}/validate/", {}, format="json")
    assert resp.status_code == 200, resp.data

    assert mail.outbox == []


def test_coordinator_bulk_entry_as_validata_sends_no_submission_email(api_client):
    coord = _make_user(coordinator=True, email="coord@example.com")
    emp = _make_user(email="emp@example.com")
    api_client.force_authenticate(user=coord)

    resp = api_client.post(f"{URL}bulk/", {
        "user": emp.id,
        "day_part": DayPart.MATTINA,
        "dates": ["2026-10-25"],
        "action": "set",
        "reason": AbsenceReason.MALATTIA,
        "status": AbsenceStatus.VALIDATA,
    }, format="json")
    assert resp.status_code == 200, resp.data

    assert mail.outbox == []
