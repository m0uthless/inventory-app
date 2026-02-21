from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import Customer, Site, Contact

@admin.register(Customer)
class CustomerAdmin(ImportExportModelAdmin):
    list_display = ("id", "code", "name", "status", "deleted_at", "updated_at")
    search_fields = ("code", "name", "vat_number", "tax_code")
    list_filter = ("status", "deleted_at")

@admin.register(Site)
class SiteAdmin(ImportExportModelAdmin):
    list_display = ("id", "customer", "name", "status", "city", "province", "deleted_at", "updated_at")
    search_fields = ("name", "city", "province", "zip", "address_line1")
    list_filter = ("status", "country", "deleted_at")

@admin.register(Contact)
class ContactAdmin(ImportExportModelAdmin):
    list_display = ("id", "customer", "site", "name", "email", "phone", "is_primary", "deleted_at", "updated_at")
    search_fields = ("name", "email", "phone", "role_department")
    list_filter = ("is_primary", "deleted_at")
