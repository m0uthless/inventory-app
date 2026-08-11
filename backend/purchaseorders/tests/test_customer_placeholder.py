"""purchaseorders/tests/test_customer_placeholder.py

Cliente collegato manuale (testo libero) per quando il cliente su cui è
stato eseguito il lavoro non è ancora in anagrafica. Concettualmente
distinto da client_name (Committente = chi paga/commissiona) e da customer
(cliente reale in anagrafica) — customer_placeholder e customer sono
mutuamente esclusivi.
"""
import pytest

from core.models import CustomerStatus
from crm.models import Customer
from purchaseorders.models import PurchaseOrderEntry


@pytest.fixture
def customer_status(db):
    return CustomerStatus.objects.create(key="active", label="Attivo")


@pytest.mark.django_db
def test_create_with_customer_placeholder(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    resp = api_client.post("/api/purchase-order-entries/", {
        "offer_date": "2026-01-10",
        "description": "Test placeholder",
        "client_name": "Committente SRL",
        "customer_placeholder": "Ospedale Non Ancora In Anagrafica",
        "amount": "50.00",
    })

    assert resp.status_code == 201, resp.data
    assert resp.data["customer_placeholder"] == "Ospedale Non Ancora In Anagrafica"
    assert resp.data["is_customer_placeholder"] is True
    assert resp.data["customer_name"] == "Ospedale Non Ancora In Anagrafica"
    assert resp.data["customer"] is None


@pytest.mark.django_db
def test_customer_and_placeholder_mutually_exclusive(api_client, superuser, customer_status):
    customer = Customer.objects.create(name="ACME", status=customer_status)
    api_client.force_authenticate(user=superuser)

    resp = api_client.post("/api/purchase-order-entries/", {
        "offer_date": "2026-01-10",
        "description": "Test",
        "client_name": "Committente",
        "customer": customer.id,
        "customer_placeholder": "Testo libero",
        "amount": "50.00",
    })

    assert resp.status_code == 400
    assert "customer_placeholder" in resp.data


@pytest.mark.django_db
def test_customer_name_prefers_placeholder_over_linked_customer_fallback(api_client, superuser):
    """Difesa in profondità: anche se per qualche motivo entrambi i valori
    fossero presenti a livello di riga DB (bypassando la validate() del
    serializer, es. tramite admin), get_customer_name dà priorità al testo
    libero — coerente con la regola di mutua esclusività."""
    entry = PurchaseOrderEntry.objects.create(
        offer_date="2026-01-10", description="Test", client_name="Committente",
        customer_placeholder="Testo libero prioritario", amount="10.00",
    )
    api_client.force_authenticate(user=superuser)
    resp = api_client.get(f"/api/purchase-order-entries/{entry.id}/")
    assert resp.data["customer_name"] == "Testo libero prioritario"


@pytest.mark.django_db
def test_regular_linked_customer_still_works(api_client, superuser, customer_status):
    customer = Customer.objects.create(name="ACME", display_name="ACME Srl", status=customer_status)
    entry = PurchaseOrderEntry.objects.create(
        offer_date="2026-01-10", description="Test", client_name="Committente",
        customer=customer, amount="10.00",
    )
    api_client.force_authenticate(user=superuser)
    resp = api_client.get(f"/api/purchase-order-entries/{entry.id}/")
    assert resp.data["customer_name"] == "ACME Srl"
    assert resp.data["is_customer_placeholder"] is False
    assert resp.data["customer_placeholder"] == ""
