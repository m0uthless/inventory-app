from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import WikiCategory, WikiPage, WikiAttachment, WikiLink

@admin.register(WikiCategory)
class WikiCategoryAdmin(ImportExportModelAdmin):
    list_display = ("id", "name", "sort_order", "deleted_at", "updated_at")
    search_fields = ("name", "description")
    list_filter = ("deleted_at",)

@admin.register(WikiPage)
class WikiPageAdmin(ImportExportModelAdmin):
    list_display = ("id", "title", "slug", "category", "is_published", "pdf_template_key", "deleted_at", "updated_at")
    search_fields = ("title", "slug", "summary", "content_markdown")
    list_filter = ("is_published", "category", "deleted_at")

@admin.register(WikiAttachment)
class WikiAttachmentAdmin(ImportExportModelAdmin):
    list_display = ("id", "page", "filename", "mime_type", "size_bytes", "deleted_at", "updated_at")
    search_fields = ("filename", "storage_key")
    list_filter = ("mime_type", "deleted_at")

@admin.register(WikiLink)
class WikiLinkAdmin(ImportExportModelAdmin):
    list_display = ("id", "page", "entity_type", "entity_id", "deleted_at", "updated_at")
    search_fields = ("entity_type", "entity_id")
    list_filter = ("entity_type", "deleted_at")
