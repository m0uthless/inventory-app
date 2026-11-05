"""Pagina Siti (restyle): contatori, filtri per colonna e viste, riepilogo."""
import pytest

from core.models import SiteStatus
from crm.models import Contact, Customer, Site
from inventory.models import Inventory, InventoryStatus, InventoryType
from issues.models import Issue


def _ids(api_client, qs):
    resp = api_client.get(f"/api/sites/?{qs}")
    assert resp.status_code == 200, resp.data
    return {row["id"] for row in resp.data["results"]}


@pytest.mark.django_db
def test_site_counts_filters_and_summary(api_client, superuser, customer_status):
    st = SiteStatus.objects.create(key="active", label="Attivo")
    c = Customer.objects.create(name="Azienda USL di Imola", display_name="AUSL Imola", status=customer_status)
    a = Site.objects.create(customer=c, name="Ospedale S. Maria", status=st, address_line1="Via Montericco 4", city="Imola", province="BO")
    b = Site.objects.create(customer=c, name="Poliambulatorio", status=st, city="Castel San Pietro", province="BO")
    Contact.objects.create(customer=c, site=a, name="Laura Gentili", phone="0542 662 410", is_primary=True)
    it, _ = InventoryType.objects.get_or_create(key="server", defaults={"label": "Server"})
    ist, _ = InventoryStatus.objects.get_or_create(key="in_use", defaults={"label": "In uso"})
    Inventory.objects.create(customer=c, site=a, name="PACS", type=it, status=ist)
    Issue.objects.create(customer=c, site=a, title="Worklist vuota", status="open", created_by=superuser)
    api_client.force_authenticate(user=superuser)

    row = api_client.get(f"/api/sites/{a.id}/").data
    assert row["assets_count"] == 1 and row["open_issues_count"] == 1

    assert _ids(api_client, "name_q=maria") == {a.id}
    assert _ids(api_client, "customer_q=imola") == {a.id, b.id}
    assert _ids(api_client, "city_q=castel") == {b.id}
    assert _ids(api_client, "contact_q=662") == {a.id}
    assert _ids(api_client, "has_open_issues=true") == {a.id}
    assert _ids(api_client, "has_inventories=false") == {b.id}
    assert _ids(api_client, "incomplete=true") == {b.id}

    s = api_client.get("/api/sites/summary/").data
    assert s["total"] == 2 and s["customers"] == 1 and s["inventories"] == 1
    assert s["with_open_issues"] == 1 and s["without_inventories"] == 1
    assert s["incomplete"] == 1 and s["missing_address"] == 1 and s["missing_contact"] == 1
    assert s["top_open_issues_list"][0]["id"] == a.id
    assert s["by_customer"][0]["count"] == 2 and len(s["growth"]) == 12
