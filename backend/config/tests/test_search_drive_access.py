import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission

from drive.models import DriveFile, DriveFolder


@pytest.mark.django_db
def test_search_hides_group_restricted_drive_results_without_membership(api_client):
    User = get_user_model()
    user = User.objects.create_user(username="searcher", password="pw")
    restricted_group = Group.objects.create(name="Drive Restricted")

    perm_folder = Permission.objects.get(codename="view_drivefolder")
    perm_file = Permission.objects.get(codename="view_drivefile")
    user.user_permissions.add(perm_folder, perm_file)

    public_folder = DriveFolder.objects.create(name="Public Alpha Folder")
    hidden_folder = DriveFolder.objects.create(name="Secret Alpha Folder")
    hidden_folder.allowed_groups.add(restricted_group)

    DriveFile.objects.create(name="Public Alpha File.pdf", folder=public_folder)
    hidden_file = DriveFile.objects.create(name="Secret Alpha File.pdf", folder=public_folder)
    hidden_file.allowed_groups.add(restricted_group)

    hidden_via_folder = DriveFile.objects.create(name="Folder Secret Alpha.pdf", folder=hidden_folder)

    api_client.force_authenticate(user=user)
    resp = api_client.get("/api/search/", {"q": "Alpha"})

    assert resp.status_code == 200
    payload = resp.json()
    titles = {item["title"] for item in payload["results"] if item["kind"] in {"drive_folder", "drive_file"}}

    assert "Public Alpha Folder" in titles
    assert "Public Alpha File.pdf" in titles
    assert "Secret Alpha Folder" not in titles
    assert "Secret Alpha File.pdf" not in titles
    assert "Folder Secret Alpha.pdf" not in titles


@pytest.mark.django_db
def test_search_uses_drivefile_name_field_instead_of_nonexistent_original_filename(api_client):
    User = get_user_model()
    user = User.objects.create_user(username="drive-reader", password="pw")
    perm_file = Permission.objects.get(codename="view_drivefile")
    user.user_permissions.add(perm_file)

    DriveFile.objects.create(name="Quarterly Report 2026.pdf")

    api_client.force_authenticate(user=user)
    resp = api_client.get("/api/search/", {"q": "Quarterly"})

    assert resp.status_code == 200
    payload = resp.json()
    drive_results = [item for item in payload["results"] if item["kind"] == "drive_file"]

    assert len(drive_results) == 1
    assert drive_results[0]["title"] == "Quarterly Report 2026.pdf"
