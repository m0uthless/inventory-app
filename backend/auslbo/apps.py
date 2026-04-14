from django.apps import AppConfig


class AuslBoConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "auslbo"
    verbose_name = "AUSL BO"

    def ready(self):
        # Rinomina i gruppi legacy (auslbo_users → user_auslbo, viewer → user)
        # dopo ogni migrate. Idempotente.
        from django.db.models.signals import post_migrate
        from auslbo.signals import create_auslbo_group
        post_migrate.connect(create_auslbo_group, sender=self)
