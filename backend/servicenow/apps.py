from django.apps import AppConfig


class ServicenowConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name  = "servicenow"
    label = "servicenow"
    verbose_name = "ServiceNow Case"
