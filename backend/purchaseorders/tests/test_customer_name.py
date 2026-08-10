"""purchaseorders/tests/test_customer_name.py — Punto 10.

customer_name deve mostrare display_name del cliente collegato (con
fallback su name se display_name è vuoto), e None se nessun cliente è
collegato (il frontend usa allora client_name come placeholder manuale).
"""
import pytest

from core.models import CustomerStatus
from crm.models import Customer
from purchaseorders.models import PurchaseOrderEntry


@pytest.fixture
def customer_status(db):
    return CustomerStatus.objects.create(key="active", label="Attivo")


@pytest.mark.django_db
def test_customer_name_uses_display_name_when_set(api_client, superuser, customer_status):
    customer = Customer.objects.create(
        name="ACME Srl", display_name="ACME (sede legale)", status=customer_status,
    )
    entry = PurchaseOrderEntry.objects.create(
        offer_date="2026-01-10", description="Test", client_name="Committente manuale",
        customer=customer, amount="10.00",
    )

    api_client.force_authenticate(user=superuser)
    resp = api_client.get(f"/api/purchase-order-entries/{entry.id}/")

    assert resp.status_code == 200
    assert resp.data["customer_name"] == "ACME (sede legale)"


@pytest.mark.django_db
def test_customer_name_falls_back_to_name_when_display_name_blank(api_client, superuser, customer_status):
    customer = Customer.objects.create(name="ACME Srl", display_name="", status=customer_status)
    entry = PurchaseOrderEntry.objects.create(
        offer_date="2026-01-10", description="Test", client_name="Committente manuale",
        customer=customer, amount="10.00",
    )

    api_client.force_authenticate(user=superuser)
    resp = api_client.get(f"/api/purchase-order-entries/{entry.id}/")

    assert resp.data["customer_name"] == "ACME Srl"


@pytest.mark.django_db
def test_customer_name_is_none_without_linked_customer(api_client, superuser):
    entry = PurchaseOrderEntry.objects.create(
        offer_date="2026-01-10", description="Test", client_name="Solo committente manuale",
        amount="10.00",
    )

    api_client.force_authenticate(user=superuser)
    resp = api_client.get(f"/api/purchase-order-entries/{entry.id}/")

    assert resp.data["customer_name"] is None
    assert resp.data["client_name"] == "Solo committente manuale"
