from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import WikiCategory, WikiPage, WikiAttachment, WikiLink, WikiQuery, WikiQueryLanguage

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

@admin.register(WikiQueryLanguage)
class WikiQueryLanguageAdmin(ImportExportModelAdmin):
    list_display = ("id", "key", "label", "color", "text_color", "sort_order", "is_active", "deleted_at")
    search_fields = ("key", "label")
    list_filter = ("is_active", "deleted_at")
    ordering = ("sort_order", "label")

@admin.register(WikiQuery)
class WikiQueryAdmin(ImportExportModelAdmin):
    list_display = ("id", "title", "language", "use_count", "created_by", "updated_at", "deleted_at")
    search_fields = ("title", "description", "body", "tags")
    list_filter = ("language", "deleted_at")
    readonly_fields = ("use_count", "created_by", "updated_by", "created_at", "updated_at")
