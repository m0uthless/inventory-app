"""Preferiti della Wiki: ogni utente mette o toglie la stella su una pagina.

Le azioni sono personali (nessun permesso di modello richiesto, come il voto)
ma restano chiuse alle sessioni Portal (barriera WP-03).
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from wiki.models import WikiPage, WikiPageFavorite

pytestmark = pytest.mark.django_db


def _make_user(*, superuser: bool = False):
    user = get_user_model().objects.create_user(username=f"fav_{uuid.uuid4().hex[:6]}", password="pw")
    if superuser:
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=["is_staff", "is_superuser"])
    return user


def _client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _make_page(owner, title="Pagina"):
    suffix = uuid.uuid4().hex[:6]
    return WikiPage.objects.create(
        title=f"{title} {suffix}", slug=f"p-{suffix}", content_markdown="<p>x</p>",
        created_by=owner, updated_by=owner,
    )


def test_add_and_remove_favorite():
    owner = _make_user(superuser=True)
    user = _make_user()
    page = _make_page(owner)
    client = _client(user)

    added = client.post(f"/api/wiki-pages/{page.id}/favorite/")
    assert added.status_code == 200, added.data
    assert added.data["is_favorite"] is True
    assert WikiPageFavorite.objects.filter(page=page, user=user).count() == 1

    again = client.post(f"/api/wiki-pages/{page.id}/favorite/")
    assert again.status_code == 200
    assert WikiPageFavorite.objects.filter(page=page, user=user).count() == 1

    removed = client.delete(f"/api/wiki-pages/{page.id}/favorite/")
    assert removed.status_code == 200
    assert removed.data["is_favorite"] is False
    assert not WikiPageFavorite.objects.filter(page=page, user=user).exists()

    removed_again = client.delete(f"/api/wiki-pages/{page.id}/favorite/")
    assert removed_again.status_code == 200


def test_is_favorite_and_filter_are_per_user():
    owner = _make_user(superuser=True)
    alice = _make_user(superuser=True)
    bob = _make_user(superuser=True)
    starred = _make_page(owner, "Stellata")
    other = _make_page(owner, "Altra")
    WikiPageFavorite.objects.create(page=starred, user=alice)

    a = _client(alice)
    detail = a.get(f"/api/wiki-pages/{starred.id}/")
    assert detail.data["is_favorite"] is True
    assert detail.data["favorited_at"]
    # l'autore serve alla home per "Le tue bozze"
    assert detail.data["created_by"] == owner.id
    assert a.get(f"/api/wiki-pages/{other.id}/").data["is_favorite"] is False

    mine = a.get("/api/wiki-pages/", {"favorite": "1"})
    assert [r["id"] for r in mine.data["results"]] == [starred.id]

    b = _client(bob)
    assert b.get(f"/api/wiki-pages/{starred.id}/").data["is_favorite"] is False
    assert b.get("/api/wiki-pages/", {"favorite": "1"}).data["results"] == []


def test_portal_session_cannot_use_favorites():
    owner = _make_user(superuser=True)
    user = _make_user()
    page = _make_page(owner)
    client = APIClient()
    client.force_login(user)
    session = client.session
    session["ambito"] = "portal"
    session.save()
    client.cookies["sessionid"] = session.session_key

    resp = client.post(f"/api/wiki-pages/{page.id}/favorite/")
    assert resp.status_code == 403
    assert not WikiPageFavorite.objects.exists()


def test_unauthenticated_cannot_favorite():
    owner = _make_user(superuser=True)
    page = _make_page(owner)
    resp = APIClient().post(f"/api/wiki-pages/{page.id}/favorite/")
    assert resp.status_code in (401, 403)
