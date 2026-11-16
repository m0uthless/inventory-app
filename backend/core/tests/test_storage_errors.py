"""B-16 (QA 2026-11-15): un errore di storage restituisce un 500 leggibile."""
from __future__ import annotations

from unittest import mock

from rest_framework.views import APIView

from core.exceptions import exception_handler


def test_os_error_becomes_readable_500():
    with mock.patch("core.exceptions.set_rollback"):
        resp = exception_handler(PermissionError(13, "Permission denied"), {"view": APIView()})

    assert resp.status_code == 500
    assert "file" in resp.data["detail"]


def test_other_exceptions_are_left_to_django():
    assert exception_handler(ValueError("x"), {"view": APIView()}) is None
