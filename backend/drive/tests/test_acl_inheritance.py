from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from drive.access import (
    filter_accessible_files,
    filter_accessible_folders,
    has_file_access,
    has_folder_access,
)
from drive.models import DriveFile, DriveFolder

pytestmark = pytest.mark.django_db


def _user(username: str, *groups: Group):
    User = get_user_model()
    u = User.objects.create_user(username=username, password="pw")
    for g in groups:
        u.groups.add(g)
    return u


def test_open_subfolder_inside_restricted_parent_is_not_accessible():
    """VER-002: una sottocartella SENZA allowed_groups propri, dentro una
    cartella riservata a un gruppo, deve ereditare la restrizione — non
    deve essere "aperta di default" solo perché non ha un ACL suo."""
    restricted_group = Group.objects.create(name="Reparto Riservato")
    outsider = _user("outsider")
    insider = _user("insider", restricted_group)

    parent = DriveFolder.objects.create(name="Cartella riservata")
    parent.allowed_groups.add(restricted_group)

    child = DriveFolder.objects.create(name="Sottocartella aperta", parent=parent)
    # child.allowed_groups vuoto di proposito

    assert has_folder_access(insider, child) is True
    assert has_folder_access(outsider, child) is False


def test_filter_accessible_folders_respects_inheritance():
    restricted_group = Group.objects.create(name="Reparto Riservato 2")
    outsider = _user("outsider2")
    insider = _user("insider2", restricted_group)

    parent = DriveFolder.objects.create(name="Cartella riservata 2")
    parent.allowed_groups.add(restricted_group)
    child = DriveFolder.objects.create(name="Sottocartella aperta 2", parent=parent)

    qs = DriveFolder.objects.filter(pk=child.pk)
    assert list(filter_accessible_folders(qs, insider)) == [child]
    assert list(filter_accessible_folders(qs, outsider)) == []


def test_file_in_open_subfolder_inside_restricted_parent_is_not_accessible():
    restricted_group = Group.objects.create(name="Reparto Riservato 3")
    outsider = _user("outsider3")
    insider = _user("insider3", restricted_group)

    parent = DriveFolder.objects.create(name="Cartella riservata 3")
    parent.allowed_groups.add(restricted_group)
    child = DriveFolder.objects.create(name="Sottocartella aperta 3", parent=parent)

    f = DriveFile.objects.create(name="doc.pdf", folder=child)
    # f.allowed_groups vuoto: nessuna restrizione propria, eredita dal genitore

    assert has_file_access(insider, f) is True
    assert has_file_access(outsider, f) is False

    qs = DriveFile.objects.filter(pk=f.pk)
    assert list(filter_accessible_files(qs, insider)) == [f]
    assert list(filter_accessible_files(qs, outsider)) == []


def test_grandchild_folder_inherits_grandparent_restriction():
    """Catena a 2 livelli: nonno riservato, genitore aperto, nipote aperto.
    Il nipote deve comunque ereditare la restrizione del nonno."""
    restricted_group = Group.objects.create(name="Reparto Riservato 4")
    outsider = _user("outsider4")
    insider = _user("insider4", restricted_group)

    grandparent = DriveFolder.objects.create(name="Nonno riservato")
    grandparent.allowed_groups.add(restricted_group)
    parent = DriveFolder.objects.create(name="Genitore aperto", parent=grandparent)
    child = DriveFolder.objects.create(name="Nipote aperto", parent=parent)

    assert has_folder_access(insider, child) is True
    assert has_folder_access(outsider, child) is False

    qs = DriveFolder.objects.filter(pk=child.pk)
    assert list(filter_accessible_folders(qs, insider)) == [child]
    assert list(filter_accessible_folders(qs, outsider)) == []


def test_two_different_group_restrictions_on_chain_require_both():
    """Genitore riservato al gruppo A, figlio riservato al gruppo B: un
    utente deve appartenere a ENTRAMBI i gruppi per vedere il figlio."""
    group_a = Group.objects.create(name="Gruppo A")
    group_b = Group.objects.create(name="Gruppo B")

    only_a = _user("only_a", group_a)
    only_b = _user("only_b", group_b)
    both = _user("both_ab", group_a, group_b)

    parent = DriveFolder.objects.create(name="Genitore A")
    parent.allowed_groups.add(group_a)
    child = DriveFolder.objects.create(name="Figlio B", parent=parent)
    child.allowed_groups.add(group_b)

    assert has_folder_access(only_a, child) is False
    assert has_folder_access(only_b, child) is False
    assert has_folder_access(both, child) is True
