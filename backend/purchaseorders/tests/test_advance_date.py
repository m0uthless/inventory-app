"""Data del passo nell'avanzamento (dialogo dell'anteprima approvata, lista del 21/11 punto 7).

`date` (YYYY-MM-DD) facoltativa: senza resta «adesso»; nel futuro o non valida → 400.
"""
from datetime import timedelta

import pytest
from django.utils import timezone

from purchaseorders.models import PurchaseOrderEntry

pytestmark = pytest.mark.django_db


@pytest.fixture
def entry():
    return PurchaseOrderEntry.objects.create(offer_date="2026-01-15", description="Offerta", client_name="ACME", amount="10.00")


def _adv(client, entry, **data):
    return client.post(f"/api/purchase-order-entries/{entry.id}/advance/", data, format="multipart")


def test_step_date_is_used_when_given(api_client, superuser, entry):
    api_client.force_authenticate(user=superuser)
    yesterday = timezone.localdate() - timedelta(days=1)
    assert _adv(api_client, entry, date=yesterday.isoformat()).status_code == 200
    entry.refresh_from_db()
    assert entry.status == "inviato"
    assert timezone.localtime(entry.sent_at).date() == yesterday


def test_without_date_it_is_now(api_client, superuser, entry):
    api_client.force_authenticate(user=superuser)
    assert _adv(api_client, entry).status_code == 200
    entry.refresh_from_db()
    assert timezone.localtime(entry.sent_at).date() == timezone.localdate()


@pytest.mark.parametrize("bad", ["2999-01-01", "ieri", "2026-13-40"])
def test_future_or_invalid_date_is_refused(api_client, superuser, entry, bad):
    api_client.force_authenticate(user=superuser)
    r = _adv(api_client, entry, date=bad)
    assert r.status_code == 400
    entry.refresh_from_db()
    assert entry.status == "inserito"
