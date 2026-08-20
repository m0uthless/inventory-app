"""Custom middleware utilities.

This project uses session authentication (cookies). For a SPA served from a different
origin in *development* (e.g. Vite on :5173) Django's CSRF middleware can reject
requests due to strict Origin/Referer checks.

`CsrfAllowAllOriginsMiddleware` is a development helper that relaxes Origin/Referer
checks while **keeping CSRF token validation active**.

IMPORTANT:
- It is effective only when `settings.DEBUG` is True.
- It never disables CSRF token validation.

In production you should configure `CSRF_TRUSTED_ORIGINS` properly instead.
"""

from __future__ import annotations

import time

from django.conf import settings
from django.contrib.auth import logout
from django.http import HttpRequest, JsonResponse
from django.middleware.csrf import CsrfViewMiddleware


class CsrfAllowAllOriginsMiddleware(CsrfViewMiddleware):
    """Relax Origin/Referer checks in development without disabling CSRF tokens."""

    def _should_relax(self) -> bool:
        return bool(
            getattr(settings, "DEBUG", False)
            and getattr(settings, "CSRF_ALLOW_ALL_ORIGINS", False)
        )

    def _origin_verified(self, request: HttpRequest) -> bool:
        if self._should_relax():
            return True
        return super()._origin_verified(request)

    def _check_referer(self, request: HttpRequest) -> None:
        if self._should_relax():
            return
        super()._check_referer(request)


def _idle_user_summary(user) -> dict:
    """Riassunto minimo dell'utente per il payload 401 idle_lock.

    Serve al frontend per popolare la LockScreen (nome, avatar) anche
    quando la richiesta bloccata è la primissima dopo un refresh di
    pagina — in quel caso lo stato React `me` è ancora vuoto (perso col
    refresh) e non c'è altro modo di sapere chi è l'utente senza
    aggirare il blocco stesso con un'altra chiamata.
    """
    avatar_url = None
    try:
        from core.models import UserProfile

        profile = UserProfile.objects.filter(user=user).first()
        if profile and profile.avatar:
            avatar_url = profile.avatar.url
    except Exception:
        pass
    return {
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "avatar": avatar_url,
    }


class SessionIdleTimeoutMiddleware:
    """Applica server-side i timeout di inattività "lock"/"logout".

    0.9.0: prima di questa modifica il blocco per inattività (LockScreen)
    era gestito SOLO lato client (`useIdleTimer`, stato React `locked`).
    Un semplice refresh della pagina reinizializzava lo stato React senza
    toccare la sessione Django — che di default non scade mai per
    inattività (solo dopo SESSION_COOKIE_AGE, 2 settimane) — quindi il
    refresh bypassava completamente il blocco password.

    Questa middleware traccia `last_activity` in sessione (timestamp unix)
    e ad ogni richiesta autenticata verso `/api/*` (esclusi gli endpoint di
    auth stessi, altrimenti login/logout si romperebbero) confronta il
    tempo trascorso con le soglie per ambito in `settings.SESSION_IDLE_*`:

    - oltre la soglia "logout": la sessione viene invalidata (`logout()`,
      equivalente a `session.flush()`) e la risposta è 401 con
      `code="idle_logout"` — il frontend deve rimandare al login completo.
    - oltre la soglia "lock" (ma sotto quella di logout): la sessione
      RESTA valida (non si perde il login), ma la richiesta corrente e
      tutte le successive vengono rifiutate con 401 e
      `code="idle_lock"`, finché l'utente non rifà login (stesso
      username/password, vedi LockScreen.onSubmitPassword → login()) —
      questo aggiorna `last_activity` e sblocca.
    - sotto la soglia "lock": `last_activity` viene aggiornato e la
      richiesta prosegue normalmente.

    Endpoint esclusi dal controllo (per non bloccare login/logout/csrf):
    tutto ciò che sta sotto `/api/auth/`.
    """

    EXEMPT_PREFIX = "/api/auth/"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest):
        response = self._enforce(request)
        if response is not None:
            return response
        return self.get_response(request)

    def _enforce(self, request: HttpRequest):
        if request.path.startswith(self.EXEMPT_PREFIX):
            return None

        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return None

        session = request.session
        default_ambito = getattr(settings, "SESSION_IDLE_DEFAULT_AMBITO", "site-repo")
        ambito = session.get("ambito") or default_ambito

        lock_seconds = settings.SESSION_IDLE_LOCK_SECONDS.get(
            ambito, settings.SESSION_IDLE_LOCK_SECONDS[default_ambito]
        )
        logout_seconds = settings.SESSION_IDLE_LOGOUT_SECONDS.get(
            ambito, settings.SESSION_IDLE_LOGOUT_SECONDS[default_ambito]
        )

        now = time.time()
        last_activity = session.get("last_activity")

        if last_activity is not None:
            idle_seconds = now - last_activity

            if idle_seconds > logout_seconds:
                logout(request)
                return JsonResponse(
                    {"detail": "Sessione scaduta per inattività.", "code": "idle_logout"},
                    status=401,
                )

            if idle_seconds > lock_seconds:
                # Non tocchiamo last_activity: la sessione resta "in
                # attesa" finché non arriva un login valido (che aggiorna
                # last_activity esplicitamente, vedi login_view). Se
                # toccassimo last_activity qui, una singola richiesta
                # bloccata basterebbe a "sbloccare" tutte le successive.
                return JsonResponse(
                    {
                        "detail": "Sessione bloccata per inattività.",
                        "code": "idle_lock",
                        "user": _idle_user_summary(user),
                    },
                    status=401,
                )

        session["last_activity"] = now
        return None
