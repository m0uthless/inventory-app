from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

from crm.models import Contact, Customer, Site

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

    user = get_user_model().objects.create_user(username="nobody", password="x")
    api_client.force_authenticate(user=user)
    res = api_client.get("/api/trash/info/", {"customers": str(customer.id)})
    assert res.status_code == 200
    assert res.data == {}


def test_trash_info_requires_login(api_client):
    assert api_client.get("/api/trash/info/", {"customers": "1"}).status_code in (401, 403)
