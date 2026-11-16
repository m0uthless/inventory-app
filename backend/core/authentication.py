"""Autenticazione DRF del progetto."""
from __future__ import annotations

from rest_framework.authentication import SessionAuthentication


class SessionAuthentication401(SessionAuthentication):
    """Autenticazione a sessione che risponde 401 (non 403) senza sessione.

    B-06 (QA 2026-11-15): DRF risponde 401 solo se la prima classe di
    autenticazione fornisce un header ``WWW-Authenticate``; SessionAuthentication
    non lo fa, quindi a sessione scaduta l'API rispondeva 403 e la SPA restava
    aperta con liste vuote invece di tornare al login (il client gestisce già
    il 401). Lo schema "Session" non è uno standard HTTP e il browser non apre
    nessuna finestra di login.
    """

    def authenticate_header(self, request):
        return 'Session realm="archie"'
