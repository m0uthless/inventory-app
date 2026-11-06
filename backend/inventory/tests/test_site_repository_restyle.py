"""Site Repository (restyle): ricerca per identificativi del sistema e manutenzioni del singolo asset."""
import datetime

import pytest
from django.contrib.auth.models import Permission, User

from core.models import CustomerStatus, InventoryStatus, InventoryType
from crm.models import Customer
from inventory.models import Inventory
from maintenance.models import MaintenanceEvent, MaintenancePlan, MaintenancePlanInventory, Tech


@pytest.mark.django_db
def test_asset_q_matches_only_system_identifiers(api_client, superuser):
    cst, _ = CustomerStatus.objects.get_or_create(key="active", defaults={"label": "Attivo"})
    st, _ = InventoryStatus.objects.get_or_create(key="in_use", defaults={"label": "In uso"})
    ty, _ = InventoryType.objects.get_or_create(key="workstation", defaults={"label": "Workstation"})
    c = Customer.objects.create(name="AUSL Bologna", status=cst)
    a = Inventory.objects.create(customer=c, name="PACS nodo 1", hostname="aubmpacs01", local_ip="10.20.5.10", srsa_ip="172.16.5.10", knumber="137037", status=st, type=ty)
    b = Inventory.objects.create(customer=c, name="Workstation", hostname="ws1", serial_number="SN-BOLO", status=st, type=ty)
    api_client.force_authenticate(user=superuser)

    def ids(q):
        r = api_client.get(f"/api/inventories/?asset_q={q}")
        assert r.status_code == 200, r.data
        return {x["id"] for x in r.data["results"]}

    assert ids("aubm") == {a.id}
    assert ids("172.16") == {a.id}
    assert ids("1370") == {a.id}
    assert ids("bolo") == {b.id}  # seriale sì, nome del cliente no
    assert ids("bologna") == set()


@pytest.mark.django_db
def test_inventory_maintenance_plans_and_events(api_client, superuser):
    cst, _ = CustomerStatus.objects.get_or_create(key="active", defaults={"label": "Attivo"})
    st, _ = InventoryStatus.objects.get_or_create(key="in_use", defaults={"label": "In uso"})
    ws, _ = InventoryType.objects.get_or_create(key="workstation", defaults={"label": "Workstation"})
    pacs, _ = InventoryType.objects.get_or_create(key="wfm", defaults={"label": "PACS"})
    c = Customer.objects.create(name="AUSL Ferrara", status=cst)
    other = Customer.objects.create(name="Altro", status=cst)
    inv = Inventory.objects.create(customer=c, name="WS 1", type=ws, status=st)
    plan = MaintenancePlan.objects.create(customer=c, title="Pulizia annuale", schedule_type="interval", interval_value=12, interval_unit="months", next_due_date=datetime.date(2027, 4, 5))
    plan.inventory_types.set([ws])
    later = MaintenancePlan.objects.create(customer=c, title="Firmware", schedule_type="interval", interval_value=6, interval_unit="months", next_due_date=datetime.date(2027, 9, 1))
    later.inventory_types.set([ws])
    MaintenancePlanInventory.objects.create(plan=later, inventory=inv, due_date_override=datetime.date(2026, 12, 1))
    # Non coprono il sistema: altro tipo, altro cliente, piano disattivato.
    p2 = MaintenancePlan.objects.create(customer=c, title="PACS", schedule_type="interval", interval_value=6, interval_unit="months", next_due_date=datetime.date(2027, 1, 1))
    p2.inventory_types.set([pacs])
    p3 = MaintenancePlan.objects.create(customer=other, title="Altro cliente", schedule_type="interval", interval_value=6, interval_unit="months", next_due_date=datetime.date(2027, 1, 1))
    p3.inventory_types.set([ws])
    p4 = MaintenancePlan.objects.create(customer=c, title="Spento", schedule_type="interval", interval_value=6, interval_unit="months", next_due_date=datetime.date(2027, 1, 1), is_active=False)
    p4.inventory_types.set([ws])
    tech = Tech.objects.create(first_name="Marco", last_name="Bianchi", email="m@b.it")
    MaintenanceEvent.objects.create(plan=plan, inventory=inv, performed_at=datetime.date(2026, 4, 5), result="ok", tech=tech)
    MaintenanceEvent.objects.create(plan=plan, inventory=inv, performed_at=datetime.date(2025, 4, 5), result="partial", tech=tech)
    api_client.force_authenticate(user=superuser)

    r = api_client.get(f"/api/inventories/{inv.id}/maintenance/")
    assert r.status_code == 200, r.data
    assert [p["title"] for p in r.data["plans"]] == ["Firmware", "Pulizia annuale"]
    assert r.data["plans"][0]["due_date"] == "2026-12-01"  # override del singolo sistema
    assert [e["result"] for e in r.data["events"]] == ["ok", "partial"]
    assert r.data["events"][0]["tech_name"] and r.data["events"][0]["pdf_url"] is None


@pytest.mark.django_db
def test_inventory_maintenance_requires_permission(api_client):
    cst, _ = CustomerStatus.objects.get_or_create(key="active", defaults={"label": "Attivo"})
    st, _ = InventoryStatus.objects.get_or_create(key="in_use", defaults={"label": "In uso"})
    ty, _ = InventoryType.objects.get_or_create(key="workstation", defaults={"label": "Workstation"})
    c = Customer.objects.create(name="Cliente", status=cst)
    inv = Inventory.objects.create(customer=c, name="WS", status=st, type=ty)
    u = User.objects.create_user("tecnico", password="x", is_staff=True)
    u.user_permissions.add(Permission.objects.get(codename="view_inventory"), Permission.objects.get(codename="access_archie"))
    api_client.force_authenticate(user=u)
    assert api_client.get(f"/api/inventories/{inv.id}/").status_code == 200
    assert api_client.get(f"/api/inventories/{inv.id}/maintenance/").status_code == 403
