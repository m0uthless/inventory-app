from django.contrib import admin

from .models import Contract, Seller


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
