"""Pagina «Moduli»: un superuser spegne un modulo per tutti gli altri."""
from __future__ import annotations

from datetime import date

import pytest
from django.contrib.auth.models import Permission
from django.core.management import call_command
from rest_framework.test import APIClient

from audit.models import AuditEvent
from core.models import ModuleSwitch
from core.modules import MODULES, disabled_modules, module_for_path
from core.testing import make_archie_user

pytestmark = pytest.mark.django_db


def _client(user) -> APIClient:
    c = APIClient()
    c.force_login(user)
    return c


def _staffer(*perms: str):
    user = make_archie_user(username="staffer", password="pw")
    for perm in perms:
        app_label, codename = perm.split(".")
        user.user_permissions.add(Permission.objects.get(content_type__app_label=app_label, codename=codename))
    return user


def _switch_off(key: str, reason: str = "") -> None:
    ModuleSwitch.objects.update_or_create(key=key, defaults={"enabled": False, "reason": reason})


# ── Registro ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    ("path", "key"),
    [
        ("/api/absences/", "leave"),
        ("/api/absences/bulk/", "leave"),
        ("/api/leave-holidays/", "leave"),
        ("/api/issues/12/", "issues"),
        ("/api/wiki-stats/", "wiki"),
        ("/api/drive-files/upload/", "drive"),
        ("/api/leave-areas/", None),
        ("/api/servicenow-technician-absences/", "servicenow"),
        ("/api/customers/", None),
        ("/api/me/", None),
        ("/api/issuesx/", None),
    ],
)
def test_module_for_path(path, key):
    assert module_for_path(path) == key


def test_registry_api_segments_do_not_overlap():
    seen: dict[str, str] = {}
    for m in MODULES:
        for seg in m.api:
            assert seg not in seen, f"{seg} in {seen.get(seg)} e {m.key}"
            seen[seg] = m.key


# ── Blocco delle API ────────────────────────────────────────────────────────

def test_disabled_module_api_is_404_for_regular_user():
    user = _staffer("attendance.view_absence")
    c = _client(user)
    assert c.get("/api/absences/").status_code == 200

    _switch_off("leave")

    resp = c.get("/api/absences/")
    assert resp.status_code == 404
    assert resp.json()["module"] == "leave"
    assert c.post("/api/absences/bulk/", {}, format="json").status_code == 404


def test_piano_ferie_off_keeps_technician_absences_and_areas():
    user = _staffer("attendance.view_absence", "attendance.view_leavearea")
    _switch_off("leave")
    c = _client(user)

    assert c.get("/api/leave-areas/").status_code == 200
    assert c.get("/api/servicenow-technician-absences/").status_code != 404


def test_superuser_still_sees_disabled_module(superuser):
    _switch_off("leave")
    assert _client(superuser).get("/api/absences/").status_code == 200


def test_cache_follows_changes():
    assert disabled_modules() == frozenset()
    _switch_off("wiki")
    assert disabled_modules() == {"wiki"}
    ModuleSwitch.objects.filter(key="wiki").first().delete()
    assert disabled_modules() == frozenset()


# ── /api/me/ ────────────────────────────────────────────────────────────────

def test_me_lists_disabled_modules():
    user = _staffer()
    _switch_off("leave")
    _switch_off("contracts")
    assert _client(user).get("/api/me/").json()["disabled_modules"] == ["contracts", "leave"]


# ── API della pagina Moduli ─────────────────────────────────────────────────

def test_only_superuser_manages_modules():
    user = _staffer("core.manage_users")
    c = _client(user)
    assert c.get("/api/admin/modules/").status_code == 403
    assert c.patch("/api/admin/modules/leave/", {"enabled": False}, format="json").status_code == 403
    assert not ModuleSwitch.objects.exists()


def test_superuser_switches_module_off_and_on(superuser):
    c = _client(superuser)

    resp = c.patch("/api/admin/modules/leave/", {"enabled": False, "reason": "In attesa del rilascio"}, format="json")
    assert resp.status_code == 200
    body = resp.json()
    assert body["enabled"] is False
    assert body["reason"] == "In attesa del rilascio"
    assert body["changed_by"] == "admin"
    assert disabled_modules() == {"leave"}

    listing = {m["key"]: m for m in c.get("/api/admin/modules/").json()}
    assert set(listing) == {m.key for m in MODULES}
    assert listing["leave"]["enabled"] is False
    assert listing["leave"]["history"][0]["enabled"] is False
    assert listing["issues"]["enabled"] is True

    resp = c.patch("/api/admin/modules/leave/", {"enabled": True}, format="json")
    assert resp.json()["enabled"] is True
    assert resp.json()["reason"] == ""
    assert [h["enabled"] for h in resp.json()["history"]] == [True, False]
    assert disabled_modules() == frozenset()
    assert AuditEvent.objects.filter(subject__startswith="Modulo Piano ferie").count() == 2


def test_patch_validates_input(superuser):
    c = _client(superuser)
    assert c.patch("/api/admin/modules/nope/", {"enabled": False}, format="json").status_code == 404
    assert c.patch("/api/admin/modules/leave/", {"enabled": "no"}, format="json").status_code == 400


# ── Ricerca, notifiche, conversione, cron ───────────────────────────────────

def test_search_hides_disabled_module_results():
    from wiki.models import WikiPage

    user = _staffer("wiki.view_wikipage")
    WikiPage.objects.create(title="Riavvio servizio MWL", slug="riavvio-mwl", content_markdown="x")
    c = _client(user)
    kinds = lambda: {r["kind"] for r in c.get("/api/search/", {"q": "MWL"}).json()["results"]}  # noqa: E731
    assert "wiki_page" in kinds()

    _switch_off("wiki")
    assert "wiki_page" not in kinds()


def test_notifications_of_disabled_module_are_hidden():
    from notifications.models import Notification, NotificationType

    user = _staffer()
    Notification.objects.create(
        recipient=user, notification_type=NotificationType.MAINTENANCE_DUE, title="PM", source_key="1:1", event_date=date.today(),
    )
    c = _client(user)
    assert c.get("/api/notifications/unread_count/").json()["count"] == 1

    _switch_off("maintenance")
    assert c.get("/api/notifications/unread_count/").json()["count"] == 0


def test_close_resolved_issues_skips_when_issues_off(capsys):
    _switch_off("issues")
    call_command("close_resolved_issues")
    assert "Modulo Issue spento" in capsys.readouterr().out
