from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from import_export.admin import ImportExportModelAdmin
from .models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType, AppSetting, UserProfile

admin.site.site_header = "Site Repository"
admin.site.site_title = "Site Repository - Admin"
admin.site.index_title = "Pannello di amministrazione"


# ─── Estensione admin User: campo Philips sul profilo, editabile solo da qui ──

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = "Profilo"
    fields = ("is_philips", "is_servicenow_technician")


User = get_user_model()

admin.site.unregister(User)


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    inlines = (UserProfileInline,)
    list_display = UserAdmin.list_display + ("get_is_philips", "get_is_servicenow_technician")

    @admin.display(boolean=True, description="Philips")
    def get_is_philips(self, obj):
        try:
            return obj.profile.is_philips
        except UserProfile.DoesNotExist:
            return False

    @admin.display(boolean=True, description="Tecnico ServiceNow")
    def get_is_servicenow_technician(self, obj):
        try:
            return obj.profile.is_servicenow_technician
        except UserProfile.DoesNotExist:
            return True



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
    list_display = ("id", "key", "label", "sort_order", "is_active", "is_hw", "deleted_at", "updated_at")
    list_filter = ("is_active", "is_hw", "deleted_at")
    list_editable = ("is_hw",)
    search_fields = ("key", "label")

@admin.register(AppSetting)
class AppSettingAdmin(ImportExportModelAdmin):
    list_display = ("key", "value", "deleted_at", "updated_at")
    list_filter = ("deleted_at",)
    search_fields = ("key", "value")

from core.models import Announcement

@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display  = ['title', 'category', 'created_by', 'created_at']
    list_filter   = ['category']
    search_fields = ['title', 'body']
