"""Preferenze di aspetto in /api/me/: palette (`theme`) e modalità chiaro/scuro (`color_mode`)."""
import pytest

from core.models import UserProfile

pytestmark = pytest.mark.django_db


def test_defaults_are_green_and_light(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    resp = api_client.get("/api/me/")
    assert resp.status_code == 200
    profile = resp.json()["profile"]
    assert profile["theme"] == "default"
    assert profile["color_mode"] == "light"


@pytest.mark.parametrize("mode", ["light", "dark", "system"])
def test_patch_color_mode(api_client, superuser, mode):
    api_client.force_authenticate(user=superuser)
    resp = api_client.patch("/api/me/", {"color_mode": mode}, format="json")
    assert resp.status_code == 200
    assert resp.json()["profile"]["color_mode"] == mode
    assert UserProfile.objects.get(user=superuser).color_mode == mode


def test_patch_color_mode_rejects_unknown_value(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    resp = api_client.patch("/api/me/", {"color_mode": "sepia"}, format="json")
    assert resp.status_code == 400
    assert "color_mode" in resp.json()


@pytest.mark.parametrize("key", ["default", "blu", "indaco"])
def test_patch_theme_accepts_all_palettes(api_client, superuser, key):
    api_client.force_authenticate(user=superuser)
    resp = api_client.patch("/api/me/", {"theme": key}, format="json")
    assert resp.status_code == 200
    assert resp.json()["profile"]["theme"] == key
