"""`summary` con i conteggi per stato, gli importi per mese e l'invio più vecchio in attesa
(prima li calcolava il frontend leggendo tutte le righe dell'anno)."""
from datetime import timedelta

import pytest
from django.utils import timezone

from purchaseorders.models import PurchaseOrderEntry

pytestmark = pytest.mark.django_db


def _po(status, amount, offer, sent_days=None, kind="ordinario"):
    e = PurchaseOrderEntry.objects.create(offer_date=offer, description="x", client_name="c", amount=amount, status=status, kind=kind)
    if sent_days is not None:
        e.sent_at = timezone.now() - timedelta(days=sent_days)
        e.save(update_fields=["sent_at"])
    return e


def test_summary_by_status_monthly_and_oldest(api_client, superuser):
    _po("inserito", "100.00", "2026-01-10")
    _po("inviato", "200.00", "2026-01-20", sent_days=40)
    _po("inviato", "50.00", "2026-03-05", sent_days=5)
    _po("ricevuto", "300.00", "2026-03-15")
    _po("fatturato", "400.00", "2026-05-01")
    _po("fatturato", "999.00", "2025-05-01")
    api_client.force_authenticate(user=superuser)
    d = api_client.get("/api/purchase-order-entries/summary/", {"year": 2026}).json()
    assert d["by_status"] == {
        "inserito": {"count": 1, "amount": "100.00"}, "inviato": {"count": 2, "amount": "250.00"},
        "ricevuto": {"count": 1, "amount": "300.00"}, "fatturato": {"count": 1, "amount": "400.00"},
    }
    assert d["to_invoice"] == {"count": 1, "amount": "300.00"}
    assert d["monthly_amount"][:5] == ["300.00", "0.00", "350.00", "0.00", "400.00"]
    assert len(d["monthly_amount"]) == 12
    assert d["oldest_sent_days"] == 40


def test_summary_respects_kind(api_client, superuser):
    _po("ricevuto", "300.00", "2026-03-15", kind="extra")
    api_client.force_authenticate(user=superuser)
    d = api_client.get("/api/purchase-order-entries/summary/", {"year": 2026, "kind": "ordinario"}).json()
    assert d["to_invoice"] == {"count": 0, "amount": "0.00"}
    assert d["oldest_sent_days"] is None


def test_totals_follow_list_filters(api_client, superuser):
    a = _po("ricevuto", "300.00", "2026-03-15"); a.costs_incurred = "40.00"; a.save()
    b = _po("inviato", "200.00", "2026-04-15"); b.costs_incurred = "10.00"; b.save()
    _po("inviato", "999.00", "2025-04-15")
    api_client.force_authenticate(user=superuser)
    assert api_client.get("/api/purchase-order-entries/totals/", {"year": 2026}).json() == {"count": 2, "amount": "500.00", "costs": "50.00"}
    assert api_client.get("/api/purchase-order-entries/totals/", {"year": 2026, "status": "inviato"}).json() == {"count": 1, "amount": "200.00", "costs": "10.00"}
