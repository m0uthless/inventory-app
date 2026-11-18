"""purchaseorders/tests/test_followed_by.py

«Seguito da»: la persona che segue il PO. Un solo riferimento all'utente,
modificabile in qualunque stato (non è tra i campi bloccati dopo l'invio).
"""
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from purchaseorders.models import PurchaseOrderEntry, PurchaseOrderStatus

User = get_user_model()


@pytest.fixture
def entry(db):
    return PurchaseOrderEntry.objects.create(
        offer_date=date(2026, 10, 20), description="Migrazione NAS", client_name="Philips", amount=Decimal("100.00"),
    )


@pytest.fixture
def anna(db):
    return User.objects.create_user(username="anna", first_name="Anna", last_name="Ferri", password="x")


@pytest.mark.django_db
def test_assign_follower_returns_full_name(api_client, superuser, entry, anna):
    api_client.force_authenticate(user=superuser)
    resp = api_client.patch(f"/api/purchase-order-entries/{entry.id}/", {"followed_by": anna.id}, format="json")
    assert resp.status_code == 200, resp.data
    assert resp.data["followed_by"] == anna.id
    assert resp.data["followed_by_name"] == "Anna Ferri"
    entry.refresh_from_db()
    assert entry.followed_by_id == anna.id


@pytest.mark.django_db
def test_follower_can_change_after_sending(api_client, superuser, entry, anna):
    entry.status = PurchaseOrderStatus.INVIATO
    entry.save()
    api_client.force_authenticate(user=superuser)
    resp = api_client.patch(f"/api/purchase-order-entries/{entry.id}/", {"followed_by": anna.id}, format="json")
    assert resp.status_code == 200, resp.data
    resp = api_client.patch(f"/api/purchase-order-entries/{entry.id}/", {"followed_by": None}, format="json")
    assert resp.status_code == 200, resp.data
    assert resp.data["followed_by_name"] is None


@pytest.mark.django_db
def test_inactive_user_is_rejected(api_client, superuser, entry, anna):
    anna.is_active = False
    anna.save()
    api_client.force_authenticate(user=superuser)
    resp = api_client.patch(f"/api/purchase-order-entries/{entry.id}/", {"followed_by": anna.id}, format="json")
    assert resp.status_code == 400
    assert "followed_by" in resp.data


@pytest.mark.django_db
def test_filter_by_follower(api_client, superuser, entry, anna):
    other = PurchaseOrderEntry.objects.create(offer_date=date(2026, 10, 21), description="Altro", client_name="Biotron", amount=Decimal("50.00"))
    entry.followed_by = anna
    entry.save()
    api_client.force_authenticate(user=superuser)
    resp = api_client.get("/api/purchase-order-entries/", {"followed_by": anna.id})
    assert resp.status_code == 200
    ids = [r["id"] for r in (resp.data["results"] if isinstance(resp.data, dict) else resp.data)]
    assert ids == [entry.id]
    assert other.id not in ids
