"""Campo `access` di file e cartelle: le restrizioni per gruppo lungo la catena.

Serve al pannello del Drive ("Chi può vederlo") per spiegare da dove viene una
restrizione senza dover leggere i gruppi da /admin-groups/ (riservato a chi
gestisce gli utenti).
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.files.base import ContentFile
from rest_framework.test import APIClient

from drive.models import DriveFile, DriveFolder
from core.testing import make_archie_user

pytestmark = pytest.mark.django_db


def _viewer(*groups: Group):
    user = make_archie_user(username=f"drive-{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(
        Permission.objects.get(codename="view_drivefile"),
        Permission.objects.get(codename="view_drivefolder"),
    )
    for g in groups:
        user.groups.add(g)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _file(folder, name="doc.pdf", groups=()):
    f = DriveFile(folder=folder, name=name, size=3, mime_type="application/pdf")
    f.file.save(name, ContentFile(b"abc"), save=True)
    for g in groups:
        f.allowed_groups.add(g)
    return f


def test_open_file_has_no_restrictions():
    folder = DriveFolder.objects.create(name="Aperta")
    f = _file(folder)
    data = _viewer().get(f"/api/drive-files/{f.id}/").data
    assert data["access"] == []


def test_restrictions_follow_the_chain_from_file_to_root():
    tecnici = Group.objects.create(name="Tecnici senior")
    rete = Group.objects.create(name="Rete")
    root = DriveFolder.objects.create(name="Clienti")
    restricted = DriveFolder.objects.create(name="Schemi di rete", parent=root)
    restricted.allowed_groups.add(tecnici, rete)
    inner = DriveFolder.objects.create(name="Scaletta", parent=restricted)
    f = _file(inner, groups=[tecnici])

    client = _viewer(tecnici)
    data = client.get(f"/api/drive-files/{f.id}/").data
    assert data["access"] == [
        {"level": "file", "id": f.id, "name": f.name, "groups": ["Tecnici senior"]},
        {"level": "folder", "id": restricted.id, "name": "Schemi di rete", "groups": ["Rete", "Tecnici senior"]},
    ]

    folder_data = client.get(f"/api/drive-folders/{inner.id}/").data
    assert folder_data["access"] == [
        {"level": "folder", "id": restricted.id, "name": "Schemi di rete", "groups": ["Rete", "Tecnici senior"]},
    ]

    # Negli elenchi il campo c'è per ogni file (calcolato una volta per cartella).
    listed = client.get("/api/drive-files/", {"folder": inner.id}).data["results"]
    assert listed[0]["access"][1]["name"] == "Schemi di rete"
