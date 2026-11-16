"""B-10 (QA 2026-11-15): gerarchia degli amministratori nel pannello utenti.

Un utente con il solo ``core.manage_users`` non deve poter agire su un account
superuser o staff: niente reset password (che restituirebbe la password nuova,
cioè la presa di controllo dell'account), niente disattivazione, modifica,
reset dei permessi o eliminazione.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

User = get_user_model()


def _make_user(*, superuser: bool = False, staff: bool = False, manager: bool = False):
    u = User.objects.create_user(
        username=f"u_{uuid.uuid4().hex[:6]}", password="old-pw-123", email="t@example.com", first_name="Nome"
    )
    if superuser or staff:
        u.is_staff = True
        u.is_superuser = superuser
        u.save(update_fields=["is_staff", "is_superuser"])
    if manager:
        for app_label, codename in (("core", "manage_users"), ("core", "access_archie")):
            u.user_permissions.add(Permission.objects.get(content_type__app_label=app_label, codename=codename))
    return u


def _client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.parametrize("target_kind", ["superuser", "staff"])
def test_manager_cannot_reset_password_of_admin(target_kind):
    manager = _make_user(manager=True)
    target = _make_user(superuser=target_kind == "superuser", staff=True)

    resp = _client(manager).post(f"/api/admin-users/{target.pk}/reset-password/")

    assert resp.status_code == 403
    assert "password" not in resp.json()
    target.refresh_from_db()
    assert target.check_password("old-pw-123")


def test_manager_cannot_deactivate_superuser():
    manager = _make_user(manager=True)
    target = _make_user(superuser=True)

    resp = _client(manager).patch(f"/api/admin-users/{target.pk}/", {"is_active": False}, format="json")

    assert resp.status_code == 403
    target.refresh_from_db()
    assert target.is_active is True


def test_manager_cannot_edit_superuser_registry():
    manager = _make_user(manager=True)
    target = _make_user(superuser=True)

    resp = _client(manager).patch(
        f"/api/admin-users/{target.pk}/", {"first_name": "Preso", "email": "x@evil.test"}, format="json"
    )

    assert resp.status_code == 403
    target.refresh_from_db()
    assert target.first_name == "Nome"
    assert target.email == "t@example.com"


def test_manager_cannot_reset_permissions_or_delete_superuser():
    manager = _make_user(manager=True)
    target = _make_user(superuser=True)
    c = _client(manager)

    assert c.post(f"/api/admin-users/{target.pk}/reset-permissions-to-group/").status_code == 403
    assert c.delete(f"/api/admin-users/{target.pk}/").status_code == 403
    assert User.objects.filter(pk=target.pk).exists()


def test_superuser_can_reset_another_superuser():
    admin = _make_user(superuser=True)
    target = _make_user(superuser=True)

    resp = _client(admin).post(f"/api/admin-users/{target.pk}/reset-password/")

    assert resp.status_code == 200
    target.refresh_from_db()
    assert target.check_password(resp.json()["password"])


def test_manager_can_still_manage_regular_users():
    manager = _make_user(manager=True)
    target = _make_user()
    c = _client(manager)

    resp = c.post(f"/api/admin-users/{target.pk}/reset-password/")
    assert resp.status_code == 200
    target.refresh_from_db()
    assert target.check_password(resp.json()["password"])

    resp = c.patch(f"/api/admin-users/{target.pk}/", {"is_active": False}, format="json")
    assert resp.status_code == 200
