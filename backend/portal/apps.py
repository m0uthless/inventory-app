from django.apps import AppConfig


class PortalConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "portal"
    verbose_name = "Portal"

    def ready(self):
        # Rinomina i gruppi legacy (auslbo_users / user_auslbo → user_portal)
        # dopo ogni migrate. Idempotente.
        from django.db.models.signals import post_migrate
        from portal.signals import create_portal_group
        post_migrate.connect(create_portal_group, sender=self)
