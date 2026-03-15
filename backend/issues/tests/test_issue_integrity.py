import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import CustomerStatus, InventoryStatus, InventoryType, SiteStatus
from crm.models import Customer, Site
from inventory.models import Inventory

pytestmark = pytest.mark.django_db


def _make_user():
    User = get_user_model()
    u = User.objects.create_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw")
    u.is_staff = True
    u.is_superuser = True
    u.save(update_fields=["is_staff", "is_superuser"])
    return u


def _auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _make_customer(user, suffix: str):
    status = CustomerStatus.objects.get_or_create(
        key=f"active_issue_integrity_{suffix}", defaults={"label": "Active"}
    )[0]
    return Customer.objects.create(
        name=f"Customer_{suffix}",
        status=status,
        created_by=user,
        updated_by=user,
    )


def _make_site(user, customer, suffix: str):
    status = SiteStatus.objects.get_or_create(
        key=f"active_issue_integrity_{suffix}", defaults={"label": "Active"}
    )[0]
    return Site.objects.create(
        customer=customer,
        name=f"Site_{suffix}",
        status=status,
        created_by=user,
        updated_by=user,
    )


def _make_inventory(user, customer, site, suffix: str):
    inv_status = InventoryStatus.objects.get_or_create(
        key=f"active_issue_integrity_{suffix}", defaults={"label": "Active"}
    )[0]
    inv_type = InventoryType.objects.get_or_create(
        key=f"server_issue_integrity_{suffix}", defaults={"label": "Server"}
    )[0]
    return Inventory.objects.create(
        customer=customer,
        site=site,
        name=f"Inventory_{suffix}",
        type=inv_type,
        status=inv_status,
        created_by=user,
        updated_by=user,
    )


def test_issue_create_rejects_site_from_different_customer():
    user = _make_user()
    customer_a = _make_customer(user, "a")
    customer_b = _make_customer(user, "b")
    site_b = _make_site(user, customer_b, "b")

    client = _auth_client(user)
    response = client.post(
        "/api/issues/",
        {
            "title": "Issue con sito errato",
            "customer": customer_a.id,
            "site": site_b.id,
        },
        format="json",
    )

    assert response.status_code == 400, response.data
    assert response.data == {
        "site": ["Il sito selezionato non appartiene al cliente della issue."]
    }


def test_issue_create_rejects_inventory_from_different_customer():
    user = _make_user()
    customer_a = _make_customer(user, "c")
    customer_b = _make_customer(user, "d")
    site_b = _make_site(user, customer_b, "d")
    inventory_b = _make_inventory(user, customer_b, site_b, "d")

    client = _auth_client(user)
    response = client.post(
        "/api/issues/",
        {
            "title": "Issue con inventory errato",
            "customer": customer_a.id,
            "inventory": inventory_b.id,
        },
        format="json",
    )

    assert response.status_code == 400, response.data
    assert response.data == {
        "inventory": ["L'inventory selezionato non appartiene al cliente della issue."]
    }


def test_issue_create_rejects_inventory_from_different_site_even_same_customer():
    user = _make_user()
    customer = _make_customer(user, "e")
    site_a = _make_site(user, customer, "e1")
    site_b = _make_site(user, customer, "e2")
    inventory_b = _make_inventory(user, customer, site_b, "e2")

    client = _auth_client(user)
    response = client.post(
        "/api/issues/",
        {
            "title": "Issue con inventory di altro sito",
            "customer": customer.id,
            "site": site_a.id,
            "inventory": inventory_b.id,
        },
        format="json",
    )

    assert response.status_code == 400, response.data
    assert response.data == {
        "inventory": ["L'inventory selezionato non appartiene al sito indicato nella issue."]
    }


def test_issue_partial_update_rejects_cross_customer_site():
    user = _make_user()
    customer_a = _make_customer(user, "f")
    customer_b = _make_customer(user, "g")
    site_a = _make_site(user, customer_a, "f")
    site_b = _make_site(user, customer_b, "g")

    client = _auth_client(user)
    create_response = client.post(
        "/api/issues/",
        {
            "title": "Issue coerente",
            "customer": customer_a.id,
            "site": site_a.id,
        },
        format="json",
    )
    assert create_response.status_code == 201, create_response.data

    issue_id = create_response.data["id"]
    response = client.patch(
        f"/api/issues/{issue_id}/",
        {"site": site_b.id},
        format="json",
    )

    assert response.status_code == 400, response.data
    assert response.data == {
        "site": ["Il sito selezionato non appartiene al cliente della issue."]
    }
