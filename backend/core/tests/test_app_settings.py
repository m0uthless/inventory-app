"""Impostazioni di Archie (spec 2026-11-20): registro tipizzato su AppSetting,
API riservata a superuser e permesso `core.manage_app_settings`, email di prova."""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core import mail
from rest_framework.test import APIClient

from audit.models import AuditEvent
from core.app_settings import get_setting, office_emails
from core.models import AppSetting
from core.testing import grant_via_group, make_archie_user

pytestmark = pytest.mark.django_db

User = get_user_model()
URL = "/api/app-settings/"
TEST_URL = "/api/app-settings/contracts/test-email/"


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _manager():
    return grant_via_group(make_archie_user(username=f"m_{uuid.uuid4().hex[:6]}", password="pw"), "core.manage_app_settings")


def _values(data):
    return {s["key"]: s["value"] for sec in data["sections"] for s in sec["settings"]}


def test_get_requires_permission():
    plain = make_archie_user(username=f"p_{uuid.uuid4().hex[:6]}", password="pw")
    assert _client(plain).get(URL).status_code == 403
    assert _client(_manager()).get(URL).status_code == 200
    su = User.objects.create_superuser(username=f"su_{uuid.uuid4().hex[:6]}", password="pw", email="su@example.com")
    assert _client(su).get(URL).status_code == 200


def test_get_returns_defaults_without_rows():
    data = _client(_manager()).get(URL).json()
    assert [s["key"] for s in data["sections"]] == ["contracts", "maintenance"]
    assert [s["label"] for s in data["sections"]] == ["Contratti", "Manutenzione"]
    assert _values(data) == {
        "contracts.reminder_emails": "",
        "contracts.reminder_default_days": 90,
        "contracts.reminder_every_days": 10,
        "maintenance.office_emails": "",
    }
    assert get_setting("contracts.reminder_every_days") == 10


def test_patch_normalizes_office_emails():
    resp = _client(_manager()).patch(URL, {"contracts.reminder_emails": " A@x.it ; b@y.it;;a@x.it; "}, format="json")
    assert resp.status_code == 200, resp.json()
    assert AppSetting.objects.get(key="contracts.reminder_emails").value == "a@x.it; b@y.it"
    assert office_emails() == ["a@x.it", "b@y.it"]
    assert _values(resp.json())["contracts.reminder_emails"] == "a@x.it; b@y.it"


def test_patch_rejects_invalid_email():
    resp = _client(_manager()).patch(URL, {"contracts.reminder_emails": "a@x.it; nonvalida"}, format="json")
    assert resp.status_code == 400
    assert "nonvalida" in resp.json()["contracts.reminder_emails"]
    assert not AppSetting.objects.filter(key="contracts.reminder_emails").exists()


@pytest.mark.parametrize("value", [0, 61, "dieci"])
def test_patch_rejects_out_of_range(value):
    resp = _client(_manager()).patch(URL, {"contracts.reminder_every_days": value}, format="json")
    assert resp.status_code == 400
    assert "contracts.reminder_every_days" in resp.json()


def test_patch_is_all_or_nothing():
    resp = _client(_manager()).patch(URL, {"contracts.reminder_default_days": 60, "contracts.reminder_every_days": 0}, format="json")
    assert resp.status_code == 400
    assert get_setting("contracts.reminder_default_days") == 90


def test_patch_unknown_key_400():
    resp = _client(_manager()).patch(URL, {"contracts.qualcosa": "x"}, format="json")
    assert resp.status_code == 400
    assert "contracts.qualcosa" in resp.json()


def test_patch_writes_audit():
    _client(_manager()).patch(URL, {"contracts.reminder_every_days": 7}, format="json")
    ev = AuditEvent.objects.filter(action="update").order_by("-id").first()
    assert ev is not None
    assert ev.changes["contracts.reminder_every_days"] == {"from": 10, "to": 7}


def test_soft_deleted_row_falls_back_to_default():
    from django.utils import timezone
    AppSetting.objects.create(key="contracts.reminder_every_days", value="5", deleted_at=timezone.now())
    assert get_setting("contracts.reminder_every_days") == 10


def test_test_email_sends_to_office():
    c = _client(_manager())
    c.patch(URL, {"contracts.reminder_emails": "a@x.it; b@y.it"}, format="json")
    resp = c.post(TEST_URL)
    assert resp.status_code == 200, resp.json()
    assert resp.json()["sent_to"] == ["a@x.it", "b@y.it"]
    assert mail.outbox[-1].to == ["a@x.it", "b@y.it"]


def test_test_email_without_addresses_400():
    assert _client(_manager()).post(TEST_URL).status_code == 400


def test_non_archie_user_forbidden_even_with_permission():
    user = User.objects.create_user(username=f"np_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(Permission.objects.get(codename="manage_app_settings"))
    user = User.objects.get(pk=user.pk)
    assert _client(user).get(URL).status_code == 403
