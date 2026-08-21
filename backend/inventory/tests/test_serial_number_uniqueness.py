"""Test di regressione 0.9.1 (WP-05, archie-dataconstraints — audit
2026-08-19, DATA-002): serial_number deve avere un vincolo DB di unicità
(tra inventory attivi); knumber NO — confermato con Fede: più inventory
possono condividere legittimamente lo stesso knumber (es. un host fisico
e le sue macchine virtuali).

Il secondo test è deliberato: non è solo "assenza di regressione", è la
verifica esplicita che il caso d'uso host+VM funzioni a livello DB, così
un domani nessuno reintroduce per sbaglio il vincolo su knumber pensando
fosse un refuso (come inizialmente sembrava dall'audit, prima di
verificare la cronologia delle migration).
"""
import pytest
from django.db import IntegrityError, transaction

from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType
from crm.models import Customer, Site
from inventory.models import Inventory

pytestmark = pytest.mark.django_db


@pytest.fixture
def inventory_lookups():
    customer_status, _ = CustomerStatus.objects.get_or_create(
        key="active_data002", defaults={"label": "Active", "is_active": True, "sort_order": 1},
    )
    site_status, _ = SiteStatus.objects.get_or_create(
        key="active_data002", defaults={"label": "Active", "is_active": True, "sort_order": 1},
    )
    inventory_status, _ = InventoryStatus.objects.get_or_create(
        key="active_data002", defaults={"label": "Active", "is_active": True, "sort_order": 1},
    )
    inventory_type, _ = InventoryType.objects.get_or_create(
        key="server_data002", defaults={"label": "Server", "is_active": True, "sort_order": 1},
    )
    customer = Customer.objects.create(name="DATA002 Customer", status=customer_status)
    site = Site.objects.create(customer=customer, name="DATA002 Site", status=site_status)
    return {"customer": customer, "site": site, "status": inventory_status, "type": inventory_type}


def test_duplicate_serial_number_rejected_by_db(inventory_lookups):
    Inventory.objects.create(
        customer=inventory_lookups["customer"], site=inventory_lookups["site"],
        name="Host fisico", status=inventory_lookups["status"], type=inventory_lookups["type"],
        serial_number="SN-DUP-001",
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Inventory.objects.create(
                customer=inventory_lookups["customer"], site=inventory_lookups["site"],
                name="Altro host", status=inventory_lookups["status"], type=inventory_lookups["type"],
                serial_number="SN-DUP-001",
            )


def test_duplicate_knumber_is_explicitly_allowed_at_db_level(inventory_lookups):
    """Host fisico + macchina virtuale ospitata: stesso knumber, deve
    funzionare senza errori a livello DB."""
    host = Inventory.objects.create(
        customer=inventory_lookups["customer"], site=inventory_lookups["site"],
        name="Host fisico", status=inventory_lookups["status"], type=inventory_lookups["type"],
        knumber="K12345",
    )
    vm = Inventory.objects.create(
        customer=inventory_lookups["customer"], site=inventory_lookups["site"],
        name="VM su host fisico", status=inventory_lookups["status"], type=inventory_lookups["type"],
        knumber="K12345",
    )
    assert host.knumber == vm.knumber == "K12345"
    assert host.id != vm.id


def test_duplicate_knumber_is_explicitly_allowed_via_api(api_client, superuser, inventory_lookups):
    """DATA-002 (verifica richiesta): il blocco applicativo su knumber
    duplicato in InventoryDetailSerializer.validate() è stato rimosso —
    stesso caso host+VM, ma passando dall'endpoint REST invece che dal
    model manager, per assicurarsi che il serializer non lo blocchi più."""
    Inventory.objects.create(
        customer=inventory_lookups["customer"], site=inventory_lookups["site"],
        name="Host fisico API", status=inventory_lookups["status"], type=inventory_lookups["type"],
        knumber="K99999",
    )

    api_client.force_authenticate(user=superuser)
    payload = {
        "customer": inventory_lookups["customer"].id,
        "site": inventory_lookups["site"].id,
        "name": "VM su host fisico API",
        "status": inventory_lookups["status"].id,
        "type": inventory_lookups["type"].id,
        "knumber": "K99999",
    }
    res = api_client.post("/api/inventories/", payload, format="json")

    assert res.status_code == 201, res.data
    assert Inventory.objects.filter(knumber="K99999").count() == 2
