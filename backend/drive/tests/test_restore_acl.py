from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.utils import timezone
from rest_framework.test import APIClient

from drive.models import DriveFile, DriveFolder


pytestmark = pytest.mark.django_db


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _user(username: str):
    User = get_user_model()
    return User.objects.create_user(username=username, password="pw")


def test_drive_folder_bulk_restore_only_restores_accessible_deleted_rows():
    allowed_group = Group.objects.create(name="Drive Restore Allowed")
    denied_group = Group.objects.create(name="Drive Restore Denied")

    actor = _user("drive-folder-restorer")
    actor.groups.add(allowed_group)
    actor.user_permissions.add(Permission.objects.get(codename="change_drivefolder"))

    allowed = DriveFolder.objects.create(name="Allowed folder", deleted_at=timezone.now())
    allowed.allowed_groups.add(allowed_group)

    denied = DriveFolder.objects.create(name="Denied folder", deleted_at=timezone.now())
    denied.allowed_groups.add(denied_group)

    response = _client(actor).post(
        "/api/drive-folders/bulk_restore/",
        {"ids": [allowed.id, denied.id]},
        format="json",
    )

    assert response.status_code == 200, response.data
    assert response.data["restored"] == [allowed.id]
    assert response.data["count"] == 1

    allowed.refresh_from_db()
    denied.refresh_from_db()
    assert allowed.deleted_at is None
    assert denied.deleted_at is not None


def test_drive_file_bulk_restore_only_restores_accessible_deleted_rows():
    allowed_group = Group.objects.create(name="Drive File Restore Allowed")
    denied_group = Group.objects.create(name="Drive File Restore Denied")

    actor = _user("drive-file-restorer")
    actor.groups.add(allowed_group)
    actor.user_permissions.add(Permission.objects.get(codename="change_drivefile"))

    allowed = DriveFile.objects.create(name="allowed.txt", deleted_at=timezone.now())
    allowed.allowed_groups.add(allowed_group)

    denied = DriveFile.objects.create(name="denied.txt", deleted_at=timezone.now())
    denied.allowed_groups.add(denied_group)

    response = _client(actor).post(
        "/api/drive-files/bulk_restore/",
        {"ids": [allowed.id, denied.id]},
        format="json",
    )

    assert response.status_code == 200, response.data
    assert response.data["restored"] == [allowed.id]
    assert response.data["count"] == 1

    allowed.refresh_from_db()
    denied.refresh_from_db()
    assert allowed.deleted_at is None
    assert denied.deleted_at is not None
