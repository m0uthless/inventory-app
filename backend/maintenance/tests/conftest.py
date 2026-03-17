"""
Sovrascrive DATABASES con SQLite in-memory per i test di questa directory.
Funziona modificando django.conf.settings direttamente nel hook pytest_configure,
che viene eseguito dopo che pytest-django ha caricato config.settings ma
prima che venga creato il test database.
"""
import pytest


def pytest_configure(config):
    """Patch DATABASES dopo che Django è stato configurato da pytest-django."""
    # Questo hook viene chiamato per ogni conftest.py in ordine di profondità.
    # A questo punto pytest-django ha già impostato DJANGO_SETTINGS_MODULE
    # ma non ha ancora creato il test DB.
    try:
        from django.conf import settings as dj_settings
        if dj_settings.configured:
            dj_settings.DATABASES = {
                "default": {
                    "ENGINE": "django.db.backends.sqlite3",
                    "NAME": ":memory:",
                }
            }
    except Exception:
        pass
