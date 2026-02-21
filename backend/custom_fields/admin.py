from django.contrib import admin

from custom_fields.models import CustomFieldDefinition


@admin.register(CustomFieldDefinition)
class CustomFieldDefinitionAdmin(admin.ModelAdmin):
    list_display = ("entity", "key", "label", "field_type", "required", "is_active", "sort_order", "deleted_at")
    list_filter = ("entity", "field_type", "required", "is_active")
    search_fields = ("key", "label")
    ordering = ("entity", "sort_order", "label")
