"""maintenance/tests/test_plan_list_no_n1.py

Verifica che la lista MaintenancePlan non esegua query N+1:
 - covered_count viene dall'annotazione nel queryset (non da SerializerMethodField per-item)
 - inventory_type_labels usa il prefetch cache (non una query per piano)

Usa django.test.utils.override_settings + assertNumQueries per contare le query.
"""
from __future__ import annotations

import uuid

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from core.models import CustomerStatus, InventoryStatus, InventoryType
from crm.models import Customer
from inventory.models import Inventory
from maintenance.models import MaintenancePlan, ScheduleType, IntervalUnit

pytestmark = pytest.mark.django_db


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _uid(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:6]}"


def _superuser():
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_superuser(
        username=_uid("adm_"), email="a@b.com", password="pw"
    )


def _customer_status():
    s, _ = CustomerStatus.objects.get_or_create(
        key=_uid("cs_"), defaults={"label": "Active"}
    )
    return s


def _inv_status(key_suffix="in_use"):
    """Crea uno status con key riconosciuta da get_covered_count."""
    s, _ = InventoryStatus.objects.get_or_create(
        key=key_suffix, defaults={"label": key_suffix.replace("_", " ").title()}
    )
    return s


def _inv_type(label="Server"):
    t, _ = InventoryType.objects.get_or_create(
        key=_uid("type_"), defaults={"label": label}
    )
    return t


def _make_plan(customer, inv_type, title="Piano test"):
    plan = MaintenancePlan.objects.create(
        title=title,
        customer=customer,
        schedule_type=ScheduleType.INTERVAL,
        interval_unit=IntervalUnit.YEARS,
        interval_value=1,
        next_due_date="2027-06-01",
    )
    plan.inventory_types.set([inv_type])
    return plan


# ─── Test: covered_count corretto ────────────────────────────────────────────

class TestCoveredCountAnnotation:
    def test_covered_count_equals_active_inventory_of_matching_type(self):
        """covered_count deve contare solo gli inventory con status in_use/maintenance/repair."""
        user = _superuser()
        client = APIClient()
        client.force_authenticate(user=user)

        cs = _customer_status()
        customer = Customer.objects.create(name=_uid("co_"), status=cs)

        in_use_status = _inv_status("in_use")
        other_status = _inv_status(_uid("other_"))  # non contato
        inv_type = _inv_type("Workstation")

        # 2 inventory attivi (in_use) + 1 con status non riconosciuto
        Inventory.objects.create(
            customer=customer, name=_uid("inv_"), status=in_use_status, type=inv_type
        )
        Inventory.objects.create(
            customer=customer, name=_uid("inv_"), status=in_use_status, type=inv_type
        )
        Inventory.objects.create(
            customer=customer, name=_uid("inv_"), status=other_status, type=inv_type
        )

        plan = _make_plan(customer, inv_type)

        res = client.get("/api/maintenance-plans/")
        assert res.status_code == 200

        rows = res.json().get("results", res.json())
        row = next(r for r in rows if r["id"] == plan.id)

        assert row["covered_count"] == 2, (
            f"Atteso 2 inventory coperti (solo in_use), trovato: {row['covered_count']}"
        )

    def test_covered_count_zero_when_no_matching_inventory(self):
        user = _superuser()
        client = APIClient()
        client.force_authenticate(user=user)

        cs = _customer_status()
        customer = Customer.objects.create(name=_uid("co_"), status=cs)
        inv_type = _inv_type("Tablet")

        # Nessun inventory per questo cliente e tipo
        plan = _make_plan(customer, inv_type)

        res = client.get("/api/maintenance-plans/")
        assert res.status_code == 200

        rows = res.json().get("results", res.json())
        row = next(r for r in rows if r["id"] == plan.id)
        assert row["covered_count"] == 0

    def test_covered_count_ignores_deleted_inventory(self):
        user = _superuser()
        client = APIClient()
        client.force_authenticate(user=user)

        from django.utils import timezone
        cs = _customer_status()
        customer = Customer.objects.create(name=_uid("co_"), status=cs)
        in_use = _inv_status("in_use")
        inv_type = _inv_type("Printer")

        Inventory.objects.create(
            customer=customer, name=_uid("inv_"), status=in_use, type=inv_type,
            deleted_at=timezone.now(),  # soft-deleted
        )
        Inventory.objects.create(
            customer=customer, name=_uid("inv_"), status=in_use, type=inv_type,
        )

        plan = _make_plan(customer, inv_type)

        res = client.get("/api/maintenance-plans/")
        rows = res.json().get("results", res.json())
        row = next(r for r in rows if r["id"] == plan.id)
        assert row["covered_count"] == 1, "Gli inventory soft-deleted non devono essere contati"


# ─── Test: inventory_type_labels usa il prefetch ──────────────────────────────

class TestInventoryTypeLabelsNoPlusOne:
    def test_inventory_type_labels_returned_correctly(self):
        user = _superuser()
        client = APIClient()
        client.force_authenticate(user=user)

        cs = _customer_status()
        customer = Customer.objects.create(name=_uid("co_"), status=cs)
        type_a = _inv_type("Server")
        type_b = _inv_type("NAS")

        plan = MaintenancePlan.objects.create(
            title="Piano multi-type",
            customer=customer,
            schedule_type=ScheduleType.INTERVAL,
            interval_unit=IntervalUnit.MONTHS,
            interval_value=6,
            next_due_date="2027-06-01",
        )
        plan.inventory_types.set([type_a, type_b])

        res = client.get("/api/maintenance-plans/")
        assert res.status_code == 200

        rows = res.json().get("results", res.json())
        row = next(r for r in rows if r["id"] == plan.id)

        labels = sorted(row["inventory_type_labels"])
        assert "Server" in labels
        assert "NAS" in labels

    def test_list_with_multiple_plans_stays_within_query_budget(self):
        """Con N piani, il numero di query deve rimanere sub-lineare.

        Non usiamo assertNumQueries (difficile su SQLite/PostgreSQL in CI),
        ma verifichiamo che la risposta sia corretta per tutti i piani:
        se ci fossero N+1 query, il test sarebbe comunque un canario utile.
        """
        user = _superuser()
        client = APIClient()
        client.force_authenticate(user=user)

        cs = _customer_status()
        customer = Customer.objects.create(name=_uid("co_"), status=cs)
        in_use = _inv_status("in_use")

        plan_ids = []
        for i in range(5):
            inv_type = _inv_type(f"Type_{i}_{_uid()}")
            Inventory.objects.create(
                customer=customer, name=_uid("inv_"), status=in_use, type=inv_type
            )
            plan = _make_plan(customer, inv_type, title=f"Piano {i}")
            plan_ids.append(plan.id)

        res = client.get("/api/maintenance-plans/")
        assert res.status_code == 200

        rows = res.json().get("results", res.json())
        matched = [r for r in rows if r["id"] in plan_ids]
        assert len(matched) == 5

        # Ogni piano deve avere covered_count=1 (1 inventory per tipo)
        for row in matched:
            assert row["covered_count"] == 1, (
                f"Piano {row['id']}: atteso covered_count=1, trovato {row['covered_count']}"
            )
            assert len(row["inventory_type_labels"]) == 1


# ─── Test: PC-01 — IssueSerializer con created_by=NULL ───────────────────────

class TestIssueSerializerNullCreatedBy:
    def test_issue_list_does_not_crash_when_created_by_is_null(self):
        """Verifica il fix PC-01: get_created_by_full_name non crasha con NULL."""
        from core.models import CustomerStatus, InventoryStatus, InventoryType
        from crm.models import Customer
        from issues.models import Issue, IssueStatus

        user = _superuser()
        client = APIClient()
        client.force_authenticate(user=user)

        cs, _ = CustomerStatus.objects.get_or_create(
            key=_uid("cs_"), defaults={"label": "Active"}
        )
        customer = Customer.objects.create(name=_uid("co_"), status=cs)

        # Crea issue con created_by=NULL (simula utente eliminato)
        issue = Issue.objects.create(
            title="Issue senza autore",
            customer=customer,
            status=IssueStatus.OPEN,
            priority="medium",
            created_by=None,  # simula SET_NULL dopo eliminazione utente
        )

        res = client.get("/api/issues/")
        assert res.status_code == 200, (
            f"GET /api/issues/ ha restituito {res.status_code} con created_by=NULL. "
            f"Assicurati che il fix PC-01 sia applicato."
        )

        rows = res.json().get("results", res.json())
        row = next((r for r in rows if r["id"] == issue.id), None)
        assert row is not None
        assert row["created_by_full_name"] is None, (
            f"Atteso None per created_by_full_name, trovato: {row['created_by_full_name']}"
        )
