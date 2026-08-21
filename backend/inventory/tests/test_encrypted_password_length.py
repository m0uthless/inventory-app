"""Test di regressione 0.9.1 (WP-05, archie-dataconstraints — audit
2026-08-19, DATA-001): os_pwd/app_pwd/vnc_pwd salvano un valore CIFRATO
(Fernet), non il plaintext. Con max_length=128 (valore prima del fix), un
plaintext di 32+ caratteri produceva un token cifrato che superava 128
caratteri e falliva il salvataggio con un errore Postgres poco chiaro.
Verificato quantitativamente: 31 caratteri in chiaro -> 125 cifrati (ok),
32 caratteri in chiaro -> 145 cifrati (avrebbe fallito su max_length=128).
"""
import pytest

from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType
from crm.models import Customer, Site
from inventory.models import Inventory

pytestmark = pytest.mark.django_db


@pytest.fixture
def inventory_lookups():
    customer_status, _ = CustomerStatus.objects.get_or_create(
        key="active_data001", defaults={"label": "Active", "is_active": True, "sort_order": 1},
    )
    site_status, _ = SiteStatus.objects.get_or_create(
        key="active_data001", defaults={"label": "Active", "is_active": True, "sort_order": 1},
    )
    inventory_status, _ = InventoryStatus.objects.get_or_create(
        key="active_data001", defaults={"label": "Active", "is_active": True, "sort_order": 1},
    )
    inventory_type, _ = InventoryType.objects.get_or_create(
        key="server_data001", defaults={"label": "Server", "is_active": True, "sort_order": 1},
    )
    customer = Customer.objects.create(name="DATA001 Customer", status=customer_status)
    site = Site.objects.create(customer=customer, name="DATA001 Site", status=site_status)
    return {"customer": customer, "site": site, "status": inventory_status, "type": inventory_type}


@pytest.mark.parametrize("length", [8, 16, 31, 32, 40, 64, 100])
def test_password_of_any_reasonable_length_saves_successfully(inventory_lookups, length):
    plaintext = "x" * length
    inv = Inventory.objects.create(
        customer=inventory_lookups["customer"],
        site=inventory_lookups["site"],
        name=f"Inv-{length}",
        status=inventory_lookups["status"],
        type=inventory_lookups["type"],
        vnc_pwd=plaintext,
    )
    inv.refresh_from_db()
    # Il valore salvato è cifrato (diverso dal plaintext) ma non è stato
    # troncato/rifiutato dal DB — questo è ciò che prima falliva per
    # length >= 32.
    assert inv.vnc_pwd != plaintext
    assert inv.vnc_pwd.startswith("enc::")


def test_all_three_secret_fields_accept_a_32_char_password(inventory_lookups):
    """32 caratteri è esattamente la soglia minima che overflowava i 128
    caratteri prima del fix (verificato: token cifrato di 145 caratteri)."""
    pwd = "a" * 32
    inv = Inventory.objects.create(
        customer=inventory_lookups["customer"],
        site=inventory_lookups["site"],
        name="Inv-all-three",
        status=inventory_lookups["status"],
        type=inventory_lookups["type"],
        os_pwd=pwd,
        app_pwd=pwd,
        vnc_pwd=pwd,
    )
    inv.refresh_from_db()
    for field in ("os_pwd", "app_pwd", "vnc_pwd"):
        value = getattr(inv, field)
        assert value is not None
        assert value.startswith("enc::")
