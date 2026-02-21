from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType, AppSetting

admin.site.site_header = "Site Repository"
admin.site.site_title = "Site Repository - Admin"
admin.site.index_title = "Pannello di amministrazione"

@admin.register(CustomerStatus)
class CustomerStatusAdmin(ImportExportModelAdmin):
    list_display = ("id", "key", "label", "sort_order", "is_active", "deleted_at", "updated_at")
    list_filter = ("is_active", "deleted_at")
    search_fields = ("key", "label")

@admin.register(SiteStatus)
class SiteStatusAdmin(ImportExportModelAdmin):
    list_display = ("id", "key", "label", "sort_order", "is_active", "deleted_at", "updated_at")
    list_filter = ("is_active", "deleted_at")
    search_fields = ("key", "label")

@admin.register(InventoryStatus)
class InventoryStatusAdmin(ImportExportModelAdmin):
    list_display = ("id", "key", "label", "sort_order", "is_active", "deleted_at", "updated_at")
    list_filter = ("is_active", "deleted_at")
    search_fields = ("key", "label")

@admin.register(InventoryType)
class InventoryTypeAdmin(ImportExportModelAdmin):
    list_display = ("id", "key", "label", "sort_order", "is_active", "deleted_at", "updated_at")
    list_filter = ("is_active", "deleted_at")
    search_fields = ("key", "label")

@admin.register(AppSetting)
class AppSettingAdmin(ImportExportModelAdmin):
    list_display = ("key", "value", "deleted_at", "updated_at")
    list_filter = ("deleted_at",)
    search_fields = ("key", "value")
