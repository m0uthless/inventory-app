"""Viste salvate sul server (lista del 21/11, punto 5).

Ogni utente vede e cancella solo le proprie viste, per pagina; la chiave la sceglie
il client (così l'id resta lo stesso subito dopo il salvataggio e per le viste
caricate dal browser).
"""
from __future__ import annotations

import uuid

import pytest
from rest_framework.test import APIClient

from core.testing import make_archie_user

pytestmark = pytest.mark.django_db
URL = "/api/saved-views/"


def _client():
    u = make_archie_user(username=f"sv_{uuid.uuid4().hex[:6]}", password="pw")
    c = APIClient(); c.force_authenticate(user=u)
    return c


def test_create_list_and_delete_own_views_per_page():
    c = _client()
    r = c.post(URL, {"page": "issues", "id": "k1", "name": "Le mie aperte", "state": {"view": "open", "q": ""}}, format="json")
    assert r.status_code == 201, r.data
    c.post(URL, {"page": "sites", "id": "k2", "name": "Siti BO", "state": {"customer": 4}}, format="json")
    rows = c.get(URL, {"page": "issues"}).json()
    assert rows == [{"id": "k1", "page": "issues", "name": "Le mie aperte", "state": {"view": "open", "q": ""}}]
    assert c.delete(f"{URL}k1/?page=issues").status_code == 204
    assert c.get(URL, {"page": "issues"}).json() == []


def test_views_of_others_are_invisible_and_untouchable():
    a, b = _client(), _client()
    a.post(URL, {"page": "issues", "id": "same", "name": "A", "state": {}}, format="json")
    assert b.get(URL, {"page": "issues"}).json() == []
    assert b.delete(f"{URL}same/?page=issues").status_code == 404
    # la stessa chiave per un altro utente è un'altra vista
    assert b.post(URL, {"page": "issues", "id": "same", "name": "B", "state": {}}, format="json").status_code == 201
    assert [v["name"] for v in a.get(URL, {"page": "issues"}).json()] == ["A"]


def test_same_key_twice_updates_instead_of_duplicating():
    c = _client()
    c.post(URL, {"page": "issues", "id": "k", "name": "Vecchio", "state": {}}, format="json")
    assert c.post(URL, {"page": "issues", "id": "k", "name": "Nuovo", "state": {"x": 1}}, format="json").status_code in (200, 201)
    assert [(v["name"], v["state"]) for v in c.get(URL, {"page": "issues"}).json()] == [("Nuovo", {"x": 1})]


def test_validation_limits():
    c = _client()
    assert c.post(URL, {"page": "issues", "id": "k", "name": "", "state": {}}, format="json").status_code == 400
    assert c.post(URL, {"page": "issues", "id": "k", "name": "x", "state": {"big": "a" * 9000}}, format="json").status_code == 400
    assert c.post(URL, {"page": "issues", "id": "k", "name": "x", "state": "testo"}, format="json").status_code == 400


def test_requires_login():
    assert APIClient().get(URL, {"page": "issues"}).status_code in (401, 403)
