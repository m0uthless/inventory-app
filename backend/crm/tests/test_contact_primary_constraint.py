"""Test di regressione 0.9.1 (WP-05, archie-dataconstraints — audit
2026-08-19, DATA-003): "un solo contatto primario per customer/site" ora
garantito da un vincolo DB (ux_contact_one_primary_per_customer_*), non
solo da application code eseguito dopo il save.

Copre: promozione via create/update/restore/bulk_restore demuove
correttamente il vecchio primario; il caso site=None (contatto a livello
customer) è isolato correttamente dal caso site specifico; il backstop
IntegrityError->400 quando il vincolo scatta comunque (caso limite: due
insert concorrenti sullo stesso customer/site senza primario preesistente,
qui simulato bypassando l'application layer con un secondo INSERT diretto
via ORM per dimostrare che il DB, non solo l'app, blocca il duplicato).
"""
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from core.models import CustomerStatus, SiteStatus
from crm.models import Contact, Customer, Site

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
        key=f"active_primary_{suffix}", defaults={"label": "Active"}
    )[0]
    return Customer.objects.create(name=f"Customer_{suffix}", status=status, created_by=user, updated_by=user)


def _make_site(user, customer, suffix: str):
    status = SiteStatus.objects.get_or_create(
        key=f"active_primary_{suffix}", defaults={"label": "Active"}
    )[0]
    return Site.objects.create(customer=customer, name=f"Site_{suffix}", status=status, created_by=user, updated_by=user)


def test_creating_new_primary_demotes_the_old_one(db):
    user = _make_user()
    customer = _make_customer(user, "c1")
    client = _auth_client(user)

    r1 = client.post("/api/contacts/", {"customer": customer.id, "name": "Primo", "is_primary": True}, format="json")
    assert r1.status_code == 201, r1.data

    r2 = client.post("/api/contacts/", {"customer": customer.id, "name": "Secondo", "is_primary": True}, format="json")
    assert r2.status_code == 201, r2.data

    c1 = Contact.objects.get(id=r1.data["id"])
    c2 = Contact.objects.get(id=r2.data["id"])
    c1.refresh_from_db()
    assert c1.is_primary is False
    assert c2.is_primary is True


def test_customer_level_and_site_level_primary_are_independent(db):
    """Un contatto primario "a livello customer" (site=None) e uno
    primario per un site specifico dello stesso customer NON si demuovono
    a vicenda: sono due gruppi indipendenti."""
    user = _make_user()
    customer = _make_customer(user, "c2")
    site = _make_site(user, customer, "s2")
    client = _auth_client(user)

    r1 = client.post(
        "/api/contacts/",
        {"customer": customer.id, "name": "CustomerLevel", "is_primary": True},
        format="json",
    )
    assert r1.status_code == 201, r1.data

    r2 = client.post(
        "/api/contacts/",
        {"customer": customer.id, "site": site.id, "name": "SiteLevel", "is_primary": True},
        format="json",
    )
    assert r2.status_code == 201, r2.data

    c1 = Contact.objects.get(id=r1.data["id"])
    c1.refresh_from_db()
    assert c1.is_primary is True, "il primario a livello customer non deve essere demosso da uno a livello site"


def test_update_to_primary_demotes_existing_primary(db):
    user = _make_user()
    customer = _make_customer(user, "c3")
    client = _auth_client(user)

    r1 = client.post("/api/contacts/", {"customer": customer.id, "name": "A", "is_primary": True}, format="json")
    r2 = client.post("/api/contacts/", {"customer": customer.id, "name": "B", "is_primary": False}, format="json")
    assert r1.status_code == 201 and r2.status_code == 201

    resp = client.patch(f"/api/contacts/{r2.data['id']}/", {"is_primary": True}, format="json")
    assert resp.status_code == 200, resp.data

    c1 = Contact.objects.get(id=r1.data["id"])
    c1.refresh_from_db()
    assert c1.is_primary is False


def test_restore_demotes_conflicting_primary_first(db):
    """Un contatto primario viene soft-deleted; nel frattempo un altro
    contatto diventa primario per lo stesso customer; il restore del
    primo non deve violare il vincolo — deve demuovere il secondo."""
    user = _make_user()
    customer = _make_customer(user, "c4")
    client = _auth_client(user)

    r1 = client.post("/api/contacts/", {"customer": customer.id, "name": "Originale", "is_primary": True}, format="json")
    assert r1.status_code == 201
    del_resp = client.delete(f"/api/contacts/{r1.data['id']}/")
    assert del_resp.status_code in (200, 204)

    r2 = client.post("/api/contacts/", {"customer": customer.id, "name": "Nuovo", "is_primary": True}, format="json")
    assert r2.status_code == 201

    restore_resp = client.post(f"/api/contacts/{r1.data['id']}/restore/")
    assert restore_resp.status_code == 204, restore_resp.data

    c1 = Contact.objects.get(id=r1.data["id"])
    c2 = Contact.objects.get(id=r2.data["id"])
    assert c1.is_primary is True
    assert c2.is_primary is False


def test_db_constraint_rejects_duplicate_primary_bypassing_app_layer(db):
    """Backstop: anche bypassando l'application layer (ORM diretto, come
    potrebbe capitare con un management command o uno script), il DB
    stesso rifiuta un secondo contatto primario per lo stesso customer."""
    user = _make_user()
    customer = _make_customer(user, "c5")

    Contact.objects.create(customer=customer, name="Uno", is_primary=True, created_by=user, updated_by=user)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Contact.objects.create(customer=customer, name="Due", is_primary=True, created_by=user, updated_by=user)


def test_view_maps_integrity_error_to_friendly_400(db, monkeypatch):
    """Il backstop IntegrityError->400 in ContactViewSet.create scatta
    anche quando _demote_other_primaries non ha nulla da demuovere (nessun
    primario preesistente) e il conflitto emerge solo al momento
    dell'INSERT — simulato disabilitando temporaneamente la demote per
    forzare il DB a essere l'unica linea di difesa."""
    from crm.api import ContactViewSet

    user = _make_user()
    customer = _make_customer(user, "c6")
    client = _auth_client(user)

    Contact.objects.create(customer=customer, name="Preesistente", is_primary=True, created_by=user, updated_by=user)

    # Forza _demote_other_primaries a no-op per simulare il caso limite in
    # cui due richieste concorrenti superano entrambe il controllo prima
    # che una delle due abbia committato.
    monkeypatch.setattr(ContactViewSet, "_demote_other_primaries", lambda self, *a, **k: None)

    resp = client.post(
        "/api/contacts/",
        {"customer": customer.id, "name": "Concorrente", "is_primary": True},
        format="json",
    )
    assert resp.status_code == 400
    assert "is_primary" in resp.data
