from django.contrib import admin
from portal.models import PortalUserProfile


@admin.register(PortalUserProfile)
class PortalUserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "customer", "customers_count", "is_active_display", "created_at")
    list_select_related = ("user", "customer")
    search_fields = ("user__username", "user__email", "customer__name")
    autocomplete_fields = ("user", "customer", "customers")
    filter_horizontal = ("customers",)
    readonly_fields = ("created_at", "updated_at", "is_active_display")
    fieldsets = (
        (
            "Utente Portal",
            {
                "fields": ("user", "customer", "customers", "notes"),
                "description": (
                    "'customer' è il cliente di DEFAULT (mostrato al login). "
                    "'customers' sono TUTTI i clienti selezionabili nel portale: "
                    "deve sempre includere anche il cliente di default, altrimenti "
                    "l'accesso dell'utente si blocca (vedi 'Attivo')."
                ),
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

    @admin.display(description="N. clienti")
    def customers_count(self, obj):
        return obj.customers.count()

    @admin.display(description="Attivo", boolean=True)
    def is_active_display(self, obj):
        return obj.is_active
