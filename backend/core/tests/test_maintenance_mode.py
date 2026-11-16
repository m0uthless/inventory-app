"""Modalità manutenzione: Archie chiuso a chi non è superuser, Portal aperto."""
from __future__ import annotations

import json

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from audit.models import AuditEvent
from core.models import MaintenanceMode
from core.testing import make_archie_user
from crm.models import Customer

pytestmark = pytest.mark.django_db

User = get_user_model()
PW = "pw-Secret-123"


def _on(message: str = "") -> None:
    MaintenanceMode(active=True, message=message).save()


def _login(client, username: str, **extra):
    return client.post(
        "/api/auth/login/",
        data=json.dumps({"username": username, "password": PW, **extra}),
        content_type="application/json",
    )


def _internal_client(user) -> APIClient:
    c = APIClient()
    c.force_login(user)
    session = c.session
    session["ambito"] = "site-repo"
    session.save()
    return c


def test_login_is_refused_with_message(client):
    make_archie_user(username="tech", password=PW)
    _on("Aggiornamento in corso, torniamo alle 14.")

    resp = _login(client, "tech", ambito="site-repo")

    assert resp.status_code == 503
    assert resp.json() == {"detail": "Aggiornamento in corso, torniamo alle 14.", "reason": "maintenance"}
    assert "_auth_user_id" not in client.session


def test_default_message_when_none_given(client):
    make_archie_user(username="tech", password=PW)
    _on()
    assert "manutenzione" in _login(client, "tech").json()["detail"]


def test_superuser_still_logs_in(client):
    User.objects.create_superuser(username="root", password=PW, email="r@example.com")
    _on()
    assert _login(client, "root", ambito="site-repo").status_code == 200


def test_portal_login_is_not_affected(client, customer_status):
    from portal.models import PortalUserProfile

    user = User.objects.create_user(username="cliente", password=PW)
    customer = Customer.objects.create(name="Cliente", status=customer_status)
    profile = PortalUserProfile.objects.create(user=user, customer=customer)
    profile.customers.set([customer])
    _on()

    resp = _login(client, "cliente", ambito="portal")
    assert resp.status_code == 200
    assert resp.json()["ambito"] == "portal"


def test_open_session_is_closed_on_next_request():
    user = make_archie_user(username="tech", password=PW)
    c = _internal_client(user)
    assert c.get("/api/me/").status_code == 200

    _on()
    resp = c.get("/api/customers/")
    assert resp.status_code == 401
    assert resp.json()["reason"] == "maintenance"
    # sessione chiusa: anche dopo lo spegnimento serve un nuovo login
    MaintenanceMode(active=False).save()
    assert c.get("/api/me/").status_code == 401


def test_public_status_endpoint(client):
    assert client.get("/api/auth/maintenance/").json()["active"] is False
    _on("Torniamo subito.")
    assert client.get("/api/auth/maintenance/").json() == {"active": True, "message": "Torniamo subito."}


def test_only_superuser_toggles(superuser):
    tech = make_archie_user(username="tech", password=PW)
    assert _internal_client(tech).patch("/api/admin/maintenance/", {"active": True}, format="json").status_code == 403

    c = APIClient()
    c.force_login(superuser)
    resp = c.patch("/api/admin/maintenance/", {"active": True, "message": "Lavori"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["active"] is True
    assert c.get("/api/me/").json()["maintenance_active"] is True
    assert AuditEvent.objects.filter(subject="Modalità manutenzione attivata").exists()

    resp = c.patch("/api/admin/maintenance/", {"active": False}, format="json")
    assert resp.json()["active"] is False
    assert c.patch("/api/admin/maintenance/", {"active": "si"}, format="json").status_code == 400
