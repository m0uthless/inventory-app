"""Test per l'email di assegnazione inviata da ServiceNowCaseViewSet.perform_create.

Copre: email solo se c'è un assegnatario con email valorizzata, nessun
broadcast, nessuna email per i case Philips in modalità "modal" (stessa
guardia già usata per Teams), email regolare per i case Philips in modalità
"teams" (default).
"""
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core import mail

from servicenow.models import ServiceNowCase, ServiceNowCaseType, ServiceNowCaseCategory
from servicenow.notifications import PHILIPS_NOTIFY_MODE_MODAL, PHILIPS_NOTIFY_MODE_TEAMS

pytestmark = pytest.mark.django_db

User = get_user_model()


def _make_case_type(category=ServiceNowCaseCategory.BIOTRON, name=None):
    import uuid
    return ServiceNowCaseType.objects.get_or_create(
        category=category, name=name or f"TT{uuid.uuid4().hex[:8]}",
    )[0]


def _case_payload(case_type, **overrides):
    import uuid
    payload = {
        "number": f"CS{uuid.uuid4().hex[:8]}",
        "account": "ACME Hospital",
        "priority": "3",
        "category": ServiceNowCaseCategory.BIOTRON,
        "case_type": case_type.id,
        "short_description": "Server down",
    }
    payload.update(overrides)
    return payload


def test_case_with_assignee_sends_email(api_client, superuser):
    assignee = User.objects.create_user(username="tech1", password="pw", email="tech1@example.com")
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()

    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, assigned_to=assignee.id),
            format="json",
        )
    assert resp.status_code == 201, resp.data

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["tech1@example.com"]
    assert resp.data["number"] in mail.outbox[0].alternatives[0][0]


def test_case_without_assignee_sends_no_email(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()

    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post("/api/servicenow-cases/", _case_payload(case_type), format="json")
    assert resp.status_code == 201, resp.data

    assert len(mail.outbox) == 0


def test_assignee_without_email_is_silently_skipped(api_client, superuser):
    assignee = User.objects.create_user(username="tech1", password="pw", email="")
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type()

    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, assigned_to=assignee.id),
            format="json",
        )
    assert resp.status_code == 201, resp.data

    assert len(mail.outbox) == 0


def test_philips_modal_mode_skips_email(api_client, superuser, settings):
    settings.SERVICENOW_PHILIPS_NOTIFY_MODE = PHILIPS_NOTIFY_MODE_MODAL
    assignee = User.objects.create_user(username="tech1", password="pw", email="tech1@example.com")
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type(category=ServiceNowCaseCategory.PHILIPS)

    resp = api_client.post(
        "/api/servicenow-cases/",
        _case_payload(case_type, category=ServiceNowCaseCategory.PHILIPS, assigned_to=assignee.id),
        format="json",
    )
    assert resp.status_code == 201, resp.data

    assert len(mail.outbox) == 0


def test_philips_teams_mode_sends_email_normally(api_client, superuser, settings):
    settings.SERVICENOW_PHILIPS_NOTIFY_MODE = PHILIPS_NOTIFY_MODE_TEAMS
    assignee = User.objects.create_user(username="tech1", password="pw", email="tech1@example.com")
    api_client.force_authenticate(user=superuser)
    case_type = _make_case_type(category=ServiceNowCaseCategory.PHILIPS)

    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/",
            _case_payload(case_type, category=ServiceNowCaseCategory.PHILIPS, assigned_to=assignee.id),
            format="json",
        )
    assert resp.status_code == 201, resp.data

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["tech1@example.com"]
