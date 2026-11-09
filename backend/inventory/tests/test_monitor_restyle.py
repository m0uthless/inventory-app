from __future__ import annotations

import pytest

from crm.models import Customer, Site
from inventory.models import Inventory, Monitor

pytestmark = pytest.mark.django_db


@pytest.fixture
def ws(superuser, customer_status, site_status, inventory_status, inventory_type):
    customer = Customer.objects.create(name="Rizzoli", status=customer_status, created_by=superuser, updated_by=superuser)
    site = Site.objects.create(customer=customer, name="Ortopedia", status=site_status, created_by=superuser, updated_by=superuser)
    return Inventory.objects.create(customer=customer, site=site, name="RIZ-WS-1", status=inventory_status, type=inventory_type, created_by=superuser, updated_by=superuser)


def test_monitor_stats_and_unassigned_filter(api_client, superuser, ws):
    Monitor.objects.create(inventory=ws, produttore="Eizo", modello="RX660", seriale="A1", stato="in_uso", tipo="diagnostico", radinet=True)
    Monitor.objects.create(inventory=ws, produttore="Eizo", modello="RX370", seriale="A2", stato="guasto", tipo="diagnostico")
    Monitor.objects.create(inventory=None, produttore="Dell", modello="P2422H", seriale="B1", stato="da_installare", tipo="amministrativo")
    gone = Monitor.objects.create(inventory=None, produttore="Dell", seriale="B2", stato="rma", tipo="amministrativo")
    api_client.force_authenticate(user=superuser)
    api_client.delete(f"/api/monitors/{gone.id}/")

    res = api_client.get("/api/monitors/stats/")
    assert res.status_code == 200, res.data
    assert res.data == {"total": 3, "by_stato": {"in_uso": 1, "da_installare": 1, "guasto": 1, "rma": 0}, "unassigned": 1}

    res = api_client.get("/api/monitors/", {"inventory__isnull": "true"})
    assert [r["seriale"] for r in res.data["results"]] == ["B1"]

    res = api_client.get("/api/monitors/", {"search": "RIZ-WS"})
    assert {r["seriale"] for r in res.data["results"]} == {"A1", "A2"}
    assert res.data["results"][0]["customer_name"] == "Rizzoli"


def test_monitor_status_patch_only(api_client, superuser, ws):
    m = Monitor.objects.create(inventory=ws, produttore="Eizo", seriale="A1", stato="in_uso", tipo="diagnostico", radinet=True)
    api_client.force_authenticate(user=superuser)
    res = api_client.patch(f"/api/monitors/{m.id}/", {"stato": "rma"}, format="json")
    assert res.status_code == 200, res.data
    m.refresh_from_db()
    assert m.stato == "rma" and m.radinet is True
