"""
Usa SQLite in-memory per i test del modulo device.
"""


def pytest_configure(config):
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
