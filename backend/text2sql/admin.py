from django.contrib import admin

from text2sql.models import Text2SqlRequest


@admin.register(Text2SqlRequest)
class Text2SqlRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "kind", "feedback", "created_at")
    list_filter = ("status", "kind", "feedback")
    search_fields = ("question",)
    readonly_fields = ("created_at", "started_at", "finished_at", "feedback_at", "reviewed_at")
