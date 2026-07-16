"""Fixture condivise per i test dell'app vlan.

Riusa i pattern già in uso in issues/tests (customer/site helper) ed espone
in più un helper per creare utenti portale AUSL BO (AuslBoUserProfile) e
utenti interni (permesso core.access_archie), necessari per testare
AuslBoScopedMixin e le permission class IsAuslBoUserOrInternal/IsAuslBoEditor.
"""
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission

from core.models import CustomerStatus, SiteStatus
from crm.models import Customer, Site

User = get_user_model()


@pytest.fixture
def customer_status(db):
    obj, _ = CustomerStatus.objects.get_or_create(
        key="active_vlan_tests", defaults={"label": "Active"},
    )
    return obj


@pytest.fixture
def site_status(db):
    obj, _ = SiteStatus.objects.get_or_create(
        key="active_vlan_tests", defaults={"label": "Active"},
    )
    return obj


def make_customer(user, customer_status, suffix: str = None) -> Customer:
    suffix = suffix or uuid.uuid4().hex[:6]
    return Customer.objects.create(
        name=f"Customer_{suffix}", status=customer_status,
        created_by=user, updated_by=user,
    )


def make_site(user, customer, site_status, suffix: str = None) -> Site:
    suffix = suffix or uuid.uuid4().hex[:6]
    return Site.objects.create(
        customer=customer, name=f"Site_{suffix}", status=site_status,
        created_by=user, updated_by=user,
    )


def make_internal_user(*, can_edit: bool = True) -> "User":
    """Utente interno Archie: ha il permesso core.access_archie e, se
    can_edit=True, anche device.change_device (richiesto da IsAuslBoEditor
    per le operazioni di scrittura su vlan/vlan-ip-request)."""
    user = User.objects.create_user(username=f"internal_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(Permission.objects.get(codename="access_archie"))
    if can_edit:
        user.user_permissions.add(Permission.objects.get(codename="change_device"))
    return user


def make_auslbo_user(customer: Customer, *, can_edit: bool = False) -> "User":
    """Utente portale AUSL BO, con AuslBoUserProfile associato al customer
    indicato. Vede solo i dati del proprio customer quando la request porta
    l'header X-Auslbo-Portal: 1."""
    from auslbo.models import AuslBoUserProfile

    user = User.objects.create_user(username=f"auslbo_{uuid.uuid4().hex[:6]}", password="pw")
    AuslBoUserProfile.objects.create(user=user, customer=customer)
    if can_edit:
        user.user_permissions.add(Permission.objects.get(codename="change_device"))
    return user
