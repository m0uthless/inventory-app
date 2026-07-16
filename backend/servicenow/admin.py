from django.contrib import admin
from import_export.admin import ImportExportModelAdmin

from servicenow.models import ServiceNowCase, ServiceNowCaseType


@admin.register(ServiceNowCaseType)
class ServiceNowCaseTypeAdmin(admin.ModelAdmin):
    list_display   = ("name", "category", "order", "active")
    list_editable  = ("order", "active")
    list_filter    = ("category", "active")
    search_fields  = ("name",)
    ordering       = ("category", "order", "name")


@admin.register(ServiceNowCase)
class ServiceNowCaseAdmin(ImportExportModelAdmin):
    list_display   = (
        "id", "number", "account", "priority", "category", "case_type", "status",
        "assigned_to", "opened_date", "created_at", "deleted_at",
    )
    list_filter    = ("status", "priority", "category", "case_type", "deleted_at")
    search_fields  = ("number", "account", "short_description")
    autocomplete_fields = ("assigned_to", "case_type")
    readonly_fields = ("created_at", "updated_at", "deleted_at")
    fieldsets = (
        (None, {"fields": ("number", "account", "short_description", "screenshot")}),
        ("Classificazione", {"fields": ("priority", "category", "case_type", "opened_date")}),
        ("Gestione interna", {"fields": ("status", "assigned_to")}),
        ("Metadata", {"fields": ("created_at", "updated_at", "deleted_at"), "classes": ("collapse",)}),
    )
