from django.contrib import admin
from .models import DriveFolder, DriveFile


@admin.register(DriveFolder)
class DriveFolderAdmin(admin.ModelAdmin):
    list_display = ["name", "parent", "children_count", "files_count", "created_by", "created_at", "deleted_at"]
    list_filter  = ["deleted_at", "customers", "allowed_groups"]
    search_fields = ["name"]
    raw_id_fields = ["parent", "created_by"]
    filter_horizontal = ["customers", "allowed_groups"]


@admin.register(DriveFile)
class DriveFileAdmin(admin.ModelAdmin):
    list_display  = ["name", "folder", "mime_type", "size", "created_by", "created_at", "deleted_at"]
    list_filter   = ["deleted_at", "customers", "allowed_groups", "mime_type"]
    search_fields = ["name"]
    raw_id_fields = ["folder", "created_by"]
    filter_horizontal = ["customers", "allowed_groups"]
    readonly_fields = ["size", "mime_type"]
