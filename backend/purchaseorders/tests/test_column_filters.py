"""Filtri per singola colonna della lista PO (riga di ricerca del restyle)."""
import pytest

from purchaseorders.models import PurchaseOrderEntry


def _entry(**kwargs):
    defaults = dict(
        offer_date="2026-01-15", description="Z", client_name="Z",
        purchase_order="Z", costs_incurred="1.00", invoice_number="",
        amount="1.00",
    )
    defaults.update(kwargs)
    return PurchaseOrderEntry.objects.create(**defaults)


def _ids(api_client, qs):
    resp = api_client.get(f"/api/purchase-order-entries/?{qs}")
    assert resp.status_code == 200
    return {row["id"] for row in resp.data["results"]}


@pytest.mark.django_db
def test_description_client_ref_month(api_client, superuser):
    a = _entry(description="Fornitura monitor", client_name="AUSL Imola", purchase_order="PO-123", offer_date="2026-03-02")
    b = _entry(description="Licenze", client_name="Rizzoli", invoice_number="FT-77", offer_date="2026-05-10")
    api_client.force_authenticate(user=superuser)

    assert _ids(api_client, "description_q=monitor") == {a.id}
    assert _ids(api_client, "client_q=rizz") == {b.id}
    assert _ids(api_client, "ref_q=po-12") == {a.id}
    assert _ids(api_client, "ref_q=ft-7") == {b.id}
    assert _ids(api_client, "month=5") == {b.id}
    assert _ids(api_client, "client_q=") == {a.id, b.id}
