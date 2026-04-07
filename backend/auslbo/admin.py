from django.contrib import admin
from auslbo.models import AuslBoUserProfile


@admin.register(AuslBoUserProfile)
class AuslBoUserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "customer", "is_active_display", "created_at")
    list_select_related = ("user", "customer")
    search_fields = ("user__username", "user__email", "customer__name")
    autocomplete_fields = ("user", "customer")
    readonly_fields = ("created_at", "updated_at", "is_active_display")
    fieldsets = (
        (
            "Utente Portal",
            {
                "fields": ("user", "customer", "notes"),
            },
        ),
        (
            "Info",
            {
                "fields": ("is_active_display", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(description="Attivo", boolean=True)
    def is_active_display(self, obj):
        return obj.is_active
