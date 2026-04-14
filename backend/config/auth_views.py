from __future__ import annotations

import json
from typing import Any, Dict

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.core.cache import cache
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.views.decorators.http import require_GET, require_POST

from audit.utils import log_auth_attempt, log_event


User = get_user_model()


def _json_body(request: HttpRequest) -> Dict[str, Any]:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


def _audit_failed_login(request: HttpRequest, username: str, user_obj=None, *, reason: str | None = None) -> None:
    normalized_username = (username or "").strip()
    subject = normalized_username or "Tentativo login senza username"
    metadata = {"username": normalized_username}
    if reason:
        metadata["reason"] = reason
    try:
        log_event(
            actor=None,
            action="login_failed",
            instance=user_obj,
            changes=None,
            request=request,
            metadata=metadata,
            subject=subject,
        )
    except Exception:
        pass


def _client_ip(request: HttpRequest) -> str:
    """Restituisce l'IP del client in modo sicuro.

    Usa REMOTE_ADDR come fonte canonica — è l'IP impostato da nginx/proxy
    direttamente sulla connessione TCP e non può essere falsificato dal client.
    """
    return (request.META.get("REMOTE_ADDR") or "unknown").strip() or "unknown"


def _username_rate_key(username: str) -> str:
    normalized = (username or "").strip().lower() or "<empty>"
    return f"auth:login:fail:user:{normalized}"


def _ip_rate_key(ip_address: str) -> str:
    normalized = (ip_address or "unknown").strip() or "unknown"
    return f"auth:login:fail:ip:{normalized}"


def _bump_counter(key: str, ttl_seconds: int) -> int:
    added = cache.add(key, 1, timeout=ttl_seconds)
    if added:
        return 1
    try:
        return cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=ttl_seconds)
        return 1


def _clear_counter(key: str) -> None:
    cache.delete(key)


def _rate_limit_config() -> tuple[int, int, int]:
    return (
        max(0, int(getattr(settings, "AUTH_LOGIN_FAILURE_LIMIT", 5))),
        max(0, int(getattr(settings, "AUTH_LOGIN_IP_FAILURE_LIMIT", 20))),
        max(1, int(getattr(settings, "AUTH_LOGIN_WINDOW_SECONDS", 900))),
    )


def _is_login_rate_limited(username: str, ip_address: str) -> bool:
    username_limit, ip_limit, _window_seconds = _rate_limit_config()
    if username_limit > 0 and (cache.get(_username_rate_key(username)) or 0) >= username_limit:
        return True
    if ip_limit > 0 and (cache.get(_ip_rate_key(ip_address)) or 0) >= ip_limit:
        return True
    return False


def _record_failed_attempt(username: str, ip_address: str) -> None:
    username_limit, ip_limit, window_seconds = _rate_limit_config()
    if username_limit > 0:
        _bump_counter(_username_rate_key(username), window_seconds)
    if ip_limit > 0:
        _bump_counter(_ip_rate_key(ip_address), window_seconds)


def _clear_failed_attempts(username: str, ip_address: str) -> None:
    _clear_counter(_username_rate_key(username))
    _clear_counter(_ip_rate_key(ip_address))


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
    ambito = (data.get("ambito") or "").strip().lower()
    ip_address = _client_ip(request)
    lookup_user = User.objects.filter(username=username).first() if username else None

    if _is_login_rate_limited(username=username, ip_address=ip_address):
        try:
            log_auth_attempt(username=username, success=False, request=request)
        except Exception:
            pass
        _audit_failed_login(request, username=username, user_obj=lookup_user, reason="rate_limited")
        return JsonResponse(
            {"detail": "Too many failed login attempts. Retry later."},
            status=429,
        )

    user = authenticate(request, username=username, password=password)
    if user is None:
        _record_failed_attempt(username=username, ip_address=ip_address)
        try:
            log_auth_attempt(username=username, success=False, request=request)
        except Exception:
            pass
        _audit_failed_login(request, username=username, user_obj=lookup_user)
        return JsonResponse({"detail": "Invalid credentials"}, status=401)
    if not user.is_active:
        _record_failed_attempt(username=username, ip_address=ip_address)
        try:
            log_auth_attempt(username=username, success=False, request=request)
        except Exception:
            pass
        _audit_failed_login(request, username=username, user_obj=user, reason="inactive_user")
        return JsonResponse({"detail": "User disabled"}, status=403)

    # ── Verifica ambito ────────────────────────────────────────────────────
    from auslbo.permissions import _can_access_archie, _is_auslbo_user

    can_archie = getattr(user, "is_superuser", False) or _can_access_archie(user)
    is_portal  = _is_auslbo_user(user)

    if ambito:
        if ambito == "auslbo" and not is_portal:
            _record_failed_attempt(username=username, ip_address=ip_address)
            _audit_failed_login(request, username=username, user_obj=user, reason="ambito_not_allowed")
            return JsonResponse(
                {"detail": "Non sei autorizzato ad accedere al portale AUSL BO."},
                status=403,
            )
        if ambito == "site-repo" and not can_archie:
            _record_failed_attempt(username=username, ip_address=ip_address)
            _audit_failed_login(request, username=username, user_obj=user, reason="ambito_not_allowed")
            return JsonResponse(
                {"detail": "Non sei autorizzato ad accedere al gestionale interno."},
                status=403,
            )
    # ── Fine verifica ambito ───────────────────────────────────────────────

    login(request, user)
    _clear_failed_attempts(username=username, ip_address=ip_address)

    try:
        log_auth_attempt(
            username=username or getattr(user, "username", "") or "",
            success=True,
            request=request,
        )
    except Exception:
        pass

    # Restituisce anche l'ambito effettivo così il frontend sa dove redirigere.
    effective_ambito = "auslbo" if (
        is_portal
        and not can_archie  # utente esclusivamente portal → manda su AUSL BO
        and not ambito      # auto-detect solo se ambito non era specificato
    ) else (ambito or "site-repo")

    return JsonResponse({"detail": "ok", "ambito": effective_ambito})


@require_POST
@csrf_protect
def logout_view(request: HttpRequest) -> JsonResponse:
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
