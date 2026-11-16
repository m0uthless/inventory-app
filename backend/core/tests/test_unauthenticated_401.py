"""B-06 (QA 2026-11-15): senza sessione l'API risponde 401, non 403."""
from __future__ import annotations

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("url", ["/api/issues/", "/api/customers/", "/api/me/"])
def test_anonymous_request_gets_401(url):
    resp = APIClient().get(url)
    assert resp.status_code == 401


def test_basic_auth_is_not_accepted(superuser):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION="Basic YWRtaW46YWRtaW4=")  # admin:admin
    assert c.get("/api/issues/").status_code == 401
