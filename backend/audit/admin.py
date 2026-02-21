from django.contrib import admin

from audit.models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "action", "actor", "content_type", "object_id", "subject", "object_repr")
    list_filter = ("action", "content_type", "actor")
    search_fields = ("object_id", "subject", "object_repr", "path")
    ordering = ("-created_at",)
    readonly_fields = (
        "created_at",
        "action",
        "actor",
        "content_type",
        "object_id",
        "object_repr",
        "subject",
        "changes",
        "path",
        "method",
        "ip_address",
        "user_agent",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
