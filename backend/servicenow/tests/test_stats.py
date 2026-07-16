"""Test per ServiceNowCaseViewSet.stats: aggregazione per mese/settimana/
giorno, filtri (categoria, type, tecnico) e KPI (totale, top tecnico, top type).
"""
import uuid
from datetime import date
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from servicenow.models import ServiceNowCaseType, ServiceNowCaseCategory

pytestmark = pytest.mark.django_db

User = get_user_model()


def _make_tech(name="Tech"):
    return User.objects.create_user(
        username=f"{name.lower()}_{uuid.uuid4().hex[:6]}", password="pw",
        first_name=name, last_name="Test",
    )


def _make_case_type(category=ServiceNowCaseCategory.BIOTRON, name=None):
    return ServiceNowCaseType.objects.create(category=category, name=name or f"TT{uuid.uuid4().hex[:8]}")


def _create_case(api_client, case_type, *, opened_date, category=ServiceNowCaseCategory.BIOTRON,
                  assigned_to=None, number=None):
    payload = {
        "number": number or f"CS{uuid.uuid4().hex[:8]}",
        "account": "ACME",
        "priority": "3",
        "category": category,
        "case_type": case_type.id,
        "opened_date": opened_date.isoformat(),
    }
    if assigned_to is not None:
        payload["assigned_to"] = assigned_to.id
    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post("/api/servicenow-cases/", payload, format="json")
    assert resp.status_code == 201, resp.data
    return resp.data


def test_stats_month_granularity_groups_by_month(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()
    tech = _make_tech()

    _create_case(api_client, case_type, opened_date=date(2026, 1, 15), assigned_to=tech)
    _create_case(api_client, case_type, opened_date=date(2026, 1, 20), assigned_to=tech)
    _create_case(api_client, case_type, opened_date=date(2026, 3, 5), assigned_to=tech)

    resp = api_client.get("/api/servicenow-cases/stats/", {"year": 2026, "granularity": "month"})
    assert resp.status_code == 200, resp.data
    assert resp.data["periods"][0]["label"] == "Gen"
    assert len(resp.data["periods"]) == 12

    series = resp.data["series"]
    assert len(series) == 1
    counts = series[0]["counts"]
    assert counts[0] == 2   # gennaio
    assert counts[2] == 1   # marzo
    assert resp.data["kpi"]["total"] == 3


def test_stats_filters_by_category(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    biotron_type = _make_case_type(ServiceNowCaseCategory.BIOTRON)
    philips_type = _make_case_type(ServiceNowCaseCategory.PHILIPS)

    _create_case(api_client, biotron_type, opened_date=date(2026, 2, 1), category=ServiceNowCaseCategory.BIOTRON)
    _create_case(api_client, philips_type, opened_date=date(2026, 2, 1), category=ServiceNowCaseCategory.PHILIPS)

    resp = api_client.get(
        "/api/servicenow-cases/stats/",
        {"year": 2026, "granularity": "month", "category": "philips"},
    )
    assert resp.data["kpi"]["total"] == 1


def test_stats_filters_by_assigned_to(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()
    tech_a = _make_tech("Alice")
    tech_b = _make_tech("Bob")

    _create_case(api_client, case_type, opened_date=date(2026, 4, 1), assigned_to=tech_a)
    _create_case(api_client, case_type, opened_date=date(2026, 4, 2), assigned_to=tech_b)

    resp = api_client.get(
        "/api/servicenow-cases/stats/",
        {"year": 2026, "granularity": "month", "assigned_to": tech_a.id},
    )
    assert resp.data["kpi"]["total"] == 1
    assert resp.data["series"][0]["user_id"] == tech_a.id


def test_stats_filters_by_case_type(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    type_l1 = _make_case_type()
    type_l2 = _make_case_type()

    _create_case(api_client, type_l1, opened_date=date(2026, 5, 1))
    _create_case(api_client, type_l2, opened_date=date(2026, 5, 1))

    resp = api_client.get(
        "/api/servicenow-cases/stats/",
        {"year": 2026, "granularity": "month", "case_type": type_l1.id},
    )
    assert resp.data["kpi"]["total"] == 1


def test_stats_week_granularity(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()
    # 2026-01-05 è un lunedì di ISO week 2 del 2026.
    _create_case(api_client, case_type, opened_date=date(2026, 1, 5))

    resp = api_client.get("/api/servicenow-cases/stats/", {"year": 2026, "granularity": "week"})
    assert resp.status_code == 200
    assert resp.data["kpi"]["total"] == 1
    assert resp.data["granularity"] == "week"


def test_stats_day_granularity_requires_month_and_marks_absences(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()
    tech = _make_tech()
    _create_case(api_client, case_type, opened_date=date(2026, 6, 10), assigned_to=tech)

    from servicenow.models import TechnicianAbsence
    TechnicianAbsence.objects.create(
        user=tech, date_from=date(2026, 6, 10), date_to=date(2026, 6, 10), reason="malattia",
    )

    resp = api_client.get(
        "/api/servicenow-cases/stats/",
        {"year": 2026, "granularity": "day", "month": 6},
    )
    assert resp.status_code == 200
    assert resp.data["periods"][0]["label"] == "1"
    assert len(resp.data["periods"]) == 30  # giugno ha 30 giorni

    series = resp.data["series"][0]
    day_10_index = 9  # giorno 10 -> indice 9 (periods parte da 1)
    assert series["absent_periods"][day_10_index] is True


def test_stats_top_technician_and_top_type_kpi(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()
    tech_a = _make_tech("Alice")
    tech_b = _make_tech("Bob")

    _create_case(api_client, case_type, opened_date=date(2026, 7, 1), assigned_to=tech_a)
    _create_case(api_client, case_type, opened_date=date(2026, 7, 2), assigned_to=tech_a)
    _create_case(api_client, case_type, opened_date=date(2026, 7, 3), assigned_to=tech_b)

    resp = api_client.get("/api/servicenow-cases/stats/", {"year": 2026, "granularity": "month"})
    assert resp.data["kpi"]["top_technician"]["id"] == tech_a.id
    assert resp.data["kpi"]["top_technician"]["count"] == 2
    assert resp.data["kpi"]["top_type"]["count"] == 3


def test_stats_empty_period_returns_zero_kpi(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    resp = api_client.get("/api/servicenow-cases/stats/", {"year": 2099, "granularity": "month"})
    assert resp.status_code == 200
    assert resp.data["kpi"]["total"] == 0
    assert resp.data["kpi"]["top_technician"] is None
    assert resp.data["series"] == []
