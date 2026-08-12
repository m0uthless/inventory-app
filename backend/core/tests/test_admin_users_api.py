"""Test suite: pannello "Utenti e Gruppi" (core.manage_users).

Copre:
- Enforcement del permesso core.manage_users (403 per chi non ce l'ha).
- Matrice RWD per modulo: assegnazione a un Gruppo e lettura via API.
- Permessi diretti utente: additivi rispetto al gruppo, con reset.
- Reset password (one-shot, ritorna la password in chiaro).
- is_staff/is_superuser modificabili solo da un superuser.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from rest_framework.test import APIClient

from core.models import UserProfile

pytestmark = pytest.mark.django_db

User = get_user_model()


def _make_user(*, superuser: bool = False, with_manage_users: bool = False):
    u = User.objects.create_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw", email="test@example.com")
    if superuser:
        u.is_staff = True
        u.is_superuser = True
        u.save(update_fields=["is_staff", "is_superuser"])
    if with_manage_users:
        perm = Permission.objects.get(codename="manage_users", content_type__app_label="core")
        u.user_permissions.add(perm)
    return u


def _client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


# ── Enforcement permesso core.manage_users ─────────────────────────────────

def test_admin_users_requires_manage_users_permission():
    plain = _make_user()
    target = _make_user()
    c = _client(plain)
    resp = c.get("/api/admin-users/")
    assert resp.status_code == 403


def test_admin_users_allowed_for_manage_users_permission():
    admin = _make_user(with_manage_users=True)
    _make_user()
    c = _client(admin)
    resp = c.get("/api/admin-users/")
    assert resp.status_code == 200


def test_admin_users_allowed_for_superuser():
    admin = _make_user(superuser=True)
    c = _client(admin)
    resp = c.get("/api/admin-users/")
    assert resp.status_code == 200


# ── Permission modules ──────────────────────────────────────────────────────

def test_permission_modules_endpoint():
    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    resp = c.get("/api/admin/permission-modules/")
    assert resp.status_code == 200
    app_labels = {m["app_label"] for m in resp.json()}
    assert "crm" in app_labels
    assert "inventory" in app_labels
    # core.access_archie e core.manage_users devono comparire come "extra" del modulo core
    core_module = next(m for m in resp.json() if m["app_label"] == "core")
    extra_codenames = {p["codename"] for p in core_module["extra_permissions"]}
    assert "core.access_archie" in extra_codenames
    assert "core.manage_users" in extra_codenames


# ── Gruppi: RWD bulk per modulo ──────────────────────────────────────────────

def test_group_rwd_roundtrip():
    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    group = Group.objects.create(name=f"g_{uuid.uuid4().hex[:6]}")

    resp = c.patch(
        f"/api/admin-groups/{group.id}/",
        data={"module_permissions": {"crm": {"r": True, "w": True, "d": False}}},
        format="json",
    )
    assert resp.status_code == 200
    state = resp.json()["permissions_state"]["modules"]
    assert state["crm"] == {"r": True, "w": True, "d": False}
    assert state["inventory"] == {"r": False, "w": False, "d": False}

    # il gruppo deve avere davvero i permessi Django sottostanti
    codenames = set(group.permissions.values_list("codename", flat=True))
    assert "view_customer" in codenames
    assert "add_customer" in codenames
    assert "change_customer" in codenames
    assert "delete_customer" not in codenames


# ── Utenti: permessi diretti additivi + reset a gruppo ──────────────────────

def test_user_direct_permissions_are_additive_and_resettable():
    admin = _make_user(with_manage_users=True)
    c = _client(admin)

    group = Group.objects.create(name=f"g_{uuid.uuid4().hex[:6]}")
    group.permissions.set(Permission.objects.filter(codename="view_customer"))
    target = _make_user()
    target.groups.add(group)

    # concedo anche "w" su crm direttamente all'utente (extra rispetto al gruppo)
    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={"group_ids": [group.id], "module_permissions": {"crm": {"r": False, "w": True, "d": False}}},
        format="json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["group_permissions"]["modules"]["crm"]["r"] is True
    assert data["direct_permissions"]["modules"]["crm"]["w"] is True

    # reset: i permessi diretti devono azzerarsi, quelli di gruppo restano
    resp = c.post(f"/api/admin-users/{target.id}/reset-permissions-to-group/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["direct_permissions"]["modules"]["crm"]["w"] is False
    assert data["group_permissions"]["modules"]["crm"]["r"] is True


def test_reset_password_returns_plaintext_once():
    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()
    old_hash = target.password

    resp = c.post(f"/api/admin-users/{target.id}/reset-password/")
    assert resp.status_code == 200
    body = resp.json()
    assert "password" in body and len(body["password"]) >= 10

    target.refresh_from_db()
    assert target.password != old_hash
    assert target.check_password(body["password"])


# ── is_staff / is_superuser: solo un superuser può toccarli ────────────────

def test_has_portal_access_flag():
    from portal.models import PortalUserProfile
    from crm.models import Customer, CustomerStatus

    admin = _make_user(with_manage_users=True)
    c = _client(admin)

    status, _ = CustomerStatus.objects.get_or_create(key="au_active", defaults={"label": "Active"})
    customer = Customer.objects.create(name=f"cust_{uuid.uuid4().hex[:6]}", status=status)

    with_access = _make_user()
    without_access = _make_user()
    profile = PortalUserProfile.objects.create(user=with_access, customer=customer)
    profile.customers.add(customer)  # 0.9.0: il default deve essere tra gli assegnati

    resp = c.get("/api/admin-users/")
    assert resp.status_code == 200
    by_id = {row["id"]: row for row in resp.json()}
    assert by_id[with_access.id]["has_portal_access"] is True
    assert by_id[without_access.id]["has_portal_access"] is False


# ── Accesso Portal (dropdown + cliente) ────────────────────────────────────

def _make_customer():
    from crm.models import Customer, CustomerStatus

    status, _ = CustomerStatus.objects.get_or_create(key="au_active", defaults={"label": "Active"})
    return Customer.objects.create(name=f"cust_{uuid.uuid4().hex[:6]}", status=status)


def test_portal_access_read_creates_profile_and_grants_module_permission():
    from portal.models import PortalUserProfile

    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()
    customer = _make_customer()

    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={"portal_access": {"level": "read", "customer_id": customer.id}},
        format="json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_portal_access"] is True
    assert data["portal_profile"] == {"customer_id": customer.id, "customer_name": str(customer)}
    assert data["direct_permissions"]["modules"]["portal"] == {"r": True, "w": False, "d": False}

    profile = PortalUserProfile.objects.get(user=target)
    assert profile.customer_id == customer.id


def test_portal_access_none_removes_profile():
    from portal.models import PortalUserProfile

    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()
    customer = _make_customer()
    profile = PortalUserProfile.objects.create(user=target, customer=customer)
    profile.customers.add(customer)  # 0.9.0: il default deve essere tra gli assegnati

    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={"portal_access": {"level": "none"}},
        format="json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_portal_access"] is False
    assert data["portal_profile"] is None
    assert not PortalUserProfile.objects.filter(user=target).exists()


# ── 0.9.0 punto 6: multi-select clienti (customer_ids) ─────────────────────

def test_portal_access_with_multiple_customer_ids_sets_all_assigned():
    from portal.models import PortalUserProfile

    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()
    c1 = _make_customer()
    c2 = _make_customer()

    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={"portal_access": {"level": "read", "customer_id": c1.id, "customer_ids": [c1.id, c2.id]}},
        format="json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["portal_profile"]["customer_id"] == c1.id
    assert {c["id"] for c in data["portal_profile"]["customers"]} == {c1.id, c2.id}

    profile = PortalUserProfile.objects.get(user=target)
    assert set(profile.customers.values_list("id", flat=True)) == {c1.id, c2.id}
    assert profile.is_active is True


def test_portal_access_default_must_be_among_customer_ids_or_added_automatically():
    """Se il default (customer_id) non è incluso in customer_ids, viene
    comunque aggiunto agli assegnati — altrimenti il profilo nascerebbe
    bloccato (is_active=False) subito dopo la creazione da questo pannello."""
    from portal.models import PortalUserProfile

    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()
    c1 = _make_customer()
    c2 = _make_customer()

    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={"portal_access": {"level": "read", "customer_id": c1.id, "customer_ids": [c2.id]}},
        format="json",
    )
    assert resp.status_code == 200

    profile = PortalUserProfile.objects.get(user=target)
    assert profile.customer_id == c1.id
    assert set(profile.customers.values_list("id", flat=True)) == {c1.id, c2.id}
    assert profile.is_active is True


def test_portal_access_rejects_unknown_customer_id_in_customer_ids():
    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()
    c1 = _make_customer()

    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={"portal_access": {"level": "read", "customer_id": c1.id, "customer_ids": [c1.id, 999999]}},
        format="json",
    )
    assert resp.status_code == 400
    assert "portal_access" in resp.json()


def test_portal_access_backward_compatible_without_customer_ids():
    """Il drawer non aggiornato manda solo customer_id (single-select):
    deve continuare a funzionare come prima del punto 6."""
    from portal.models import PortalUserProfile

    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()
    customer = _make_customer()

    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={"portal_access": {"level": "read", "customer_id": customer.id}},
        format="json",
    )
    assert resp.status_code == 200

    profile = PortalUserProfile.objects.get(user=target)
    assert set(profile.customers.values_list("id", flat=True)) == {customer.id}
    assert profile.is_active is True


def test_portal_access_requires_customer_when_not_none():
    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()

    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={"portal_access": {"level": "full"}},
        format="json",
    )
    assert resp.status_code == 400


# ── Profilo Philips: circoscritto a ServiceNow ──────────────────────────────

def test_philips_forces_technician_and_clears_group_and_permissions():
    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    group = Group.objects.create(name=f"g_{uuid.uuid4().hex[:6]}")
    target = _make_user()
    target.groups.add(group)
    from attendance.models import LeaveArea

    leave_area = LeaveArea.objects.create(label=f"area_{uuid.uuid4().hex[:6]}")

    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={
            "group_ids": [group.id],
            "module_permissions": {"crm": {"r": True, "w": True, "d": True}},
            "profile": {
                "is_philips": True,
                "is_leave_coordinator": True,
                "is_expense_secretary": True,
                "leave_area": leave_area.id,
            },
        },
        format="json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["profile"]["is_philips"] is True
    assert data["profile"]["is_servicenow_technician"] is True
    assert data["profile"]["is_leave_coordinator"] is False
    assert data["profile"]["is_expense_secretary"] is False
    assert data["profile"]["leave_area"] is None
    assert data["groups"] == []
    assert data["direct_permissions"]["modules"]["crm"] == {"r": False, "w": False, "d": False}
    assert data["has_portal_access"] is False


def test_philips_lockdown_applies_even_when_only_saving_permessi_tab():
    """Se il profilo è già Philips in DB, un PATCH che tocca solo i permessi
    deve comunque azzerare gruppo/permessi (non solo quando si tocca 'profile')."""
    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()
    UserProfile.objects.update_or_create(user=target, defaults={"is_philips": True})
    group = Group.objects.create(name=f"g_{uuid.uuid4().hex[:6]}")

    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={"group_ids": [group.id], "module_permissions": {"crm": {"r": True, "w": False, "d": False}}},
        format="json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["groups"] == []
    assert data["direct_permissions"]["modules"]["crm"] == {"r": False, "w": False, "d": False}
    assert data["profile"]["is_servicenow_technician"] is True


def test_only_superuser_can_grant_is_staff():
    admin = _make_user(with_manage_users=True)  # NON superuser
    target = _make_user()
    c = _client(admin)

    resp = c.patch(f"/api/admin-users/{target.id}/", data={"is_staff": True}, format="json")
    assert resp.status_code == 400

    target.refresh_from_db()
    assert target.is_staff is False


def test_superuser_can_grant_is_staff():
    admin = _make_user(superuser=True)
    target = _make_user()
    c = _client(admin)

    resp = c.patch(f"/api/admin-users/{target.id}/", data={"is_staff": True}, format="json")
    assert resp.status_code == 200

    target.refresh_from_db()
    assert target.is_staff is True


# ── Area piano ferie (leave_area) — regressione bug 500 ─────────────────────
# `leave_area` è una FK (attendance.LeaveArea): _apply_write riceve solo
# l'id grezzo dal client e deve risolverlo via leave_area_id, non con un
# setattr diretto (che con un id scalare fa fallire Django con ValueError,
# non intercettato -> 500). Il test Philips esistente non copre questo path
# perché in quel caso il valore viene forzato a None prima del setattr, e
# None è sempre stato un valore accettabile per una FK nullable.

def test_assign_leave_area_to_non_philips_user():
    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()
    from attendance.models import LeaveArea

    leave_area = LeaveArea.objects.create(label=f"area_{uuid.uuid4().hex[:6]}")

    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={"profile": {"leave_area": leave_area.id}},
        format="json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["profile"]["leave_area"] == leave_area.id
    assert data["profile"]["leave_area_name"] == leave_area.label

    target.refresh_from_db()
    assert target.profile.leave_area_id == leave_area.id


def test_clear_leave_area_with_null():
    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()
    from attendance.models import LeaveArea

    leave_area = LeaveArea.objects.create(label=f"area_{uuid.uuid4().hex[:6]}")
    UserProfile.objects.update_or_create(user=target, defaults={"leave_area": leave_area})

    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={"profile": {"leave_area": None}},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["profile"]["leave_area"] is None

    target.refresh_from_db()
    assert target.profile.leave_area_id is None


def test_assign_nonexistent_leave_area_returns_400_not_500():
    admin = _make_user(with_manage_users=True)
    c = _client(admin)
    target = _make_user()

    resp = c.patch(
        f"/api/admin-users/{target.id}/",
        data={"profile": {"leave_area": 999999}},
        format="json",
    )
    assert resp.status_code == 400
