from django.contrib import admin
from vlan.models import Vlan


@admin.register(Vlan)
class VlanAdmin(admin.ModelAdmin):
    list_display = ["vlan_id", "name", "customer", "site", "network", "gateway", "lan"]
    list_filter = ["customer", "site"]
    search_fields = ["name", "vlan_id", "network", "gateway"]
    ordering = ["site", "vlan_id"]
