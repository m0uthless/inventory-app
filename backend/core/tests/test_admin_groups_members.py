"""Membri del gruppo dalla finestra del gruppo (PATCH /api/admin-groups/<id>/ con ``user_ids``).

Valgono le stesse regole della modifica del singolo utente: un account superuser o
staff lo tocca solo un superuser (B-10) e un utente Philips non sta in nessun gruppo.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from rest_framework.test import APIClient

from core.models import UserProfile

pytestmark = pytest.mark.django_db

User = get_user_model()


def _user(*, superuser=False, staff=False, manager=False, philips=False):
    u = User.objects.create_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw-123456")
    if superuser or staff:
        u.is_staff = True
        u.is_superuser = superuser
        u.save(update_fields=["is_staff", "is_superuser"])
    if manager:
        for app_label, codename in (("core", "manage_users"), ("core", "access_archie")):
            u.user_permissions.add(Permission.objects.get(content_type__app_label=app_label, codename=codename))
    if philips:
        UserProfile.objects.update_or_create(user=u, defaults={"is_philips": True})
    return u


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def test_manager_adds_and_removes_members():
    manager = _user(manager=True)
    group = Group.objects.create(name=f"G {uuid.uuid4().hex[:4]}")
    stays, leaves, joins = _user(), _user(), _user()
    group.user_set.add(stays, leaves)

    resp = _client(manager).patch(f"/api/admin-groups/{group.pk}/", {"user_ids": [stays.pk, joins.pk]}, format="json")

    assert resp.status_code == 200, resp.content
    assert set(group.user_set.values_list("id", flat=True)) == {stays.pk, joins.pk}
    assert resp.json()["user_count"] == 2


def test_name_only_patch_leaves_members_alone():
    manager = _user(manager=True)
    group = Group.objects.create(name=f"G {uuid.uuid4().hex[:4]}")
    member = _user()
    group.user_set.add(member)

    resp = _client(manager).patch(f"/api/admin-groups/{group.pk}/", {"name": group.name + " bis"}, format="json")

    assert resp.status_code == 200
    assert list(group.user_set.values_list("id", flat=True)) == [member.pk]


@pytest.mark.parametrize("change", ["add", "remove"])
def test_manager_cannot_move_an_admin_through_the_group(change):
    manager = _user(manager=True)
    admin = _user(staff=True)
    group = Group.objects.create(name=f"G {uuid.uuid4().hex[:4]}")
    if change == "remove":
        group.user_set.add(admin)

    resp = _client(manager).patch(f"/api/admin-groups/{group.pk}/", {"user_ids": [admin.pk] if change == "add" else []}, format="json")

    assert resp.status_code == 403
    assert group.user_set.filter(pk=admin.pk).exists() is (change == "remove")


def test_manager_can_save_a_group_that_already_contains_an_admin():
    """Se l'admin non entra né esce, il gestore può comunque salvare i membri."""
    manager = _user(manager=True)
    admin, other = _user(staff=True), _user()
    group = Group.objects.create(name=f"G {uuid.uuid4().hex[:4]}")
    group.user_set.add(admin)

    resp = _client(manager).patch(f"/api/admin-groups/{group.pk}/", {"user_ids": [admin.pk, other.pk]}, format="json")

    assert resp.status_code == 200
    assert group.user_set.count() == 2


def test_superuser_can_move_an_admin():
    root = _user(superuser=True)
    admin = _user(staff=True)
    group = Group.objects.create(name=f"G {uuid.uuid4().hex[:4]}")

    resp = _client(root).patch(f"/api/admin-groups/{group.pk}/", {"user_ids": [admin.pk]}, format="json")

    assert resp.status_code == 200
    assert group.user_set.filter(pk=admin.pk).exists()


def test_philips_user_cannot_join_a_group():
    manager = _user(manager=True)
    philips = _user(philips=True)
    group = Group.objects.create(name=f"G {uuid.uuid4().hex[:4]}")

    resp = _client(manager).patch(f"/api/admin-groups/{group.pk}/", {"user_ids": [philips.pk]}, format="json")

    assert resp.status_code == 400
    assert not group.user_set.exists()


def test_unknown_user_id_is_rejected():
    manager = _user(manager=True)
    group = Group.objects.create(name=f"G {uuid.uuid4().hex[:4]}")

    resp = _client(manager).patch(f"/api/admin-groups/{group.pk}/", {"user_ids": [999999]}, format="json")

    assert resp.status_code == 400
