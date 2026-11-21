"""Barriera Portal/Archie sugli endpoint che dichiaravano `permission_classes` propri
e quindi saltavano `IsInternalOrPortalDedicatedApp` (todo del restyle, voci [SEC]).

L'utente ha i permessi dei moduli ma non `core.access_archie`: con la barriera la
risposta è 403 prima di cercare l'oggetto (senza, sarebbe 404 o 400).
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

PERMS = [
    ("wiki", "view_wikipage"), ("wiki", "change_wikipage"),
    ("maintenance", "view_maintenanceevent"), ("maintenance", "change_maintenanceevent"), ("maintenance", "delete_maintenanceevent"),
    ("drive", "view_drivefile"), ("drive", "add_drivefile"),
    ("purchaseorders", "view_purchaseorderentry"), ("purchaseorders", "change_purchaseorderentry"),
]


@pytest.fixture
def client():
    u = get_user_model().objects.create_user(username="no_archie", password="pw")
    for app, code in PERMS:
        u.user_permissions.add(Permission.objects.get(content_type__app_label=app, codename=code))
    c = APIClient()
    c.force_login(u)
    s = c.session
    s["ambito"] = "site-repo"
    s.save()
    return c


@pytest.mark.parametrize("method,url", [
    ("post", "/api/wiki-pages/999999/view/"),
    ("post", "/api/wiki-pages/999999/rate/"),
    ("get", "/api/wiki-stats/"),
    ("post", "/api/maintenance-events/999999/reset/"),
    ("post", "/api/maintenance-events/999999/restore/"),
    ("post", "/api/maintenance-events/bulk_restore/"),
    ("post", "/api/drive-files/upload/"),
    ("post", "/api/purchase-order-entries/999999/advance/"),
    ("post", "/api/purchase-order-entries/999999/revert/"),
    ("get", "/api/birthdays/"),
    ("get", "/api/sticky-note/"),
    ("get", "/api/changelog/unseen/"),
    ("post", "/api/changelog/dismiss/"),
])
def test_barrier_blocks_internal_session_without_archie_access(client, method, url):
    assert getattr(client, method)(url, {}, format="json").status_code == 403
