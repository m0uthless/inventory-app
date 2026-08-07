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


# ─── Ora apertura richiesta insieme alla data ────────────────────────────────

def test_create_case_with_opened_date_requires_opened_time(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()

    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, opened_date="2026-07-17"),
            format="json",
        )
    assert resp.status_code == 400
    assert "opened_time" in resp.data


def test_create_case_with_opened_date_and_time_succeeds(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()

    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, opened_date="2026-07-17", opened_time="14:30"),
            format="json",
        )
    assert resp.status_code == 201, resp.data
    assert resp.data["opened_time"] == "14:30:00"


def test_create_case_without_opened_date_does_not_require_opened_time(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()

    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/", _case_payload(case_type), format="json",
        )
    assert resp.status_code == 201, resp.data
    assert resp.data["opened_time"] is None


def test_patch_changing_opened_date_keeps_existing_opened_time(api_client, superuser):
    """PATCH che cambia solo la data non deve richiedere di reinviare l'ora
    se il case ha già un opened_time valido."""
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()
    case = ServiceNowCase.objects.create(
        number=f"CS{uuid.uuid4().hex[:8]}", account="ACME", priority="3",
        category=ServiceNowCaseCategory.BIOTRON, case_type=case_type,
        opened_date="2026-01-10", opened_time="09:00",
    )

    resp = api_client.patch(f"/api/servicenow-cases/{case.id}/", {"opened_date": "2026-01-11"}, format="json")
    assert resp.status_code == 200, resp.data
    assert resp.data["opened_time"] == "09:00:00"


def test_patch_setting_opened_date_on_case_without_time_requires_opened_time(api_client, superuser):
    """PATCH che imposta/cambia opened_date su un case senza opened_time
    valorizzata deve invece richiederla esplicitamente."""
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()
    case = ServiceNowCase.objects.create(
        number=f"CS{uuid.uuid4().hex[:8]}", account="ACME", priority="3",
        category=ServiceNowCaseCategory.BIOTRON, case_type=case_type,
        opened_date="2026-01-10",  # opened_time volutamente assente
    )

    resp = api_client.patch(f"/api/servicenow-cases/{case.id}/", {"opened_date": "2026-01-11"}, format="json")
    assert resp.status_code == 400
    assert "opened_time" in resp.data


def test_patch_unrelated_field_does_not_require_opened_time_on_old_case(api_client, superuser):
    """Un case storico, creato prima di questa funzionalità, può avere
    opened_date valorizzata e opened_time nulla: un PATCH che non tocca
    questi campi non deve rompersi per una validazione retroattiva."""
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()
    case = ServiceNowCase.objects.create(
        number=f"CS{uuid.uuid4().hex[:8]}", account="ACME", priority="3",
        category=ServiceNowCaseCategory.BIOTRON, case_type=case_type,
        opened_date="2026-01-10",  # opened_time volutamente assente
    )

    resp = api_client.patch(f"/api/servicenow-cases/{case.id}/", {"account": "ACME 2"}, format="json")
    assert resp.status_code == 200, resp.data


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


# ─── Switch Philips: notifica Teams vs modal (TEMPORANEO in prova) ──────────

def test_create_biotron_case_always_triggers_teams_notification_regardless_of_philips_mode(api_client, superuser, settings):
    """Lo switch SERVICENOW_PHILIPS_NOTIFY_MODE non deve mai toccare i case
    Biotron, qualunque sia il suo valore."""
    settings.SERVICENOW_PHILIPS_NOTIFY_MODE = "modal"
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type(category=ServiceNowCaseCategory.BIOTRON)

    with patch("servicenow.api.notify_teams_new_case") as mock_notify:
        response = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, category=ServiceNowCaseCategory.BIOTRON),
            format="json",
        )

    assert response.status_code == 201, response.data
    assert mock_notify.call_count == 1


def test_create_philips_case_triggers_teams_notification_when_mode_is_teams(api_client, superuser, settings):
    settings.SERVICENOW_PHILIPS_NOTIFY_MODE = "teams"
    api_client.force_authenticate(user=superuser)
    philips_type = _make_case_type(category=ServiceNowCaseCategory.PHILIPS)

    with patch("servicenow.api.notify_teams_new_case") as mock_notify:
        response = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(philips_type, category=ServiceNowCaseCategory.PHILIPS),
            format="json",
        )

    assert response.status_code == 201, response.data
    assert mock_notify.call_count == 1


def test_create_philips_case_skips_teams_notification_when_mode_is_modal(api_client, superuser, settings):
    settings.SERVICENOW_PHILIPS_NOTIFY_MODE = "modal"
    api_client.force_authenticate(user=superuser)
    philips_type = _make_case_type(category=ServiceNowCaseCategory.PHILIPS)

    with patch("servicenow.api.notify_teams_new_case") as mock_notify:
        response = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(philips_type, category=ServiceNowCaseCategory.PHILIPS),
            format="json",
        )

    assert response.status_code == 201, response.data
    assert mock_notify.call_count == 0


def test_notification_settings_endpoint_reports_current_mode(api_client, superuser, settings):
    settings.SERVICENOW_PHILIPS_NOTIFY_MODE = "modal"
    api_client.force_authenticate(user=superuser)

    response = api_client.get("/api/servicenow-cases/notification-settings/")

    assert response.status_code == 200, response.data
    assert response.data == {"philips_notify_mode": "modal"}


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


# ─── Fallback automatico jolly.philips per case Philips senza assegnatario ──

def _make_service_user(username, first_name="Servizio"):
    User = get_user_model()
    return User.objects.create_user(username=username, password="pw", first_name=first_name, last_name=username)


def test_create_philips_case_without_assignee_falls_back_to_jolly_philips(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    fallback = _make_service_user("jolly.philips")
    case_type = _make_case_type(category=ServiceNowCaseCategory.PHILIPS, name="L1")

    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, category=ServiceNowCaseCategory.PHILIPS),
            format="json",
        )
    assert resp.status_code == 201, resp.data
    assert resp.data["assigned_to"] == fallback.id


def test_create_philips_case_with_explicit_assignee_is_not_overridden(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    _make_service_user("jolly.philips")
    real_tech = _make_service_user("mario.rossi", first_name="Mario")
    case_type = _make_case_type(category=ServiceNowCaseCategory.PHILIPS, name="L1")

    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, category=ServiceNowCaseCategory.PHILIPS, assigned_to=real_tech.id),
            format="json",
        )
    assert resp.status_code == 201, resp.data
    assert resp.data["assigned_to"] == real_tech.id


def test_create_philips_case_without_jolly_user_stays_unassigned(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type(category=ServiceNowCaseCategory.PHILIPS, name="L1")

    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, category=ServiceNowCaseCategory.PHILIPS),
            format="json",
        )
    assert resp.status_code == 201, resp.data
    assert resp.data["assigned_to"] is None


def test_create_biotron_case_without_assignee_never_gets_philips_fallback(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    _make_service_user("jolly.philips")
    case_type = _make_case_type(category=ServiceNowCaseCategory.BIOTRON)

    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, category=ServiceNowCaseCategory.BIOTRON),
            format="json",
        )
    assert resp.status_code == 201, resp.data
    assert resp.data["assigned_to"] is None


def test_unassigning_existing_philips_case_via_patch_is_not_reverted(api_client, superuser):
    # Il fallback scatta SOLO in creazione: un unassign volontario successivo
    # (PATCH) non deve essere silenziosamente riassegnato a jolly.philips.
    api_client.force_authenticate(user=superuser)
    _make_service_user("jolly.philips")
    real_tech = _make_service_user("mario.rossi", first_name="Mario")
    case_type = _make_case_type(category=ServiceNowCaseCategory.PHILIPS, name="L1")

    with patch("servicenow.api.notify_teams_new_case"):
        create_resp = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, category=ServiceNowCaseCategory.PHILIPS, assigned_to=real_tech.id),
            format="json",
        )
    case_id = create_resp.data["id"]

    patch_resp = api_client.patch(f"/api/servicenow-cases/{case_id}/", {"assigned_to": None}, format="json")
    assert patch_resp.status_code == 200, patch_resp.data
    assert patch_resp.data["assigned_to"] is None
