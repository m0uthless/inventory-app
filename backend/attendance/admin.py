from django.contrib import admin

from .models import Absence, Holiday, LeaveArea


@admin.register(LeaveArea)
class LeaveAreaAdmin(admin.ModelAdmin):
    list_display = ("label", "key", "sort_order", "is_active")
    list_editable = ("sort_order", "is_active")
    search_fields = ("key", "label")
    ordering = ("sort_order", "label")


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ("date", "label", "scope")
    list_filter = ("areas",)
    search_fields = ("label",)
    autocomplete_fields = ("areas",)
    date_hierarchy = "date"
    ordering = ("date",)

    @admin.display(description="Ambito")
    def scope(self, obj):
        areas = list(obj.areas.all())
        return "Tutte le aree" if not areas else ", ".join(a.label for a in areas)


@admin.register(Absence)
class AbsenceAdmin(admin.ModelAdmin):
    list_display = ("user", "date", "day_part", "reason", "status", "is_hourly", "validated_by")
    list_filter = ("reason", "status", "day_part")
    search_fields = ("user__username", "user__first_name", "user__last_name", "note")
    date_hierarchy = "date"
    autocomplete_fields = ("user", "validated_by")
    ordering = ("-date", "day_part")
