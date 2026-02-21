from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import Tech, MaintenancePlan, MaintenanceEvent, MaintenanceNotification

@admin.register(Tech)
class TechAdmin(ImportExportModelAdmin):
    list_display = ("id", "first_name", "last_name", "email", "is_active", "deleted_at", "updated_at")
    search_fields = ("first_name", "last_name", "email")
    list_filter = ("is_active", "deleted_at")

@admin.register(MaintenancePlan)
class MaintenancePlanAdmin(ImportExportModelAdmin):
    list_display = ("id", "customer", "title", "schedule_type", "next_due_date", "alert_days_before", "is_active", "deleted_at", "updated_at")
    search_fields = ("title", "customer__code", "customer__name")
    list_filter = ("schedule_type", "is_active", "deleted_at")

@admin.register(MaintenanceEvent)
class MaintenanceEventAdmin(ImportExportModelAdmin):
    list_display = ("id", "plan", "inventory", "performed_at", "result", "tech", "deleted_at", "updated_at")
    search_fields = ("inventory__hostname", "inventory__knumber", "tech__first_name", "tech__last_name")
    list_filter = ("result", "deleted_at")

@admin.register(MaintenanceNotification)
class MaintenanceNotificationAdmin(ImportExportModelAdmin):
    list_display = ("id", "plan", "inventory", "due_date", "sent_at", "status", "deleted_at", "updated_at")
    search_fields = ("recipient_internal", "recipient_tech")
    list_filter = ("status", "deleted_at")
