"""Test per ServiceNowCaseViewSet.stats_export_pdf: stesso filtro di
stats/, output un PDF scaricabile con Content-Disposition corretto.
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


def _create_case(api_client, case_type, *, opened_date, category=ServiceNowCaseCategory.BIOTRON, assigned_to=None):
    payload = {
        "number": f"CS{uuid.uuid4().hex[:8]}", "account": "ACME", "priority": "3",
        "category": category, "case_type": case_type.id, "opened_date": opened_date.isoformat(),
    }
    if assigned_to is not None:
        payload["assigned_to"] = assigned_to.id
    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post("/api/servicenow-cases/", payload, format="json")
    assert resp.status_code == 201, resp.data
    return resp.data


def test_export_pdf_returns_pdf_content_type_and_disposition(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()
    tech = _make_tech()
    _create_case(api_client, case_type, opened_date=date(2026, 8, 1), assigned_to=tech)

    resp = api_client.get("/api/servicenow-cases/stats-export-pdf/", {"year": 2026, "granularity": "month"})
    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/pdf"
    assert resp["Content-Disposition"].startswith("attachment;")
    assert resp["Content-Disposition"].endswith('.pdf"')
    # Un PDF valido inizia sempre con questa signature.
    assert resp.content[:5] == b"%PDF-"


def test_export_pdf_filename_includes_category_and_year(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type(ServiceNowCaseCategory.PHILIPS)
    _create_case(api_client, case_type, opened_date=date(2026, 3, 1), category=ServiceNowCaseCategory.PHILIPS)

    resp = api_client.get(
        "/api/servicenow-cases/stats-export-pdf/",
        {"year": 2026, "granularity": "month", "category": "philips"},
    )
    assert resp.status_code == 200
    assert "philips" in resp["Content-Disposition"]
    assert "2026" in resp["Content-Disposition"]


def test_export_pdf_respects_same_filters_as_stats_json(api_client, superuser):
    """Le due action condividono _compute_stats(): un filtro che esclude
    tutto in stats/ deve produrre un PDF 'vuoto' coerente, non un errore."""
    api_client.force_authenticate(user=superuser)

    resp = api_client.get("/api/servicenow-cases/stats-export-pdf/", {"year": 2099, "granularity": "month"})
    assert resp.status_code == 200
    assert resp.content[:5] == b"%PDF-"


def test_export_pdf_handles_many_technicians_across_pages(api_client, superuser):
    """Con molte righe (tecnici) il report deve gestire il page-break senza
    errori (ensure_space) invece di sforare il margine inferiore."""
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()
    for i in range(60):
        tech = _make_tech(f"T{i}")
        _create_case(api_client, case_type, opened_date=date(2026, 9, 1), assigned_to=tech)

    resp = api_client.get("/api/servicenow-cases/stats-export-pdf/", {"year": 2026, "granularity": "month"})
    assert resp.status_code == 200
    assert resp.content[:5] == b"%PDF-"


def test_export_pdf_requires_authentication(api_client):
    resp = api_client.get("/api/servicenow-cases/stats-export-pdf/")
    assert resp.status_code in (401, 403)
