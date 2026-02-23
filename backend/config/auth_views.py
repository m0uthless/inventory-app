from __future__ import annotations

import json
from typing import Any, Dict

from django.contrib.auth import authenticate, login, logout
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.views.decorators.http import require_GET, require_POST


def _json_body(request: HttpRequest) -> Dict[str, Any]:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


@require_GET
@ensure_csrf_cookie
def csrf(request: HttpRequest) -> JsonResponse:
    """Sets the CSRF cookie for SPA clients."""
    return JsonResponse({"detail": "ok"})


@require_POST
@csrf_protect
def login_view(request: HttpRequest) -> JsonResponse:
    data = _json_body(request)
    username = data.get("username") or ""
    password = data.get("password") or ""
    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"detail": "Invalid credentials"}, status=401)
    if not user.is_active:
        return JsonResponse({"detail": "User disabled"}, status=403)

    login(request, user)
    return JsonResponse({"detail": "ok"})


@require_POST
@csrf_protect
def logout_view(request: HttpRequest) -> JsonResponse:
    logout(request)
    return JsonResponse({"detail": "ok"})
