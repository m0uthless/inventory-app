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

from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware


class CsrfAllowAllOriginsMiddleware(CsrfViewMiddleware):
    """Relax Origin/Referer checks in development without disabling CSRF tokens."""

    def _should_relax(self) -> bool:
        return bool(
            getattr(settings, "DEBUG", False)
            and getattr(settings, "CSRF_ALLOW_ALL_ORIGINS", False)
        )

    def _origin_verified(self, request) -> bool:  # type: ignore[override]
        if self._should_relax():
            return True
        return super()._origin_verified(request)

    def _check_referer(self, request) -> None:  # type: ignore[override]
        if self._should_relax():
            return None
        return super()._check_referer(request)
