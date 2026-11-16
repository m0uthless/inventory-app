"""H-01 (QA 2026-11-15): `core.access_archie` va verificato al login anche
senza `ambito`, e la barriera `IsInternalOrPortalDedicatedApp` lo richiede
per ogni sessione non-Portal."""
from __future__ import annotations

import json

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from crm.models import Customer

pytestmark = pytest.mark.django_db

User = get_user_model()


def _user(username: str, *, archie: bool = False, perms: tuple[str, ...] = ()):
    u = User.objects.create_user(username=username, password="pw-Secret-123")
    codes = (("core", "access_archie"),) if archie else ()
    for label_code in codes + tuple(tuple(p.split(".")) for p in perms):
        app_label, codename = label_code
        u.user_permissions.add(Permission.objects.get(content_type__app_label=app_label, codename=codename))
    return u


def _login(client, username: str, **extra):
    return client.post(
        "/api/auth/login/",
        data=json.dumps({"username": username, "password": "pw-Secret-123", **extra}),
        content_type="application/json",
    )


def _portal_profile(user, customer_status):
    from portal.models import PortalUserProfile

    customer = Customer.objects.create(name="Cliente portal", status=customer_status)
    profile = PortalUserProfile.objects.create(user=user, customer=customer)
    profile.customers.set([customer])
    return profile


def test_login_without_ambito_and_without_access_is_refused(client):
    _user("nobody")

    resp = _login(client, "nobody")

    assert resp.status_code == 403
    assert "_auth_user_id" not in client.session


def test_login_without_ambito_with_access_archie_is_unchanged(client):
    _user("staffer", archie=True)

    resp = _login(client, "staffer")

    assert resp.status_code == 200
    assert resp.json()["ambito"] == "site-repo"


def test_portal_only_user_without_ambito_lands_on_portal(client, customer_status):
    user = _user("cliente")
    _portal_profile(user, customer_status)

    resp = _login(client, "cliente")

    assert resp.status_code == 200
    assert resp.json()["ambito"] == "portal"


@pytest.mark.parametrize("url", ["/api/issues/", "/api/servicenow-cases/", "/api/users/"])
def test_internal_session_without_access_archie_is_blocked_by_barrier(url):
    user = _user("forced")
    c = APIClient()
    c.force_login(user)
    session = c.session
    session["ambito"] = "site-repo"
    session.save()

    assert c.get(url).status_code == 403


@pytest.mark.parametrize("url", ["/api/issues/", "/api/servicenow-cases/"])
def test_internal_session_with_access_archie_still_reads(url):
    user = _user("reader", archie=True)
    c = APIClient()
    c.force_login(user)
    session = c.session
    session["ambito"] = "site-repo"
    session.save()

    assert c.get(url).status_code == 200
