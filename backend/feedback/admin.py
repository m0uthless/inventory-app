from django.contrib import admin

from .models import ReportRequest


@admin.register(ReportRequest)
class ReportRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'kind', 'section', 'created_by', 'created_at')
    list_filter = ('kind', 'section', 'created_at')
    search_fields = ('description', 'created_by__username', 'created_by__first_name', 'created_by__last_name')
    readonly_fields = ('created_at', 'updated_at')
