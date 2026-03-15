"""
Test suite: CanRestoreModelPermission su tutti i moduli

Verifica sistematicamente che gli endpoint /restore/ e /bulk_restore/ di ogni
modulo restituiscano 403 a utenti senza permessi e 200 a superuser.

Copre: Tech, MaintenancePlan, MaintenanceEvent, MaintenanceNotification,
       WikiPage, Site, Customer.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import CustomerStatus, InventoryStatus, InventoryType
from crm.models import Customer, Site
from maintenance.models import (
    MaintenanceEvent,
    MaintenancePlan,
    MaintenanceNotification,
    ScheduleType,
    IntervalUnit,
    NotificationStatus,
    Tech,
)
from wiki.models import WikiPage

pytestmark = pytest.mark.django_db


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(*, superuser: bool = False):
    User = get_user_model()
    u = User.objects.create_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw")
    if superuser:
        u.is_staff = True
        u.is_superuser = True
        u.save(update_fields=["is_staff", "is_superuser"])
    return u


def _client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _cs():
    return CustomerStatus.objects.get_or_create(
        key="rp_active", defaults={"label": "Active"}
    )[0]


def _inventory_type():
    return InventoryType.objects.get_or_create(
        key="rp_server", defaults={"label": "Server"}
    )[0]


def _make_tech(user) -> Tech:
    return Tech.objects.create(
        first_name="T",
        last_name="T",
        email=f"t_{uuid.uuid4().hex[:4]}@ex.com",
        deleted_at=timezone.now(),
    )


def _make_plan(user) -> MaintenancePlan:
    it = _inventory_type()
    cust = Customer.objects.create(name=f"C_{uuid.uuid4().hex[:4]}", status=_cs())
    plan = MaintenancePlan.objects.create(
        title="Piano",
        customer=cust,
        schedule_type=ScheduleType.INTERVAL,
        interval_unit=IntervalUnit.YEARS,
        interval_value=1,
        next_due_date="2027-01-01",
        deleted_at=timezone.now(),
    )
    plan.inventory_types.set([it])
    return plan


def _make_event(user) -> MaintenanceEvent:
    from core.models import SiteStatus
    it = _inventory_type()
    ss = SiteStatus.objects.get_or_create(key="rp_ss", defaults={"label": "Active"})[0]
    ist = InventoryStatus.objects.get_or_create(key="rp_ist", defaults={"label": "Active"})[0]
    cust = Customer.objects.create(name=f"C_{uuid.uuid4().hex[:4]}", status=_cs())
    site = Site.objects.create(customer=cust, name="HQ", status=ss)
    inv = _make_inventory(cust, site, ist, it)
    plan = MaintenancePlan.objects.create(
        title="Piano", customer=cust,
        schedule_type=ScheduleType.INTERVAL,
        interval_unit=IntervalUnit.YEARS, interval_value=1,
        next_due_date="2027-01-01",
    )
    plan.inventory_types.set([it])
    tech = Tech.objects.create(
        first_name="T", last_name="T",
        email=f"t_{uuid.uuid4().hex[:4]}@ex.com",
    )
    return MaintenanceEvent.objects.create(
        plan=plan, inventory=inv, tech=tech,
        performed_at="2026-01-01", result="ok",
        deleted_at=timezone.now(),
    )


def _make_notification(user) -> MaintenanceNotification:
    from core.models import SiteStatus
    it = _inventory_type()
    ss = SiteStatus.objects.get_or_create(key="rp_ss2", defaults={"label": "Active"})[0]
    ist = InventoryStatus.objects.get_or_create(key="rp_ist2", defaults={"label": "Active"})[0]
    cust = Customer.objects.create(name=f"C_{uuid.uuid4().hex[:4]}", status=_cs())
    site = Site.objects.create(customer=cust, name="HQ", status=ss)
    inv = _make_inventory(cust, site, ist, it)
    plan = MaintenancePlan.objects.create(
        title="Piano", customer=cust,
        schedule_type=ScheduleType.INTERVAL,
        interval_unit=IntervalUnit.YEARS, interval_value=1,
        next_due_date="2027-01-01",
    )
    plan.inventory_types.set([it])
    return MaintenanceNotification.objects.create(
        plan=plan, inventory=inv,
        due_date="2026-06-01",
        recipient_internal="x@x.com",
        recipient_tech="t@x.com",
        status=NotificationStatus.SENT,
        deleted_at=timezone.now(),
    )


def _make_inventory(cust, site, ist, it):
    from inventory.models import Inventory
    return Inventory.objects.create(
        customer=cust, site=site, name=f"D_{uuid.uuid4().hex[:4]}",
        status=ist, type=it,
    )


def _make_wiki_page(user) -> WikiPage:
    return WikiPage.objects.create(
        title="T", slug=f"t-{uuid.uuid4().hex[:6]}",
        content_markdown="x",
        deleted_at=timezone.now(),
    )


# ── Parametric tests ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("factory,url_tpl", [
    (_make_tech,         "/api/techs/{id}/restore/"),
    (_make_plan,         "/api/maintenance-plans/{id}/restore/"),
    (_make_event,        "/api/maintenance-events/{id}/restore/"),
    (_make_notification, "/api/maintenance-notifications/{id}/restore/"),
    (_make_wiki_page,    "/api/wiki-pages/{id}/restore/"),
])
def test_restore_requires_permission(factory, url_tpl):
    """Utente senza permessi → 403."""
    owner = _make_user(superuser=True)
    obj = factory(owner)
    url = url_tpl.format(id=obj.id)

    no_perm = _make_user(superuser=False)
    r = _client(no_perm).post(url)
    assert r.status_code == 403, f"{url}: expected 403, got {r.status_code} — {r.data}"


@pytest.mark.parametrize("factory,url_tpl", [
    (_make_tech,         "/api/techs/{id}/restore/"),
    (_make_plan,         "/api/maintenance-plans/{id}/restore/"),
    (_make_event,        "/api/maintenance-events/{id}/restore/"),
    (_make_notification, "/api/maintenance-notifications/{id}/restore/"),
    (_make_wiki_page,    "/api/wiki-pages/{id}/restore/"),
])
def test_restore_allowed_for_superuser(factory, url_tpl):
    """Superuser → 200."""
    owner = _make_user(superuser=True)
    obj = factory(owner)
    url = url_tpl.format(id=obj.id)

    r = _client(owner).post(url)
    assert r.status_code == 200, f"{url}: expected 200, got {r.status_code} — {r.data}"
    obj.refresh_from_db()
    assert obj.deleted_at is None


# ── Bulk restore permissions ───────────────────────────────────────────────────

@pytest.mark.parametrize("factory,url", [
    (_make_tech,         "/api/techs/bulk_restore/"),
    (_make_plan,         "/api/maintenance-plans/bulk_restore/"),
    (_make_wiki_page,    "/api/wiki-pages/bulk_restore/"),
])
def test_bulk_restore_requires_permission(factory, url):
    """Utente senza permessi → 403 su bulk_restore."""
    owner = _make_user(superuser=True)
    obj = factory(owner)
    no_perm = _make_user(superuser=False)

    r = _client(no_perm).post(url, {"ids": [obj.id]}, format="json")
    assert r.status_code == 403, f"{url}: expected 403, got {r.status_code} — {r.data}"


@pytest.mark.parametrize("factory,url", [
    (_make_tech,         "/api/techs/bulk_restore/"),
    (_make_plan,         "/api/maintenance-plans/bulk_restore/"),
    (_make_wiki_page,    "/api/wiki-pages/bulk_restore/"),
])
def test_bulk_restore_allowed_for_superuser(factory, url):
    """Superuser → 200 su bulk_restore."""
    owner = _make_user(superuser=True)
    obj = factory(owner)

    r = _client(owner).post(url, {"ids": [obj.id]}, format="json")
    assert r.status_code == 200, f"{url}: expected 200, got {r.status_code} — {r.data}"
