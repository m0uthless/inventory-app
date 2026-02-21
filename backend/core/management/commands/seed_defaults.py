from django.core.management.base import BaseCommand
from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType, AppSetting
from custom_fields.models import CustomFieldDefinition

class Command(BaseCommand):
    help = "Seed default statuses, inventory types, and app settings."

    def handle(self, *args, **options):
        customer_statuses = [
            ("prospect", "Prospect", 10),
            ("active", "Attivo", 20),
            ("on_hold", "In pausa", 30),
            ("archived", "Archiviato", 40),
        ]
        for key, label, sort_order in customer_statuses:
            CustomerStatus.objects.update_or_create(
                key=key, defaults={"label": label, "sort_order": sort_order, "is_active": True, "deleted_at": None}
            )

        site_statuses = [
            ("active", "Attivo", 10),
            ("temporarily_closed", "Chiuso temporaneamente", 20),
            ("archived", "Archiviato", 30),
        ]
        for key, label, sort_order in site_statuses:
            SiteStatus.objects.update_or_create(
                key=key, defaults={"label": label, "sort_order": sort_order, "is_active": True, "deleted_at": None}
            )

        inventory_statuses = [
            ("in_use", "In uso", 10),
            ("to_install", "Da installare", 20),
            ("maintenance", "In manutenzione", 30),
            ("repair", "Guasto / da riparare", 40),
            ("retired", "Dismesso", 50),
        ]
        for key, label, sort_order in inventory_statuses:
            InventoryStatus.objects.update_or_create(
                key=key, defaults={"label": label, "sort_order": sort_order, "is_active": True, "deleted_at": None}
            )

        inventory_types = [
            "management", "host1", "host2", "host3", "host4", "wfm", "vue_motion", "orthoview", "speech",
            "pc_robot", "robot", "storage", "load_balancer1", "load_balancer2", "workstation", "service_pc"
        ]
        sort_order = 10
        for key in inventory_types:
            InventoryType.objects.update_or_create(
                key=key, defaults={"label": key, "sort_order": sort_order, "is_active": True, "deleted_at": None}
            )
            sort_order += 10

        AppSetting.objects.update_or_create(
            key="maintenance_alert_email",
            defaults={"value": "maintenance@example.local", "deleted_at": None},
        )


        # --- Custom field definitions (dynamic fields) ---
        customer_cfs = [
            ("indirizzo", "Indirizzo", "text", False, None, ["Indirizzo", "address"], 10),
            ("cap", "CAP", "text", False, None, ["CAP", "postal_code"], 20),
            ("citta", "Città", "text", False, None, ["Città", "city", "citta"], 30),
            ("provincia", "Provincia", "text", False, None, ["Provincia", "prov"], 40),
        ]
        for key, label, field_type, required, options, aliases, sort_order in customer_cfs:
            CustomFieldDefinition.objects.update_or_create(
                entity="customer",
                key=key,
                defaults={
                    "label": label,
                    "field_type": field_type,
                    "required": required,
                    "options": options,
                    "aliases": aliases,
                    "sort_order": sort_order,
                    "is_active": True,
                    "deleted_at": None,
                },
            )

        self.stdout.write(self.style.SUCCESS("Seed completato."))
