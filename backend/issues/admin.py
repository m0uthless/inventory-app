from django.contrib import admin
from import_export.admin import ImportExportModelAdmin

from issues.models import Issue, IssueCategory, IssueComment


@admin.register(IssueCategory)
class IssueCategoryAdmin(ImportExportModelAdmin):
    list_display  = ("id", "key", "label", "sort_order", "is_active", "deleted_at")
    list_filter   = ("is_active",)
    search_fields = ("key", "label")
    ordering      = ("sort_order", "label")


class IssueCommentInline(admin.TabularInline):
    model          = IssueComment
    extra          = 0
    readonly_fields = ("author", "created_at", "updated_at")
    fields         = ("author", "body", "created_at")


@admin.register(Issue)
class IssueAdmin(ImportExportModelAdmin):
    list_display   = (
        "id", "title", "customer", "priority", "status",
        "assigned_to", "due_date", "servicenow_id", "created_at", "deleted_at",
    )
    list_filter    = ("status", "priority", "category", "deleted_at")
    search_fields  = ("title", "description", "servicenow_id", "customer__name")
    autocomplete_fields = ("customer", "site", "assigned_to", "created_by")
    readonly_fields = ("created_at", "updated_at", "deleted_at")
    inlines        = [IssueCommentInline]
    fieldsets = (
        (None, {"fields": ("title", "description", "servicenow_id")}),
        ("Classificazione", {"fields": ("priority", "status", "category", "due_date")}),
        ("Relazioni", {"fields": ("customer", "site", "assigned_to", "created_by")}),
        ("Metadata", {"fields": ("created_at", "updated_at", "deleted_at"), "classes": ("collapse",)}),
    )


@admin.register(IssueComment)
class IssueCommentAdmin(admin.ModelAdmin):
    list_display  = ("id", "issue", "author", "created_at")
    list_filter   = ("created_at",)
    search_fields = ("body", "author__username", "issue__title")
    readonly_fields = ("created_at", "updated_at")
