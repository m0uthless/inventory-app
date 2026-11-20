from django.contrib import admin

from .models import Contract, ContractReminder, Seller


@admin.register(Seller)
class SellerAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "email", "phone", "user", "is_active")
    list_filter = ("is_active", "deleted_at")
    search_fields = ("name", "email")


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ("code", "customer", "end_date", "status")
    list_filter = ("status", "contract_type", "deleted_at")
    search_fields = ("code", "title", "customer__name")
    autocomplete_fields = ("customer",)


@admin.register(ContractReminder)
class ContractReminderAdmin(admin.ModelAdmin):
    """Storico dei promemoria di rinnovo: solo consultazione."""

    list_display = ("contract", "due_on", "ok", "to", "sent_at")
    list_filter = ("ok",)
    search_fields = ("contract__code",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
