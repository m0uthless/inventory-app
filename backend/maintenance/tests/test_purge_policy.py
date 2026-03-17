"""
Tests for purge_policy — specifically the fix that allows purging a
MaintenancePlan/Tech/Inventory even when it has soft-deleted (deleted_at set)
dependent rows, as long as no ACTIVE rows exist.

Regression suite for: "piani manutenzione nel cestino non eliminabili"
"""
from __future__ import annotations

import pytest
from django.utils import timezone

from core.models import CustomerStatus, SiteStatus, InventoryStatus, InventoryType
from core.purge_policy import get_purge_blockers, try_purge_instance
from crm.models import Customer, Site
from inventory.models import Inventory
from maintenance.models import (
    MaintenancePlan,
    MaintenanceEvent,
    ScheduleType,
    IntervalUnit,
    Tech,
)

pytestmark = pytest.mark.django_db


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture()
def statuses():
    cs = CustomerStatus.objects.get_or_create(key="purge_t_cs", defaults={"label": "Active"})[0]
    ss = SiteStatus.objects.get_or_create(key="purge_t_ss", defaults={"label": "Active"})[0]
    inv_s = InventoryStatus.objects.get_or_create(key="purge_t_is", defaults={"label": "Active"})[0]
    inv_t = InventoryType.objects.get_or_create(key="purge_t_it", defaults={"label": "Server"})[0]
    return cs, ss, inv_s, inv_t


@pytest.fixture()
def customer(statuses):
    cs, *_ = statuses
    return Customer.objects.create(name="PurgeCo", status=cs)


@pytest.fixture()
def site(customer, statuses):
    _, ss, *_ = statuses
    return Site.objects.create(customer=customer, name="HQ", status=ss)


@pytest.fixture()
def inventory(customer, site, statuses):
    _, _, inv_s, inv_t = statuses
    return Inventory.objects.create(
        customer=customer, site=site, name="Srv-1",
        status=inv_s, type=inv_t,
    )


@pytest.fixture()
def tech():
    return Tech.objects.create(
        first_name="Mario", last_name="Rossi", email="mario@example.com"
    )


@pytest.fixture()
def plan(customer, statuses):
    _, _, _, inv_t = statuses
    p = MaintenancePlan.objects.create(
        title="Piano annuale",
        customer=customer,
        schedule_type=ScheduleType.INTERVAL,
        interval_unit=IntervalUnit.YEARS,
        interval_value=1,
        next_due_date="2027-01-01",
    )
    p.inventory_types.set([inv_t])
    return p


def _soft_deleted_plan(customer, statuses):
    """Return a MaintenancePlan that is already soft-deleted (in the trash)."""
    _, _, _, inv_t = statuses
    p = MaintenancePlan.objects.create(
        title="Piano eliminato",
        customer=customer,
        schedule_type=ScheduleType.INTERVAL,
        interval_unit=IntervalUnit.YEARS,
        interval_value=1,
        next_due_date="2027-01-01",
        deleted_at=timezone.now(),
    )
    p.inventory_types.set([inv_t])
    return p


# ─── MaintenancePlan purge tests ─────────────────────────────────────────────


class TestMaintenancePlanPurge:

    def test_plan_with_no_dependents_is_purgeable(self, plan):
        """A plan with zero events and notifications can be purged."""
        plan.deleted_at = timezone.now()
        plan.save()

        blockers = get_purge_blockers(plan)
        assert blockers == []

        ok, reason, _ = try_purge_instance(plan)
        assert ok is True
        assert reason is None
        assert not MaintenancePlan.objects.filter(pk=plan.pk).exists()

    def test_plan_with_active_event_is_blocked(self, plan, inventory, tech):
        """A plan with an active (non-deleted) event MUST be blocked."""
        MaintenanceEvent.objects.create(
            plan=plan, inventory=inventory, tech=tech,
            performed_at="2026-01-01", result="ok",
        )
        plan.deleted_at = timezone.now()
        plan.save()

        blockers = get_purge_blockers(plan)
        assert any(b["label"] == "rapportini manutenzione" for b in blockers)

        ok, _, _ = try_purge_instance(plan)
        assert ok is False

    def test_plan_with_only_soft_deleted_events_is_purgeable(self, plan, inventory, tech):
        """
        Core regression test: a plan whose events are ALL soft-deleted must be
        purgeable. Before the fix, soft-deleted events were counted as blockers.
        """
        event = MaintenanceEvent.objects.create(
            plan=plan, inventory=inventory, tech=tech,
            performed_at="2026-01-01", result="ok",
        )
        # Soft-delete the event (simulate user deleting rapportino before the plan)
        event.deleted_at = timezone.now()
        event.save()

        plan.deleted_at = timezone.now()
        plan.save()

        blockers = get_purge_blockers(plan)
        assert blockers == [], (
            "Soft-deleted events must NOT appear as blockers. "
            f"Got: {blockers}"
        )

        ok, reason, _ = try_purge_instance(plan)
        assert ok is True, f"Expected purge to succeed, got reason: {reason}"
        assert not MaintenancePlan.objects.filter(pk=plan.pk).exists()
        # Soft-deleted event must also be hard-deleted (cascade purge)
        assert not MaintenanceEvent.objects.filter(pk=event.pk).exists()

    def test_plan_with_mixed_events_is_blocked_by_active_only(self, plan, inventory, tech):
        """
        A plan with one active and one soft-deleted event:
        only the active one should block the purge.
        """
        active_event = MaintenanceEvent.objects.create(
            plan=plan, inventory=inventory, tech=tech,
            performed_at="2026-02-01", result="ok",
        )
        soft_event = MaintenanceEvent.objects.create(
            plan=plan, inventory=inventory, tech=tech,
            performed_at="2026-01-01", result="ko",
        )
        soft_event.deleted_at = timezone.now()
        soft_event.save()

        plan.deleted_at = timezone.now()
        plan.save()

        blockers = get_purge_blockers(plan)
        event_blocker = next(
            (b for b in blockers if b["label"] == "rapportini manutenzione"), None
        )
        assert event_blocker is not None
        # Only 1 active event counted, not 2
        assert event_blocker["count"] == 1

        ok, _, _ = try_purge_instance(plan)
        assert ok is False
        # Active event must still exist
        assert MaintenanceEvent.objects.filter(pk=active_event.pk).exists()


# ─── Tech purge tests ─────────────────────────────────────────────────────────


class TestTechPurge:

    def test_tech_with_no_events_is_purgeable(self, tech):
        tech.deleted_at = timezone.now()
        tech.save()

        ok, reason, _ = try_purge_instance(tech)
        assert ok is True
        assert not Tech.objects.filter(pk=tech.pk).exists()

    def test_tech_with_active_event_is_blocked(self, tech, plan, inventory):
        MaintenanceEvent.objects.create(
            plan=plan, inventory=inventory, tech=tech,
            performed_at="2026-01-01", result="ok",
        )
        tech.deleted_at = timezone.now()
        tech.save()

        ok, _, blockers = try_purge_instance(tech)
        assert ok is False
        assert any(b["label"] == "rapportini manutenzione" for b in blockers)

    def test_tech_with_only_soft_deleted_events_is_purgeable(self, tech, plan, inventory):
        """
        Regression: a Tech with only soft-deleted rapportini must be purgeable.
        """
        event = MaintenanceEvent.objects.create(
            plan=plan, inventory=inventory, tech=tech,
            performed_at="2026-01-01", result="ok",
        )
        event.deleted_at = timezone.now()
        event.save()

        tech.deleted_at = timezone.now()
        tech.save()

        blockers = get_purge_blockers(tech)
        assert blockers == [], f"Soft-deleted events must not block Tech purge. Got: {blockers}"

        ok, reason, _ = try_purge_instance(tech)
        assert ok is True, f"Expected purge to succeed, got: {reason}"
        assert not Tech.objects.filter(pk=tech.pk).exists()
        assert not MaintenanceEvent.objects.filter(pk=event.pk).exists()


# ─── Inventory purge tests ─────────────────────────────────────────────────────


class TestInventoryPurge:

    def test_inventory_with_only_soft_deleted_events_is_purgeable(
        self, inventory, plan, tech
    ):
        """
        Regression: an Inventory with only soft-deleted maintenance_events
        must be purgeable.
        """
        event = MaintenanceEvent.objects.create(
            plan=plan, inventory=inventory, tech=tech,
            performed_at="2026-01-01", result="ok",
        )
        event.deleted_at = timezone.now()
        event.save()

        inventory.deleted_at = timezone.now()
        inventory.save()

        blockers = get_purge_blockers(inventory)
        assert blockers == [], (
            f"Soft-deleted events must not block Inventory purge. Got: {blockers}"
        )

        ok, reason, _ = try_purge_instance(inventory)
        assert ok is True, f"Expected purge to succeed, got: {reason}"
        assert not Inventory.objects.filter(pk=inventory.pk).exists()
        assert not MaintenanceEvent.objects.filter(pk=event.pk).exists()

    def test_inventory_with_active_event_is_blocked(self, inventory, plan, tech):
        MaintenanceEvent.objects.create(
            plan=plan, inventory=inventory, tech=tech,
            performed_at="2026-01-01", result="ok",
        )
        inventory.deleted_at = timezone.now()
        inventory.save()

        ok, _, _ = try_purge_instance(inventory)
        assert ok is False
        assert Inventory.objects.filter(pk=inventory.pk).exists()
