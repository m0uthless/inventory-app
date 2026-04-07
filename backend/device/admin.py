from django.contrib import admin
from .models import Device, DeviceManufacturer, DeviceRispacs, DeviceStatus, DeviceType, DeviceWifi, Rispacs


@admin.register(DeviceManufacturer)
class DeviceManufacturerAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "logo", "updated_at")
    search_fields = ("name",)


@admin.register(DeviceStatus)
class DeviceStatusAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "updated_at")
    search_fields = ("name",)


@admin.register(DeviceType)
class DeviceTypeAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "dose_sr", "updated_at")
    search_fields = ("name",)
    list_filter = ("dose_sr",)


@admin.register(Rispacs)
class RispacsAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "ip", "port", "aetitle", "updated_at")
    search_fields = ("name", "ip", "aetitle")
    list_filter = ("deleted_at",)


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = (
        "id", "customer", "site", "type", "status", "manufacturer",
        "model", "serial_number", "inventario", "ip",
        "vlan", "wifi", "rispacs", "deleted_at", "updated_at",
    )
    search_fields = ("model", "serial_number", "inventario", "ip", "customer__name", "site__name")
    list_filter = ("type", "status", "manufacturer", "vlan", "wifi", "rispacs", "deleted_at")
    raw_id_fields = ("customer", "site", "type", "status", "manufacturer")


@admin.register(DeviceRispacs)
class DeviceRispacsAdmin(admin.ModelAdmin):
    list_display = ("id", "device", "rispacs")
    list_select_related = ("device", "rispacs")
    raw_id_fields = ("device", "rispacs")


@admin.register(DeviceWifi)
class DeviceWifiAdmin(admin.ModelAdmin):
    list_display = ("id", "device", "ip", "scad_certificato")
    search_fields = ("ip",)
    raw_id_fields = ("device",)
