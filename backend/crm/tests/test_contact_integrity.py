import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import CustomerStatus, SiteStatus
from crm.models import Customer, Site

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
        key=f"active_contact_integrity_{suffix}", defaults={"label": "Active"}
    )[0]
    return Customer.objects.create(
        name=f"Customer_{suffix}",
        status=status,
        created_by=user,
        updated_by=user,
    )


def _make_site(user, customer, suffix: str):
    status = SiteStatus.objects.get_or_create(
        key=f"active_contact_integrity_{suffix}", defaults={"label": "Active"}
    )[0]
    return Site.objects.create(
        customer=customer,
        name=f"Site_{suffix}",
        status=status,
        created_by=user,
        updated_by=user,
    )


def test_contact_create_rejects_site_from_different_customer():
    user = _make_user()
    customer_a = _make_customer(user, "a")
    customer_b = _make_customer(user, "b")
    site_b = _make_site(user, customer_b, "b")

    client = _auth_client(user)
    response = client.post(
        "/api/contacts/",
        {
            "customer": customer_a.id,
            "site": site_b.id,
            "name": "Mario Rossi",
            "email": "mario@example.com",
        },
        format="json",
    )

    assert response.status_code == 400, response.data
    assert response.data == {
        "site": ["Il sito selezionato non appartiene al cliente del contatto."]
    }


def test_contact_partial_update_rejects_site_from_different_customer():
    user = _make_user()
    customer_a = _make_customer(user, "c")
    customer_b = _make_customer(user, "d")
    site_a = _make_site(user, customer_a, "c")
    site_b = _make_site(user, customer_b, "d")

    client = _auth_client(user)
    create_response = client.post(
        "/api/contacts/",
        {
            "customer": customer_a.id,
            "site": site_a.id,
            "name": "Giulia Bianchi",
        },
        format="json",
    )
    assert create_response.status_code == 201, create_response.data

    contact_id = create_response.data["id"]
    response = client.patch(
        f"/api/contacts/{contact_id}/",
        {"site": site_b.id},
        format="json",
    )

    assert response.status_code == 400, response.data
    assert response.data == {
        "site": ["Il sito selezionato non appartiene al cliente del contatto."]
    }
