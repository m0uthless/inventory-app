"""
Test suite: audit log coverage for maintenance module.

Verifica che ogni operazione CRUD su Tech, MaintenancePlan, MaintenanceEvent e
MaintenanceNotification produca almeno un AuditEvent.

Strategia: conta gli AuditEvent prima/dopo ogni chiamata API e controlla il delta,
in modo da non dipendere dai valori specifici di action/content_type.
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from audit.models import AuditEvent
from core.models import CustomerStatus, InventoryStatus, InventoryType
from crm.models import Customer, Site
from inventory.models import Inventory
from maintenance.models import (
    MaintenanceEvent,
    MaintenanceNotification,
    MaintenancePlan,
    ScheduleType,
    IntervalUnit,
    NotificationStatus,
    Tech,
)

pytestmark = pytest.mark.django_db


# ── Helpers ───────────────────────────────────────────────────────────────────

def _superuser():
    User = get_user_model()
    import uuid
    return User.objects.create_superuser(
        username=f"admin_{uuid.uuid4().hex[:6]}",
        email="a@example.com",
        password="pw",
    )


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _cs():
    return CustomerStatus.objects.get_or_create(
        key="maint_active", defaults={"label": "Active"}
    )[0]


def _inventory_type():
    return InventoryType.objects.get_or_create(
        key="server_m", defaults={"label": "Server"}
    )[0]


def _make_plan(user) -> MaintenancePlan:
    it = _inventory_type()
    cust = Customer.objects.create(name="MaintCo", status=_cs())
    plan = MaintenancePlan.objects.create(
        title="Piano test",
        customer=cust,
        schedule_type=ScheduleType.INTERVAL,
        interval_unit=IntervalUnit.YEARS,
        interval_value=1,
        next_due_date="2027-01-01",
    )
    plan.inventory_types.set([it])
    return plan


def _make_inventory(user) -> Inventory:
    from core.models import SiteStatus
    ss = SiteStatus.objects.get_or_create(key="active_m", defaults={"label": "Active"})[0]
    ist = InventoryStatus.objects.get_or_create(key="active_m", defaults={"label": "Active"})[0]
    it = _inventory_type()
    cust = Customer.objects.create(name="InvCo", status=_cs())
    site = Site.objects.create(customer=cust, name="HQ", status=ss)
    return Inventory.objects.create(
        customer=cust, site=site, name="Dev-1",
        status=ist, type=it,
    )


def _make_tech() -> Tech:
    import uuid
    return Tech.objects.create(
        first_name="Mario",
        last_name="Rossi",
        email=f"mario_{uuid.uuid4().hex[:4]}@example.com",
    )


# ── Tech ──────────────────────────────────────────────────────────────────────

class TestTechAudit:
    def test_create_emits_audit(self):
        user = _superuser()
        c = _auth_client(user)
        before = AuditEvent.objects.count()

        r = c.post("/api/techs/", {
            "first_name": "Mario", "last_name": "Rossi", "email": "mario@example.com"
        }, format="json")

        assert r.status_code == 201, r.data
        assert AuditEvent.objects.count() == before + 1

    def test_update_emits_audit(self):
        user = _superuser()
        tech = _make_tech()
        c = _auth_client(user)
        before = AuditEvent.objects.count()

        r = c.patch(f"/api/techs/{tech.id}/", {"first_name": "Gino"}, format="json")

        assert r.status_code == 200, r.data
        assert AuditEvent.objects.count() == before + 1

    def test_delete_emits_audit(self):
        user = _superuser()
        tech = _make_tech()
        c = _auth_client(user)
        before = AuditEvent.objects.count()

        r = c.delete(f"/api/techs/{tech.id}/")

        assert r.status_code in (200, 204), r.data
        assert AuditEvent.objects.count() == before + 1

    def test_restore_emits_audit(self):
        user = _superuser()
        tech = _make_tech()
        tech.deleted_at = timezone.now()
        tech.save(update_fields=["deleted_at"])
        c = _auth_client(user)
        before = AuditEvent.objects.count()

        r = c.post(f"/api/techs/{tech.id}/restore/")

        assert r.status_code == 200, r.data
        assert AuditEvent.objects.count() == before + 1


# ── MaintenancePlan ────────────────────────────────────────────────────────────

class TestMaintenancePlanAudit:
    def test_create_emits_audit(self):
        user = _superuser()
        it = _inventory_type()
        cust = Customer.objects.create(name="PlanCo", status=_cs())
        c = _auth_client(user)
        before = AuditEvent.objects.count()

        r = c.post("/api/maintenance-plans/", {
            "title": "Piano annuale",
            "customer": cust.id,
            "inventory_types": [it.id],
            "schedule_type": ScheduleType.INTERVAL,
            "interval_unit": IntervalUnit.YEARS,
            "interval_value": 1,
            "next_due_date": "2027-01-01",
        }, format="json")

        assert r.status_code == 201, r.data
        assert AuditEvent.objects.count() == before + 1

    def test_update_emits_audit(self):
        user = _superuser()
        plan = _make_plan(user)
        c = _auth_client(user)
        before = AuditEvent.objects.count()

        r = c.patch(f"/api/maintenance-plans/{plan.id}/", {"title": "Nuovo titolo"}, format="json")

        assert r.status_code == 200, r.data
        assert AuditEvent.objects.count() == before + 1


# ── MaintenanceEvent ───────────────────────────────────────────────────────────

class TestMaintenanceEventAudit:
    def test_create_emits_audit(self):
        user = _superuser()
        plan = _make_plan(user)
        inv = _make_inventory(user)
        tech = _make_tech()
        c = _auth_client(user)
        before = AuditEvent.objects.count()

        r = c.post("/api/maintenance-events/", {
            "plan": plan.id,
            "inventory": inv.id,
            "tech": tech.id,
            "performed_at": "2026-03-01",
            "result": "ok",
        }, format="json")

        assert r.status_code == 201, r.data
        assert AuditEvent.objects.count() == before + 1

    def test_update_emits_audit(self):
        user = _superuser()
        plan = _make_plan(user)
        inv = _make_inventory(user)
        tech = _make_tech()
        event = MaintenanceEvent.objects.create(
            plan=plan, inventory=inv, tech=tech,
            performed_at="2026-02-01",
            result="ok",
        )
        c = _auth_client(user)
        before = AuditEvent.objects.count()

        r = c.patch(f"/api/maintenance-events/{event.id}/", {"notes": "aggiornato"}, format="json")

        assert r.status_code == 200, r.data
        assert AuditEvent.objects.count() == before + 1


# ── MaintenanceNotification ────────────────────────────────────────────────────

class TestMaintenanceNotificationAudit:
    def _make_notification(self) -> MaintenanceNotification:
        import uuid
        user = _superuser()
        plan = _make_plan(user)
        inv = _make_inventory(user)
        return MaintenanceNotification.objects.create(
            plan=plan,
            inventory=inv,
            due_date="2026-06-01",
            recipient_internal="test@example.com",
            recipient_tech="tech@example.com",
            status=NotificationStatus.SENT,
        )

    def test_create_emits_audit(self):
        user = _superuser()
        plan = _make_plan(user)
        inv = _make_inventory(user)
        c = _auth_client(user)
        before = AuditEvent.objects.count()

        r = c.post("/api/maintenance-notifications/", {
            "plan": plan.id,
            "inventory": inv.id,
            "due_date": "2026-07-01",
            "recipient_internal": "notif@example.com",
            "recipient_tech": "tech@example.com",
            "status": NotificationStatus.SENT,
        }, format="json")

        assert r.status_code == 201, r.data
        assert AuditEvent.objects.count() == before + 1

    def test_update_emits_audit(self):
        user = _superuser()
        notif = self._make_notification()
        c = _auth_client(user)
        before = AuditEvent.objects.count()

        r = c.patch(f"/api/maintenance-notifications/{notif.id}/", {
            "recipient_internal": "updated@example.com"
        }, format="json")

        assert r.status_code == 200, r.data
        assert AuditEvent.objects.count() == before + 1
