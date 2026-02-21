from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import Inventory

@admin.register(Inventory)
class InventoryAdmin(ImportExportModelAdmin):
    list_display = ("id", "customer", "site", "name", "knumber", "serial_number", "type", "status", "hostname", "local_ip", "deleted_at", "updated_at")
    search_fields = ("name", "knumber", "serial_number", "hostname", "local_ip", "srsa_ip", "manufacturer", "model")
    list_filter = ("status", "type", "deleted_at")
