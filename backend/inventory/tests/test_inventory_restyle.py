"""Pagina Inventari (restyle): filtri per colonna e viste, riepilogo."""
import pytest

from core.models import CustomerStatus, InventoryStatus, InventoryType, SiteStatus
from crm.models import Customer, Site
from inventory.models import Inventory
from issues.models import Issue


def _ids(api_client, qs):
    resp = api_client.get(f"/api/inventories/?{qs}")
    assert resp.status_code == 200, resp.data
    return {row["id"] for row in resp.data["results"]}


@pytest.mark.django_db
def test_inventory_filters_and_summary(api_client, superuser):
    cst, _ = CustomerStatus.objects.get_or_create(key="active", defaults={"label": "Attivo"})
    sst, _ = SiteStatus.objects.get_or_create(key="active", defaults={"label": "Attivo"})
    in_use, _ = InventoryStatus.objects.get_or_create(key="in_use", defaults={"label": "In uso"})
    repair, _ = InventoryStatus.objects.get_or_create(key="repair", defaults={"label": "Guasto"})
    pacs, _ = InventoryType.objects.get_or_create(key="pacs", defaults={"label": "PACS"})
    ws, _ = InventoryType.objects.get_or_create(key="workstation", defaults={"label": "Workstation"})
    c = Customer.objects.create(name="Azienda USL di Imola", display_name="AUSL Imola", status=cst)
    site = Site.objects.create(customer=c, name="Ospedale S. Maria", status=sst)
    a = Inventory.objects.create(customer=c, site=site, name="PACS nodo 1", hostname="pacs01", local_ip="10.40.12.10", knumber="K123", type=pacs, status=in_use)
    b = Inventory.objects.create(customer=c, name="WS refertazione", hostname="ws03", type=ws, status=repair, serial_number="SN-9")
    Issue.objects.create(customer=c, inventory=a, title="Worklist vuota", status="open", priority="high", created_by=superuser)
    api_client.force_authenticate(user=superuser)

    assert _ids(api_client, "name_q=pacs") == {a.id}
    assert _ids(api_client, "hostname_q=ws0") == {b.id}
    assert _ids(api_client, "customer_q=imola") == {a.id, b.id}
    assert _ids(api_client, "site_q=maria") == {a.id}
    assert _ids(api_client, "ip_q=10.40") == {a.id}
    assert _ids(api_client, "code_q=sn-9") == {b.id}
    assert _ids(api_client, "has_active_issue=true") == {a.id}
    assert _ids(api_client, "not_operational=true") == {b.id}
    assert _ids(api_client, "incomplete=true") == {b.id}

    s = api_client.get("/api/inventories/summary/").data
    assert s["total"] == 2 and s["customers"] == 1 and s["in_use"] == 1 and s["repair"] == 1
    assert s["with_issue"] == 1 and s["issue_priority"]["high"] == 1
    assert s["not_operational"] == 1 and s["incomplete"] == 1 and s["missing_site"] == 1 and s["missing_ip"] == 1
    assert len(s["by_type"]) == 2 and len(s["growth"]) == 12
