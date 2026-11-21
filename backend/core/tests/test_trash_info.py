from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

from crm.models import Contact, Customer, Site
from core.testing import make_archie_user

pytestmark = pytest.mark.django_db


def _setup(superuser, customer_status, site_status):
    customer = Customer.objects.create(name="Acme", status=customer_status, created_by=superuser, updated_by=superuser)
    site = Site.objects.create(customer=customer, name="HQ", status=site_status, created_by=superuser, updated_by=superuser)
    contact = Contact.objects.create(customer=customer, name="Mario", created_by=superuser, updated_by=superuser)
    return customer, site, contact


def test_trash_info_reports_blocks_and_who_deleted(api_client, superuser, customer_status, site_status):
    superuser.first_name, superuser.last_name = "Fede", "Mutuale"
    superuser.save()
    customer, site, contact = _setup(superuser, customer_status, site_status)
    api_client.force_authenticate(user=superuser)
    assert api_client.delete(f"/api/sites/{site.id}/").status_code == 204
    assert api_client.delete(f"/api/customers/{customer.id}/").status_code == 204

    res = api_client.get("/api/trash/info/", {"customers": str(customer.id), "sites": f"{site.id},999999", "contacts": str(contact.id)})
    assert res.status_code == 200, res.data

    cust = res.data["customers"][str(customer.id)]
    # Il contatto è ancora attivo: blocca l'eliminazione definitiva del cliente.
    assert {"label": "contatti", "count": 1} in cust["purge_block"]
    assert cust["restore_block"] is None
    assert cust["deleted_by"] == "Fede Mutuale"

    s = res.data["sites"]
    assert list(s.keys()) == [str(site.id)]  # gli id non nel cestino non compaiono
    assert "Ripristina prima il cliente" in s[str(site.id)]["restore_block"]
    assert s[str(site.id)]["purge_block"] == []

    # Il contatto non è nel cestino.
    assert res.data["contacts"] == {}


def test_trash_info_skips_types_without_view_permission(api_client, superuser, customer_status, site_status):
    customer, _site, _contact = _setup(superuser, customer_status, site_status)
    api_client.force_authenticate(user=superuser)
    api_client.delete(f"/api/customers/{customer.id}/")

    user = make_archie_user(username="nobody", password="x")
    api_client.force_authenticate(user=user)
    res = api_client.get("/api/trash/info/", {"customers": str(customer.id)})
    assert res.status_code == 200
    assert res.data == {}


def test_trash_info_requires_login(api_client):
    assert api_client.get("/api/trash/info/", {"customers": "1"}).status_code in (401, 403)


def test_trash_info_covers_purchase_orders_contracts_and_issues(api_client, superuser, customer_status):
    """Lista del 21/11, punto 4: PO, contratti e issue anche nel Cestino."""
    from datetime import date

    from django.utils import timezone

    from contracts.models import Contract
    from issues.models import Issue
    from purchaseorders.models import PurchaseOrderEntry

    customer = Customer.objects.create(name="Acme", status=customer_status)
    now = timezone.now()
    po = PurchaseOrderEntry.objects.create(offer_date="2026-01-15", description="Offerta", client_name="Acme", amount="1.00", deleted_at=now)
    ctr = Contract.objects.create(customer=customer, code="CT-T-1", title="Assistenza", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), deleted_at=now)
    iss = Issue.objects.create(title="Worklist", customer=customer, created_by=superuser, deleted_at=now)
    api_client.force_authenticate(user=superuser)
    res = api_client.get("/api/trash/info/", {"purchase-orders": str(po.id), "contracts": str(ctr.id), "issues": str(iss.id)})
    assert res.status_code == 200, res.data
    for key, obj in (("purchase-orders", po), ("contracts", ctr), ("issues", iss)):
        assert res.data[key][str(obj.id)]["restore_block"] is None


def test_trash_info_hides_issues_of_other_areas(api_client, customer_status):
    from django.contrib.auth.models import Permission
    from django.utils import timezone

    from attendance.models import LeaveArea
    from issues.models import Issue

    from core.models import UserProfile

    mine = LeaveArea.objects.create(key="trash_mine", label="Bologna")
    other = LeaveArea.objects.create(key="trash_other", label="Romagna")
    u = make_archie_user(username="trash_area", password="pw")
    u.user_permissions.add(Permission.objects.get(codename="view_issue"))
    profile, _ = UserProfile.objects.get_or_create(user=u)
    profile.leave_area = mine
    profile.save(update_fields=["leave_area"])
    u = get_user_model().objects.get(pk=u.pk)
    customer = Customer.objects.create(name="Acme", status=customer_status)
    iss = Issue.objects.create(title="Altrove", customer=customer, area=other, created_by=u, deleted_at=timezone.now())
    api_client.force_authenticate(user=u)
    res = api_client.get("/api/trash/info/", {"issues": str(iss.id)})
    assert res.status_code == 200
    assert res.data.get("issues", {}) == {}


def test_placeholder_customer_never_shows_in_the_trash(api_client, superuser):
    """Il cliente segnaposto delle issue è soft-deleted di proposito: né elenco, né ripristino, né eliminazione."""
    from issues.models import get_placeholder_customer

    ph = get_placeholder_customer()
    api_client.force_authenticate(user=superuser)
    rows = api_client.get("/api/customers/", {"only_deleted": 1, "page_size": 200}).json()["results"]
    assert ph.id not in [r["id"] for r in rows]
    api_client.post("/api/customers/bulk_restore/", {"ids": [ph.id]}, format="json")
    api_client.post("/api/customers/bulk_purge/", {"ids": [ph.id]}, format="json")
    ph.refresh_from_db()
    assert ph.deleted_at is not None
