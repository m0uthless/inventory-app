"""H-04 (QA 2026-11-15): Bacheca e Changelog si leggono da tutti gli utenti
Archie ma si scrivono solo con il permesso di gestione (o da superuser)."""
from __future__ import annotations

import pytest
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from core.models import Announcement, ChangelogEntry
from core.testing import make_archie_user

pytestmark = pytest.mark.django_db


def _client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.parametrize(
    "url,payload,model",
    [
        ("/api/announcements/", {"title": "T", "body": "B", "category": "news"}, Announcement),
        ("/api/changelog-entries/", {"title": "T", "body": "B"}, ChangelogEntry),
    ],
)
def test_base_user_reads_but_cannot_write(url, payload, model):
    obj = model.objects.create(title="Esistente", body="x")
    c = _client(make_archie_user(username="base", password="pw"))

    assert c.get(url).status_code == 200
    assert c.post(url, payload, format="json").status_code == 403
    assert c.patch(f"{url}{obj.pk}/", {"title": "Cambiato"}, format="json").status_code == 403
    assert c.delete(f"{url}{obj.pk}/").status_code == 403


@pytest.mark.parametrize(
    "url,payload,codename",
    [
        ("/api/announcements/", {"title": "T", "body": "B", "category": "news"}, "change_announcement"),
        ("/api/changelog-entries/", {"title": "T", "body": "B"}, "change_changelogentry"),
    ],
)
def test_manager_and_superuser_can_write(url, payload, codename, superuser):
    manager = make_archie_user(username="gestore", password="pw")
    manager.user_permissions.add(Permission.objects.get(content_type__app_label="core", codename=codename))

    assert _client(manager).post(url, payload, format="json").status_code == 201
    assert _client(superuser).post(url, payload, format="json").status_code == 201
