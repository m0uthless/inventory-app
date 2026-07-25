from django.contrib import admin

from .models import (
    ExpenseItem,
    ExpenseKmTrip,
    ExpenseReceipt,
    ExpenseReport,
    TechnicianKmRate,
)


class ExpenseItemInline(admin.TabularInline):
    model = ExpenseItem
    extra = 0
    fields = ("category", "date", "description", "amount")
    show_change_link = True


@admin.register(ExpenseReport)
class ExpenseReportAdmin(admin.ModelAdmin):
    list_display = ("user", "number", "year", "month", "status", "advances_total", "validated_by")
    list_filter = ("status", "year", "month")
    search_fields = ("user__username", "user__first_name", "user__last_name")
    autocomplete_fields = ("user", "validated_by", "created_by", "updated_by")
    ordering = ("-year", "-month")
    inlines = [ExpenseItemInline]


class ExpenseKmTripInline(admin.TabularInline):
    model = ExpenseKmTrip
    extra = 0
    fields = ("date", "destination", "km")


@admin.register(ExpenseItem)
class ExpenseItemAdmin(admin.ModelAdmin):
    list_display = ("report", "category", "date", "description", "amount")
    list_filter = ("category",)
    search_fields = ("report__user__username", "description")
    autocomplete_fields = ("report",)
    inlines = [ExpenseKmTripInline]


@admin.register(TechnicianKmRate)
class TechnicianKmRateAdmin(admin.ModelAdmin):
    list_display = ("user", "rate_per_km")
    search_fields = ("user__username", "user__first_name", "user__last_name")
    autocomplete_fields = ("user",)
    ordering = ("user__username",)


@admin.register(ExpenseReceipt)
class ExpenseReceiptAdmin(admin.ModelAdmin):
    list_display = ("item", "file", "ocr_amount", "ocr_date", "created_at")
    search_fields = ("item__report__user__username",)
    autocomplete_fields = ("item",)
    ordering = ("-created_at",)
