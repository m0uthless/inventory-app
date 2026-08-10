"""purchaseorders/tests/test_ordering.py — Punto 8 (fix): alcune colonne del
datagrid non ordinavano perché mancavano da `ordering_fields` sul backend, o
perché non erano campi DB reali (is_invoiced è una @property, customer_name
un SerializerMethodField) e quindi non ordinabili direttamente — il frontend
li traduce nei campi reali sottostanti (invoice_number, customer__display_name)
prima di inviare il parametro `ordering`.
"""
import pytest

from core.models import CustomerStatus
from crm.models import Customer
from purchaseorders.models import PurchaseOrderEntry


@pytest.fixture
def customer_status(db):
    return CustomerStatus.objects.create(key="active", label="Attivo")


def _entry(**kwargs):
    defaults = dict(
        offer_date="2026-01-01", description="Z", client_name="Z",
        purchase_order="Z", costs_incurred="1.00", invoice_number="",
        amount="1.00",
    )
    defaults.update(kwargs)
    return PurchaseOrderEntry.objects.create(**defaults)


@pytest.mark.django_db
@pytest.mark.parametrize("field", ["description", "purchase_order", "costs_incurred"])
def test_ordering_by_real_field_ascending(api_client, superuser, field):
    _entry(**{field: "B" if field != "costs_incurred" else "2.00"})
    _entry(**{field: "A" if field != "costs_incurred" else "1.00"})

    api_client.force_authenticate(user=superuser)
    resp = api_client.get(f"/api/purchase-order-entries/?ordering={field}")

    assert resp.status_code == 200
    values = [row[field] for row in resp.data["results"]]
    assert values == sorted(values)


@pytest.mark.django_db
def test_ordering_by_invoice_number_backend_field(api_client, superuser):
    """Il frontend manda `ordering=invoice_number` quando l'utente ordina la
    colonna "Fattura" (is_invoiced), non essendo is_invoiced un campo DB."""
    _entry(invoice_number="FT-002")
    _entry(invoice_number="FT-001")
    _entry(invoice_number="")

    api_client.force_authenticate(user=superuser)
    resp = api_client.get("/api/purchase-order-entries/?ordering=invoice_number")

    assert resp.status_code == 200
    values = [row["invoice_number"] for row in resp.data["results"]]
    assert values == sorted(values)


@pytest.mark.django_db
def test_ordering_by_customer_display_name_backend_field(api_client, superuser, customer_status):
    """Il frontend manda `ordering=customer__display_name` quando l'utente
    ordina la colonna "Cliente collegato" (customer_name)."""
    c_b = Customer.objects.create(name="B", display_name="Beta", status=customer_status)
    c_a = Customer.objects.create(name="A", display_name="Alfa", status=customer_status)
    _entry(customer=c_b)
    _entry(customer=c_a)
    _entry()  # nessun cliente collegato

    api_client.force_authenticate(user=superuser)
    resp = api_client.get("/api/purchase-order-entries/?ordering=customer__display_name")

    assert resp.status_code == 200
    # Non deve andare in errore (400/500): il campo è valido e ordinabile.
    assert len(resp.data["results"]) == 3


@pytest.mark.django_db
def test_ordering_rejects_unknown_field_gracefully(api_client, superuser):
    """Un campo non in ordering_fields viene ignorato da DRF (nessun 400),
    ricade sull'ordinamento di default — comportamento DRF standard."""
    _entry()
    api_client.force_authenticate(user=superuser)
    resp = api_client.get("/api/purchase-order-entries/?ordering=campo_inesistente")
    assert resp.status_code == 200
