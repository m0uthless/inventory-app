from django.core.management.base import BaseCommand
from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType, AppSetting
from custom_fields.models import CustomFieldDefinition
from attendance.models import LeaveArea
from issues.models import IssueCategory
from device.models import DeviceManufacturer, DeviceStatus, DeviceType
from servicenow.models import ServiceNowCaseType

class Command(BaseCommand):
    help = "Seed default statuses, inventory types, and app settings."

    def handle(self, *args, **options):
        customer_statuses = [
            ("biotron", "Biotron", 10),
            ("philips", "Philips", 20),
            ("mi", "Medial Imaging", 30),
            ("dismissed", "Dismesso", 40),
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
            ("management", "Management", 10),
            ("host", "Host", 20),
            ("wfm", "PACS", 30),
            ("csap", "CSAP", 40),
            ("vue_motion", "Vue Motion", 50),
            ("orthoview", "Orthoview", 60),
            ("speech", "Speech", 70),
            ("pc_robot", "Robot PC", 80),
            ("robot", "Robot", 90),
            ("storage", "Storage", 100),
            ("load_balancer", "Load Balancer", 110),
            ("workstation", "Workstation", 120),
            ("service_pc", "Service PC", 130),
        ]
        for key, label, sort_order in inventory_types:
            InventoryType.objects.update_or_create(
                key=key, defaults={"label": label, "sort_order": sort_order, "is_active": True, "deleted_at": None}
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

        # --- Attendance: aree piano ferie ---
        leave_areas = [
            ("avec", "AVEC", 10),
            ("mi_hcis", "Privati", 20),
            ("avr", "Romagna", 30),
            ("mi_er", "MI - Emilia Romagna", 40),
            ("mi_tr", "MI - Triveneto", 50),
            ("uff", "Ufficio", 60),
        ]
        for key, label, sort_order in leave_areas:
            LeaveArea.objects.update_or_create(
                key=key, defaults={"label": label, "sort_order": sort_order, "is_active": True, "deleted_at": None}
            )

        # --- Issues: categorie ticket ---
        issue_categories = [
            ("pacs", "PACS", 10),
            ("ris", "RIS", 20),
            ("network", "Rete", 30),
            ("hw", "Hardware", 40),
            ("org", "Organizzativa", 50),
        ]
        for key, label, sort_order in issue_categories:
            IssueCategory.objects.update_or_create(
                key=key, defaults={"label": label, "sort_order": sort_order, "is_active": True, "deleted_at": None}
            )

        # --- Device: produttori (senza loghi: da caricare manualmente dal pannello) ---
        device_manufacturers = [
            "Philips", "Carestream", "Esaote", "GE", "Siemens", "Canon",
            "Mindray", "Boston Scientific", "Fuji", "Agfa", "Samsung",
            "United", "IMS", "Hologic", "GMM",
        ]
        for name in device_manufacturers:
            DeviceManufacturer.objects.update_or_create(name=name, defaults={"deleted_at": None})

        # --- Device: stati ---
        device_statuses = ["In Uso", "Dismesso", "Prossima installazione"]
        for name in device_statuses:
            DeviceStatus.objects.update_or_create(name=name, defaults={"deleted_at": None})

        # --- Device: tipi/modalità (dose_sr = supporto DoseSR) ---
        device_types = [
            ("Digitale Diretta", True),
            ("Ecografo", False),
            ("Risonanza Magnetica", False),
            ("TAC", True),
            ("IVUS", False),
            ("CR", False),
            ("Angiografo", True),
            ("PET", True),
            ("Mammografo", True),
            ("Ortopantomografo", True),
            ("Conebeam TC", True),
            ("Endoscopia", False),
            ("BV", True),
        ]
        for name, dose_sr in device_types:
            DeviceType.objects.update_or_create(name=name, defaults={"dose_sr": dose_sr, "deleted_at": None})

        # --- ServiceNow: type per categoria (Biotron / Philips) ---
        servicenow_case_types = [
            ("biotron", "L1", 0),
            ("biotron", "PRIVATI", 1),
            ("biotron", "CDD", 2),
            ("philips", "L1", 0),
            ("philips", "EBIT", 1),
            ("philips", "RIS", 2),
            ("philips", "AC", 3),
            ("philips", "GEMELLI", 4),
        ]
        for category, name, order in servicenow_case_types:
            ServiceNowCaseType.objects.update_or_create(
                category=category, name=name, defaults={"order": order, "active": True}
            )

        self.stdout.write(self.style.SUCCESS("Seed completato."))
