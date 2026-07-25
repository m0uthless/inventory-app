from django.contrib import admin

from .models import PurchaseOrderEntry


@admin.register(PurchaseOrderEntry)
class PurchaseOrderEntryAdmin(admin.ModelAdmin):
    list_display = (
        "id", "offer_date", "client_name", "customer", "kind", "status",
        "amount", "invoice_number", "created_by", "deleted_at",
    )
    list_filter = ("kind", "status", "amount_mode", "deleted_at")
    search_fields = (
        "description", "client_name", "purchase_order",
        "invoice_number", "customer__name",
    )
    readonly_fields = ("created_at", "updated_at", "sent_at", "received_at", "invoiced_at")
    autocomplete_fields = ("customer",)
