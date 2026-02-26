from __future__ import annotations

import json
from typing import Any, Dict

from django.contrib.auth import authenticate, login, logout
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.views.decorators.http import require_GET, require_POST

from audit.utils import log_auth_attempt, log_event


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
        # Track failed login attempt (do not block auth flow on audit errors)
        try:
            log_auth_attempt(username=username, success=False, request=request)
        except Exception:
            pass
        return JsonResponse({"detail": "Invalid credentials"}, status=401)
    if not user.is_active:
        # Disabled user is still a failed attempt
        try:
            log_auth_attempt(username=username, success=False, request=request)
        except Exception:
            pass
        return JsonResponse({"detail": "User disabled"}, status=403)

    login(request, user)

    # Track successful login attempt
    try:
        log_auth_attempt(
            username=username or getattr(user, "username", "") or "",
            success=True,
            request=request,
        )
    except Exception:
        pass

    return JsonResponse({"detail": "ok"})


@require_POST
@csrf_protect
def logout_view(request: HttpRequest) -> JsonResponse:
    # Best-effort audit event for logout (never block)
    try:
        if getattr(request, "user", None) is not None and request.user.is_authenticated:
            subject = (request.user.get_full_name() or request.user.username or str(request.user)).strip()
            log_event(
                actor=request.user,
                action="logout",
                instance=request.user,
                changes=None,
                request=request,
                subject=subject,
            )
    except Exception:
        pass

    logout(request)
    return JsonResponse({"detail": "ok"})
