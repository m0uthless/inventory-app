from django.contrib import admin

from text2sql.models import Text2SqlRequest


@admin.register(Text2SqlRequest)
class Text2SqlRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "kind", "feedback", "created_at")
    list_filter = ("status", "kind", "feedback")
    search_fields = ("question",)
    readonly_fields = ("created_at", "started_at", "finished_at", "feedback_at", "reviewed_at")

    # Le domande possono contenere nomi di pazienti: nell'admin le vede solo il
    # superuser, come nella Revisione, qualunque permesso abbia lo staff.
    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
