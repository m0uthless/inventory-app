"""Test API Piano Ferie: roster (esclusione Philips), permessi dipendente vs
coordinatore, azione di validazione."""
import uuid
from datetime import date

import pytest
from django.contrib.auth import get_user_model

from attendance.models import Absence, AbsenceStatus, DayPart, LeaveArea

pytestmark = pytest.mark.django_db

User = get_user_model()

URL = "/api/absences/"


def _make_user(*, philips=False, coordinator=False, area=None, functional=False):
    u = User.objects.create_user(
        username=f"u-{uuid.uuid4().hex[:8]}",
        password="pw", first_name="Nome", last_name="Cognome",
    )
    prof = u.profile
    prof.is_philips = philips
    prof.is_leave_coordinator = coordinator
    prof.leave_area = area
    prof.is_functional_account = functional
    prof.save()
    return u


# ─── Roster ──────────────────────────────────────────────────────────────────

def test_roster_excludes_philips_users(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    area = LeaveArea.objects.create(key="avec", label="AVEC", sort_order=1)
    plan_user = _make_user(philips=False, area=area)
    philips_user = _make_user(philips=True)

    resp = api_client.get(f"{URL}roster/")
    assert resp.status_code == 200
    ids = {r["id"] for r in resp.data["rows"]}
    assert plan_user.id in ids
    assert philips_user.id not in ids
    assert resp.data["can_edit_all"] is True


def test_roster_excludes_functional_accounts(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    area = LeaveArea.objects.create(key="avec2", label="AVEC2", sort_order=1)
    plan_user = _make_user(philips=False, area=area)
    functional_user = _make_user(philips=False, functional=True)

    resp = api_client.get(f"{URL}roster/")
    assert resp.status_code == 200
    ids = {r["id"] for r in resp.data["rows"]}
    assert plan_user.id in ids
    assert functional_user.id not in ids


def test_functional_account_cannot_propose_own_ferie(api_client):
    functional_user = _make_user(functional=True)
    api_client.force_authenticate(user=functional_user)
    resp = api_client.post(URL, {
        "user": functional_user.id, "date": date(2026, 7, 1).isoformat(),
        "day_part": DayPart.MATTINA, "reason": "ferie",
    }, format="json")
    assert resp.status_code == 403


# ─── Permessi dipendente ─────────────────────────────────────────────────────

def test_employee_can_propose_own_ferie(api_client):
    emp = _make_user()
    api_client.force_authenticate(user=emp)
    resp = api_client.post(URL, {
        "user": emp.id, "date": date(2026, 7, 1).isoformat(),
        "day_part": DayPart.MATTINA, "reason": "ferie",
    }, format="json")
    assert resp.status_code == 201, resp.data
    obj = Absence.objects.get(pk=resp.data["id"])
    assert obj.status == AbsenceStatus.PROPOSTA
    assert obj.created_by_id == emp.id


def test_employee_cannot_set_other_reason(api_client):
    emp = _make_user()
    api_client.force_authenticate(user=emp)
    resp = api_client.post(URL, {
        "user": emp.id, "date": date(2026, 7, 1).isoformat(),
        "day_part": DayPart.MATTINA, "reason": "malattia",
    }, format="json")
    assert resp.status_code == 400


def test_employee_cannot_create_for_another_user(api_client):
    emp = _make_user()
    other = _make_user()
    api_client.force_authenticate(user=emp)
    resp = api_client.post(URL, {
        "user": other.id, "date": date(2026, 7, 1).isoformat(),
        "day_part": DayPart.MATTINA, "reason": "ferie",
    }, format="json")
    assert resp.status_code == 400


def test_employee_cannot_validate(api_client):
    emp = _make_user()
    api_client.force_authenticate(user=emp)
    absence = Absence.objects.create(
        user=emp, date=date(2026, 7, 2), day_part=DayPart.MATTINA, reason="ferie",
    )
    resp = api_client.post(f"{URL}{absence.id}/validate/")
    assert resp.status_code == 403
    absence.refresh_from_db()
    assert absence.status == AbsenceStatus.PROPOSTA


# ─── Coordinatore ────────────────────────────────────────────────────────────

def test_coordinator_can_add_activity_and_validate(api_client):
    coord = _make_user(coordinator=True)
    emp = _make_user()
    api_client.force_authenticate(user=coord)

    # Il coordinatore inserisce un'attività (training) per un altro utente.
    resp = api_client.post(URL, {
        "user": emp.id, "date": date(2026, 7, 3).isoformat(),
        "day_part": DayPart.POMERIGGIO, "reason": "training", "status": "validata",
    }, format="json")
    assert resp.status_code == 201, resp.data
    obj = Absence.objects.get(pk=resp.data["id"])
    assert obj.status == AbsenceStatus.VALIDATA
    assert obj.validated_by_id == coord.id
    assert obj.validated_at is not None

    # Valida una proposta di ferie esistente.
    proposta = Absence.objects.create(
        user=emp, date=date(2026, 7, 4), day_part=DayPart.MATTINA, reason="ferie",
    )
    resp = api_client.post(f"{URL}{proposta.id}/validate/")
    assert resp.status_code == 200
    proposta.refresh_from_db()
    assert proposta.status == AbsenceStatus.VALIDATA
    assert proposta.validated_by_id == coord.id
