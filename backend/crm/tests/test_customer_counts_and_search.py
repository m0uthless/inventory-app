"""Test per i contatori annotati sul Customer e per la ricerca cross-entità.

Il Site Repository calcolava assets_count / sites_count / active_issue_count nel
frontend, scaricando tutti gli inventory e i siti in memoria: numeri sbagliati
non appena i record superavano la pagina. Ora li annota il backend via subquery
(crm/api.py, _count_subquery) e la ricerca cliente attraversa anche asset e siti.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType
from crm.models import Customer, Site
from inventory.models import Inventory
from issues.models import Issue, IssueStatus

pytestmark = pytest.mark.django_db

User = get_user_model()


def _client_and_user():
    user = User.objects.create_superuser(
        username=f"cnt_{uuid.uuid4().hex[:6]}", email="c@example.com", password="pw",
    )
    c = APIClient()
    c.force_authenticate(user=user)
    return c, user


def _client():
    return _client_and_user()[0]


def _customer(suffix):
    status = CustomerStatus.objects.get_or_create(
        key=f"cnt_cs_{suffix}", defaults={"label": "Active"},
    )[0]
    return Customer.objects.create(name=f"CntCustomer_{suffix}", status=status)


def _site(customer, suffix, name="Sede"):
    status = SiteStatus.objects.get_or_create(
        key=f"cnt_ss_{suffix}", defaults={"label": "Active"},
    )[0]
    return Site.objects.create(customer=customer, name=name, status=status)


def _inventory(customer, name, site=None):
    status = InventoryStatus.objects.get_or_create(
        key="cnt_inv_status", defaults={"label": "Attivo"},
    )[0]
    itype = InventoryType.objects.get_or_create(
        key="cnt_inv_type", defaults={"label": "Server"},
    )[0]
    return Inventory.objects.create(
        customer=customer, name=name, site=site, status=status, type=itype,
    )


# ─── contatori ───────────────────────────────────────────────────────────────

def test_counts_reflect_related_rows():
    customer = _customer("a")
    _site(customer, "a", name="Sede 1")
    _site(customer, "a2", name="Sede 2")
    _inventory(customer, "srv-01")
    _inventory(customer, "srv-02")
    _inventory(customer, "srv-03")

    resp = _client().get(f"/api/customers/{customer.id}/")

    assert resp.status_code == 200, resp.data
    assert resp.data["sites_count"] == 2
    assert resp.data["assets_count"] == 3
    assert resp.data["active_issue_count"] == 0


def test_counts_are_zero_without_related_rows():
    customer = _customer("empty")

    resp = _client().get(f"/api/customers/{customer.id}/")

    assert resp.status_code == 200, resp.data
    # Coalesce a 0, non null.
    assert resp.data["assets_count"] == 0
    assert resp.data["sites_count"] == 0


def test_counts_ignore_soft_deleted_rows():
    customer = _customer("soft")
    _inventory(customer, "srv-keep")
    trash = _inventory(customer, "srv-trash")
    trash.soft_delete()  # imposta deleted_at, non rimuove la riga

    resp = _client().get(f"/api/customers/{customer.id}/")

    assert resp.status_code == 200, resp.data
    assert resp.data["assets_count"] == 1  # solo srv-keep


def test_counts_are_not_inflated_by_multiple_joins():
    """Con Count(...) e join multipli (inventories x sites) i contatori si
    moltiplicherebbero fra loro. Le subquery no: verifichiamo che 3 asset e 2
    siti restino 3 e 2, non 6 e 6.
    """
    customer = _customer("cart")
    _site(customer, "cart", name="S1")
    _site(customer, "cart2", name="S2")
    _inventory(customer, "a1")
    _inventory(customer, "a2")
    _inventory(customer, "a3")

    resp = _client().get("/api/customers/", {"search": "CntCustomer_cart"})

    row = next(r for r in resp.data["results"] if r["id"] == customer.id)
    assert row["assets_count"] == 3
    assert row["sites_count"] == 2


def test_active_issue_count_counts_assets_not_issues():
    """active_issue_count = numero di ASSET con almeno una issue attiva, non
    numero di issue. Un asset con due issue attive conta 1.
    """
    client, user = _client_and_user()
    customer = _customer("iss")
    inv = _inventory(customer, "srv-iss")
    for _ in range(2):
        Issue.objects.create(
            customer=customer, inventory=inv, created_by=user,
            title=f"Problema {uuid.uuid4().hex[:5]}", status=IssueStatus.OPEN,
        )
    # Un secondo asset senza issue non deve entrare nel conteggio.
    _inventory(customer, "srv-clean")

    resp = client.get(f"/api/customers/{customer.id}/")

    assert resp.status_code == 200, resp.data
    assert resp.data["active_issue_count"] == 1


def test_active_issue_count_ignores_closed_issues():
    client, user = _client_and_user()
    customer = _customer("closed")
    inv = _inventory(customer, "srv-closed")
    Issue.objects.create(
        customer=customer, inventory=inv, created_by=user,
        title="Chiusa", status=IssueStatus.CLOSED,
    )

    resp = client.get(f"/api/customers/{customer.id}/")

    assert resp.data["active_issue_count"] == 0


# ─── ricerca cross-entità ────────────────────────────────────────────────────

def test_search_matches_customer_by_asset_hostname():
    """Il Site Repository cerca un cliente a partire dall'hostname di un suo
    asset. Prima lo faceva su liste in memoria troncate; ora è ?search= server.
    """
    target = _customer("byasset")
    _inventory(target, "asset-generico")
    target_inv = _inventory(target, "generic")
    target_inv.hostname = "PACS-BOLOGNA-01"
    target_inv.save()

    other = _customer("other")
    _inventory(other, "altro")

    resp = _client().get("/api/customers/", {"search": "PACS-BOLOGNA-01"})

    ids = {r["id"] for r in resp.data["results"]}
    assert target.id in ids
    assert other.id not in ids


def test_search_matches_customer_by_site_city():
    target = _customer("bycity")
    site = _site(target, "bycity", name="Ospedale")
    site.city = "Ferrara"
    site.save()

    other = _customer("nocity")
    _site(other, "nocity", name="Altro")

    resp = _client().get("/api/customers/", {"search": "Ferrara"})

    ids = {r["id"] for r in resp.data["results"]}
    assert target.id in ids
    assert other.id not in ids


def test_search_does_not_duplicate_customer_rows():
    """Con più asset che matchano, il join potrebbe restituire il cliente più
    volte: DRF applica distinct(), quindi la riga resta unica.
    """
    target = _customer("dup")
    for i in range(3):
        inv = _inventory(target, f"match-{i}")
        inv.hostname = f"MATCH-HOST-{i}"
        inv.save()

    resp = _client().get("/api/customers/", {"search": "MATCH-HOST"})

    ids = [r["id"] for r in resp.data["results"]]
    assert ids.count(target.id) == 1
