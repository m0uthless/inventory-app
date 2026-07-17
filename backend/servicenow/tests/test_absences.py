"""Test per TechnicianAbsenceViewSet: assenze orarie (permesso), PATCH e
l'action 'technicians' usata dalla pagina calendario 'Assenze tecnici'.
"""
import uuid
from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model

from servicenow.models import TechnicianAbsence

pytestmark = pytest.mark.django_db

User = get_user_model()

URL = "/api/technician-absences/"


def _make_tech(*, is_philips=False, is_servicenow_technician=True, name="Tech"):
    user = User.objects.create_user(
        username=f"{name.lower()}_{uuid.uuid4().hex[:6]}",
        password="pw",
        first_name=name,
        last_name="Test",
    )
    user.profile.is_philips = is_philips
    user.profile.is_servicenow_technician = is_servicenow_technician
    user.profile.save(update_fields=["is_philips", "is_servicenow_technician"])
    return user


# ─── Creazione assenza oraria ─────────────────────────────────────────────────

def test_create_hourly_absence_ok(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    tech = _make_tech(name="Rossi")
    today = date.today().isoformat()
    resp = api_client.post(URL, {
        "user": tech.id, "date_from": today, "date_to": today,
        "reason": "altro", "time_from": "14:00", "time_to": "16:00",
    }, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["is_hourly"] is True

    absence = TechnicianAbsence.objects.get(pk=resp.data["id"])
    assert absence.is_hourly is True


def test_hourly_absence_requires_both_times(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    tech = _make_tech(name="Bianchi")
    today = date.today().isoformat()
    resp = api_client.post(URL, {
        "user": tech.id, "date_from": today, "date_to": today,
        "reason": "altro", "time_from": "14:00",
    }, format="json")
    assert resp.status_code == 400


def test_hourly_absence_rejects_multi_day_range(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    tech = _make_tech(name="Verdi")
    today = date.today()
    resp = api_client.post(URL, {
        "user": tech.id,
        "date_from": today.isoformat(),
        "date_to": (today + timedelta(days=1)).isoformat(),
        "reason": "altro", "time_from": "09:00", "time_to": "10:00",
    }, format="json")
    assert resp.status_code == 400


def test_hourly_absence_rejects_end_before_start(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    tech = _make_tech(name="Neri")
    today = date.today().isoformat()
    resp = api_client.post(URL, {
        "user": tech.id, "date_from": today, "date_to": today,
        "reason": "altro", "time_from": "16:00", "time_to": "14:00",
    }, format="json")
    assert resp.status_code == 400


def test_full_day_absence_still_works_without_time_fields(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    tech = _make_tech(name="Gialli")
    today = date.today()
    resp = api_client.post(URL, {
        "user": tech.id,
        "date_from": today.isoformat(),
        "date_to": (today + timedelta(days=2)).isoformat(),
        "reason": "ferie",
    }, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["is_hourly"] is False


# ─── PATCH ─────────────────────────────────────────────────────────────────────

def test_patch_updates_time_range(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    tech = _make_tech(name="Blu")
    today = date.today()
    absence = TechnicianAbsence.objects.create(
        user=tech, date_from=today, date_to=today,
        reason="altro", time_from="09:00", time_to="10:00",
    )
    resp = api_client.patch(f"{URL}{absence.id}/", {"time_to": "11:00"}, format="json")
    assert resp.status_code == 200, resp.data
    absence.refresh_from_db()
    assert absence.time_to.strftime("%H:%M") == "11:00"


# ─── Action technicians ────────────────────────────────────────────────────────

def test_technicians_action_lists_only_servicenow_technicians(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    tech_philips = _make_tech(is_philips=True, name="Filippo")
    tech_biotron = _make_tech(is_philips=False, name="Biagio")
    _make_tech(is_servicenow_technician=False, name="Escluso")

    resp = api_client.get(f"{URL}technicians/")
    assert resp.status_code == 200
    ids = {row["id"]: row["category"] for row in resp.data}
    assert ids[tech_philips.id] == "philips"
    assert ids[tech_biotron.id] == "biotron"
    assert all(row["name"] != "Escluso Test" for row in resp.data)
