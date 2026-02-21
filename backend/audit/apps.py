from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "audit"
    verbose_name = "Audit"

    def ready(self):
        # Hook signals (e.g. user_logged_in)
        from . import signals  # noqa: F401
