"""Test per ServiceNowCaseViewSet.triage: raggruppamento tecnici per
categoria Philips/Biotron, esclusione non-tecnici, conteggio case del
giorno, e marcatura degli assenti.
"""
import uuid
from datetime import date, time, timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from servicenow.models import (
    ServiceNowCase, ServiceNowCaseType, ServiceNowCaseCategory, TechnicianAbsence,
)

pytestmark = pytest.mark.django_db

User = get_user_model()


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


def _make_case_type(category):
    return ServiceNowCaseType.objects.create(category=category, name=f"TT{uuid.uuid4().hex[:8]}")


def _create_case_today(api_client, case_type, category, assigned_to=None, number=None):
    payload = {
        "number": number or f"CS{uuid.uuid4().hex[:8]}",
        "account": "ACME",
        "priority": "3",
        "category": category,
        "case_type": case_type.id,
        "opened_date": date.today().isoformat(),
        "opened_time": "09:00",
    }
    if assigned_to is not None:
        payload["assigned_to"] = assigned_to.id
    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post("/api/servicenow-cases/", payload, format="json")
    assert resp.status_code == 201, resp.data
    return resp.data


def test_triage_excludes_non_servicenow_technicians(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    _make_tech(is_servicenow_technician=False, name="NonTech")
    tech = _make_tech(name="RealTech")

    resp = api_client.get("/api/servicenow-cases/triage/")
    assert resp.status_code == 200, resp.data

    biotron_names = [t["name"] for t in resp.data["categories"]["biotron"]["technicians"]]
    assert "RealTech Test" in biotron_names
    assert "NonTech Test" not in biotron_names


def test_triage_splits_technicians_by_philips_flag(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    philips_tech = _make_tech(is_philips=True, name="PhilipsTech")
    biotron_tech = _make_tech(is_philips=False, name="BiotronTech")

    resp = api_client.get("/api/servicenow-cases/triage/")

    philips_names = [t["name"] for t in resp.data["categories"]["philips"]["technicians"]]
    biotron_names = [t["name"] for t in resp.data["categories"]["biotron"]["technicians"]]

    assert "PhilipsTech Test" in philips_names
    assert "PhilipsTech Test" not in biotron_names
    assert "BiotronTech Test" in biotron_names
    assert "BiotronTech Test" not in philips_names


def test_triage_counts_only_todays_cases(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    tech = _make_tech(name="Counter")
    case_type = _make_case_type(ServiceNowCaseCategory.BIOTRON)

    _create_case_today(api_client, case_type, ServiceNowCaseCategory.BIOTRON, assigned_to=tech, number="CS_TODAY")

    # Case di ieri: non deve comparire nel conteggio triage (che è solo "oggi").
    yesterday_case = ServiceNowCase.objects.create(
        number="CS_YESTERDAY", account="ACME", priority="3",
        category=ServiceNowCaseCategory.BIOTRON, case_type=case_type,
        assigned_to=tech, opened_date=date.today() - timedelta(days=1),
    )

    resp = api_client.get("/api/servicenow-cases/triage/")
    biotron_techs = {t["name"]: t["count"] for t in resp.data["categories"]["biotron"]["technicians"]}
    assert biotron_techs["Counter Test"] == 1


def test_triage_marks_absent_technician(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    tech = _make_tech(name="Absent")
    TechnicianAbsence.objects.create(
        user=tech, date_from=date.today(), date_to=date.today(), reason="ferie",
    )

    resp = api_client.get("/api/servicenow-cases/triage/")
    biotron_techs = {t["name"]: t for t in resp.data["categories"]["biotron"]["technicians"]}
    assert biotron_techs["Absent Test"]["absent"] is True
    assert biotron_techs["Absent Test"]["absence_reason"] == "Ferie"


def test_triage_hourly_absence_marks_absent_only_during_window(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    tech = _make_tech(name="Permesso")
    TechnicianAbsence.objects.create(
        user=tech, date_from=date.today(), date_to=date.today(), reason="altro",
        time_from="14:00", time_to="16:00",
    )

    with patch("servicenow.api.timezone.localtime") as mock_localtime:
        mock_localtime.return_value.time.return_value = time(15, 0)
        resp = api_client.get("/api/servicenow-cases/triage/")
    techs = {t["name"]: t for t in resp.data["categories"]["biotron"]["technicians"]}
    assert techs["Permesso Test"]["absent"] is True

    with patch("servicenow.api.timezone.localtime") as mock_localtime:
        mock_localtime.return_value.time.return_value = time(9, 0)
        resp = api_client.get("/api/servicenow-cases/triage/")
    techs = {t["name"]: t for t in resp.data["categories"]["biotron"]["technicians"]}
    assert techs["Permesso Test"]["absent"] is False


def test_triage_full_day_absence_wins_over_hourly_window(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    tech = _make_tech(name="Doppia")
    today = date.today()
    # Ferie giornata intera + un permesso orario registrato per errore lo stesso giorno:
    # deve restare "assente" per l'intera giornata, con il motivo dell'assenza principale.
    TechnicianAbsence.objects.create(user=tech, date_from=today, date_to=today, reason="ferie")
    TechnicianAbsence.objects.create(
        user=tech, date_from=today, date_to=today, reason="altro",
        time_from="14:00", time_to="16:00",
    )

    with patch("servicenow.api.timezone.localtime") as mock_localtime:
        mock_localtime.return_value.time.return_value = time(9, 0)
        resp = api_client.get("/api/servicenow-cases/triage/")
    techs = {t["name"]: t for t in resp.data["categories"]["biotron"]["technicians"]}
    assert techs["Doppia Test"]["absent"] is True
    assert techs["Doppia Test"]["absence_reason"] == "Ferie"


def test_triage_unassigned_cases_grouped_separately(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type(ServiceNowCaseCategory.BIOTRON)
    _create_case_today(api_client, case_type, ServiceNowCaseCategory.BIOTRON, number="CS_UNASSIGNED")

    resp = api_client.get("/api/servicenow-cases/triage/")
    biotron_techs = {t["name"]: t["count"] for t in resp.data["categories"]["biotron"]["technicians"]}
    assert biotron_techs.get("Non assegnato") == 1
