"""Fixture condivise per i test dell'app vlan.

Riusa i pattern già in uso in issues/tests (customer/site helper) ed espone
in più un helper per creare utenti Portal (PortalUserProfile) e
utenti interni (permesso core.access_archie), necessari per testare
PortalScopedMixin e le permission class IsPortalUserOrInternal/PortalModelPermissions.
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


# Permessi standard Django full-CRUD per i modelli coinvolti nei test
# PORTAL/Device/VLAN. Usati da make_internal_user/make_portal_user quando
# can_edit=True, per riflettere la matrice reale applicata da
# PortalModelPermissions (view/add/change/delete_<model>), non più il solo
# "device.change_device" che bastava con il vecchio IsPortalEditor.
_FULL_CRUD_CODENAMES = [
    "view_device", "add_device", "change_device", "delete_device",
    "view_vlan", "add_vlan", "change_vlan", "delete_vlan",
    "view_vlaniprequest", "add_vlaniprequest", "change_vlaniprequest", "delete_vlaniprequest",
    "view_rispacs", "add_rispacs", "change_rispacs", "delete_rispacs",
    "view_devicewifi", "add_devicewifi", "change_devicewifi", "delete_devicewifi",
    "view_devicerispacs", "add_devicerispacs", "change_devicerispacs", "delete_devicerispacs",
]


def _grant_permissions(user, codenames):
    perms = Permission.objects.filter(codename__in=codenames)
    user.user_permissions.add(*perms)


def make_internal_user(*, can_edit: bool = True, extra_perms: list[str] | None = None) -> "User":
    """Utente interno Archie: ha il permesso core.access_archie e, se
    can_edit=True, la matrice CRUD completa su Device/VLAN/VlanIpRequest/
    Rispacs/DeviceWifi/DeviceRispacs (richiesta da PortalModelPermissions
    per le operazioni corrispondenti)."""
    user = User.objects.create_user(username=f"internal_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(Permission.objects.get(codename="access_archie"))
    if can_edit:
        _grant_permissions(user, _FULL_CRUD_CODENAMES)
    if extra_perms:
        _grant_permissions(user, extra_perms)
    return user


def make_portal_user(customer: Customer, *, can_edit: bool = False, extra_perms: list[str] | None = None) -> "User":
    """Utente Portal "puro" (nessun accesso interno Archie), con
    PortalUserProfile associato al customer indicato. Vede/scrive SEMPRE
    solo i dati del proprio customer, indipendentemente da qualunque header
    (fix 2.1, audit 2026-07: lo scope non dipende più da X-Portal-Customer)."""
    from portal.models import PortalUserProfile

    user = User.objects.create_user(username=f"portal_{uuid.uuid4().hex[:6]}", password="pw")
    profile = PortalUserProfile.objects.create(user=user, customer=customer)
    profile.customers.add(customer)  # 0.9.0: il default deve essere tra gli assegnati
    if can_edit:
        _grant_permissions(user, _FULL_CRUD_CODENAMES)
    if extra_perms:
        _grant_permissions(user, extra_perms)
    return user


def make_dual_user(customer: Customer, *, can_edit: bool = False) -> "User":
    """Utente "duale": ha SIA un profilo Portal (associato a `customer`) SIA
    l'accesso interno Archie (core.access_archie). Per decisione esplicita
    (2026-07-25): questi utenti NON vengono scopati, vedono tutti i
    customer — stesso comportamento di un utente interno puro."""
    user = make_portal_user(customer, can_edit=can_edit)
    user.user_permissions.add(Permission.objects.get(codename="access_archie"))
    return user
