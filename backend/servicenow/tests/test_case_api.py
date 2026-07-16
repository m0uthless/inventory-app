"""Test per l'API CRUD di ServiceNowCase: creazione, notifica Teams,
soft-delete/restore, filtri e vincolo di unicità sul numero case.
"""
import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from servicenow.models import ServiceNowCase, ServiceNowCaseType, ServiceNowCaseCategory

pytestmark = pytest.mark.django_db


def _make_case_type(category=ServiceNowCaseCategory.BIOTRON, name=None):
    return ServiceNowCaseType.objects.create(category=category, name=name or f"TT{uuid.uuid4().hex[:8]}")


def _case_payload(case_type, number=None, **overrides):
    payload = {
        "number": number or f"CS{uuid.uuid4().hex[:8]}",
        "account": "ACME Hospital",
        "priority": "3",
        "category": ServiceNowCaseCategory.BIOTRON,
        "case_type": case_type.id,
        "short_description": "Server down",
    }
    payload.update(overrides)
    return payload


# ─── Creazione + notifica Teams (best-effort) ────────────────────────────────

def test_create_case_triggers_teams_notification(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()

    with patch("servicenow.api.notify_teams_new_case") as mock_notify:
        response = api_client.post(
            "/api/servicenow-cases/", _case_payload(case_type), format="json",
        )

    assert response.status_code == 201, response.data
    assert mock_notify.call_count == 1
    notified_case = mock_notify.call_args.args[0]
    assert notified_case.number == response.data["number"]


def test_create_case_succeeds_even_if_teams_webhook_unreachable(api_client, superuser, settings):
    """Verifica end-to-end il comportamento best-effort: con un webhook
    configurato che fallisce a livello di rete (non la funzione di notifica
    mockata, ma la vera notify_teams_new_case con requests.post che solleva),
    la creazione del case deve comunque andare a buon fine."""
    import requests

    settings.SERVICENOW_TEAMS_WEBHOOK_URL = "https://example.com/webhook"
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()

    with patch("servicenow.notifications.requests.post", side_effect=requests.ConnectionError("down")):
        response = api_client.post(
            "/api/servicenow-cases/", _case_payload(case_type, number="CS_WEBHOOKDOWN"), format="json",
        )

    assert response.status_code == 201, response.data
    assert ServiceNowCase.objects.filter(number="CS_WEBHOOKDOWN").exists()


def test_case_number_unique_among_active_cases(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()

    with patch("servicenow.api.notify_teams_new_case"):
        r1 = api_client.post("/api/servicenow-cases/", _case_payload(case_type, number="CS_DUP"), format="json")
        assert r1.status_code == 201, r1.data
        r2 = api_client.post("/api/servicenow-cases/", _case_payload(case_type, number="CS_DUP"), format="json")
    assert r2.status_code == 400


def test_case_number_reusable_after_soft_delete(api_client, superuser):
    """Il vincolo di unicità è condizionato a deleted_at IS NULL: un numero
    case può essere riusato dopo il soft-delete del precedente."""
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()

    with patch("servicenow.api.notify_teams_new_case"):
        r1 = api_client.post("/api/servicenow-cases/", _case_payload(case_type, number="CS_REUSE"), format="json")
        assert r1.status_code == 201, r1.data
        case_id = r1.data["id"]

        del_response = api_client.delete(f"/api/servicenow-cases/{case_id}/")
        assert del_response.status_code in (200, 204), del_response.data

        r2 = api_client.post("/api/servicenow-cases/", _case_payload(case_type, number="CS_REUSE"), format="json")
    assert r2.status_code == 201, r2.data


# ─── Soft delete / restore ────────────────────────────────────────────────────

def test_delete_is_soft_not_physical(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()

    with patch("servicenow.api.notify_teams_new_case"):
        create_resp = api_client.post("/api/servicenow-cases/", _case_payload(case_type), format="json")
    case_id = create_resp.data["id"]

    api_client.delete(f"/api/servicenow-cases/{case_id}/")

    case = ServiceNowCase.objects.get(pk=case_id)
    assert case.deleted_at is not None

    list_resp = api_client.get("/api/servicenow-cases/")
    returned_ids = [c["id"] for c in list_resp.data["results"]]
    assert case_id not in returned_ids


def test_restore_brings_case_back_into_default_list(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()

    with patch("servicenow.api.notify_teams_new_case"):
        create_resp = api_client.post("/api/servicenow-cases/", _case_payload(case_type), format="json")
    case_id = create_resp.data["id"]

    api_client.delete(f"/api/servicenow-cases/{case_id}/")
    restore_resp = api_client.post(f"/api/servicenow-cases/{case_id}/restore/")
    assert restore_resp.status_code in (200, 204), restore_resp.data

    case = ServiceNowCase.objects.get(pk=case_id)
    assert case.deleted_at is None

    list_resp = api_client.get("/api/servicenow-cases/")
    returned_ids = [c["id"] for c in list_resp.data["results"]]
    assert case_id in returned_ids


# ─── Filtri ────────────────────────────────────────────────────────────────

def test_filter_by_category(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    biotron_type = _make_case_type(category=ServiceNowCaseCategory.BIOTRON)
    philips_type = _make_case_type(category=ServiceNowCaseCategory.PHILIPS)

    with patch("servicenow.api.notify_teams_new_case"):
        api_client.post(
            "/api/servicenow-cases/",
            _case_payload(biotron_type, number="CS_BIO", category=ServiceNowCaseCategory.BIOTRON),
            format="json",
        )
        api_client.post(
            "/api/servicenow-cases/",
            _case_payload(philips_type, number="CS_PHI", category=ServiceNowCaseCategory.PHILIPS),
            format="json",
        )

    resp = api_client.get("/api/servicenow-cases/", {"category": ServiceNowCaseCategory.PHILIPS})
    numbers = [c["number"] for c in resp.data["results"]]
    assert "CS_PHI" in numbers
    assert "CS_BIO" not in numbers


def test_filter_by_assigned_to(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()
    User = get_user_model()
    tech = User.objects.create_user(username=f"tech_{uuid.uuid4().hex[:6]}", password="pw")

    with patch("servicenow.api.notify_teams_new_case"):
        api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, number="CS_ASSIGNED", assigned_to=tech.id),
            format="json",
        )
        api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, number="CS_UNASSIGNED"),
            format="json",
        )

    resp = api_client.get("/api/servicenow-cases/", {"assigned_to": tech.id})
    numbers = [c["number"] for c in resp.data["results"]]
    assert numbers == ["CS_ASSIGNED"]


# ─── Permessi ────────────────────────────────────────────────────────────────

def test_anonymous_user_cannot_access_cases(api_client):
    response = api_client.get("/api/servicenow-cases/")
    assert response.status_code in (401, 403)
