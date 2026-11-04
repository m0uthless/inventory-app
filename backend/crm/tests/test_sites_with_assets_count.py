"""Annotazione `sites_with_assets_count` di CustomerViewSet.

Alimenta il contatore "siti" del Site Repository, che mostra solo i siti con
almeno un asset (non eliminato). Un sito senza asset, o con soli asset nel
cestino, non deve essere contato.
"""
from django.utils import timezone

import pytest

from crm.models import Customer, Site
from inventory.models import Inventory

pytestmark = pytest.mark.django_db


def _count_for(api_client, customer):
    resp = api_client.get("/api/customers/", {"search": customer.name})
    assert resp.status_code == 200
    data = resp.json()
    row = next(r for r in data.get("results", data) if r["id"] == customer.id)
    return row["sites_with_assets_count"]


def test_counts_only_sites_with_live_assets(
    api_client, superuser, customer_status, site_status, inventory_status, inventory_type,
):
    api_client.force_authenticate(user=superuser)
    customer = Customer.objects.create(name="AUSL Contatori", status=customer_status)

    with_assets = Site.objects.create(customer=customer, name="Con asset", status=site_status)
    Site.objects.create(customer=customer, name="Vuoto 1", status=site_status)
    Site.objects.create(customer=customer, name="Vuoto 2", status=site_status)
    only_trashed = Site.objects.create(customer=customer, name="Solo cestino", status=site_status)

    for name in ("PACS-01", "PACS-02"):
        Inventory.objects.create(
            customer=customer, site=with_assets, name=name, type=inventory_type, status=inventory_status,
        )
    Inventory.objects.create(
        customer=customer, site=only_trashed, name="OLD-01", type=inventory_type, status=inventory_status,
        deleted_at=timezone.now(),
    )

    assert _count_for(api_client, customer) == 1
