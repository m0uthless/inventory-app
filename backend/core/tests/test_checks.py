from __future__ import annotations

import pytest

from core.checks import check_cross_subdomain_session_config


def test_warns_when_session_cookie_domain_is_set_in_production(settings):
    """ARCH-001 (0.9.1, audit 2026-08-19): dal 2026-08-13 SESSION_COOKIE_DOMAIN
    NON deve essere impostato, perché rompe l'ambito multi-customer del
    Portal. Il check deve segnalare quando è impostato, non quando è vuoto."""
    settings.DEBUG = False
    settings.SESSION_COOKIE_DOMAIN = ".biotron.it"
    settings.SECURE_SSL_REDIRECT = True

    warnings = check_cross_subdomain_session_config(app_configs=None)

    ids = {w.id for w in warnings}
    assert "core.W001" in ids


def test_no_warning_when_session_cookie_domain_is_unset_in_production(settings):
    settings.DEBUG = False
    settings.SESSION_COOKIE_DOMAIN = None
    settings.SECURE_SSL_REDIRECT = True

    warnings = check_cross_subdomain_session_config(app_configs=None)

    ids = {w.id for w in warnings}
    assert "core.W001" not in ids


def test_no_checks_run_in_debug_mode(settings):
    settings.DEBUG = True
    settings.SESSION_COOKIE_DOMAIN = ".biotron.it"
    settings.SECURE_SSL_REDIRECT = False

    warnings = check_cross_subdomain_session_config(app_configs=None)

    assert warnings == []
