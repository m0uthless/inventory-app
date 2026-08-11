from django.contrib import admin

from .models import PurchaseOrderDocument, PurchaseOrderEntry


@admin.register(PurchaseOrderEntry)
class PurchaseOrderEntryAdmin(admin.ModelAdmin):
    list_display = (
        "id", "offer_date", "client_name", "customer", "kind", "status",
        "amount", "invoice_number", "created_by", "deleted_at",
    )
    list_filter = ("kind", "status", "amount_mode", "deleted_at")
    search_fields = (
        "description", "client_name", "purchase_order",
        "invoice_number", "customer__name", "customer_placeholder",
    )
    readonly_fields = ("created_at", "updated_at", "sent_at", "received_at", "invoiced_at")
    autocomplete_fields = ("customer",)


@admin.register(PurchaseOrderDocument)
class PurchaseOrderDocumentAdmin(admin.ModelAdmin):
    list_display = ("id", "entry", "kind", "original_filename", "uploaded_at", "uploaded_by")
    list_filter = ("kind",)
    search_fields = ("original_filename", "entry__client_name", "entry__description")
    readonly_fields = ("uploaded_at",)
    autocomplete_fields = ("entry",)
