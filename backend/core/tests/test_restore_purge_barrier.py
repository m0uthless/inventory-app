"""H-02 (QA 2026-11-15): le action restore/purge applicano la barriera
Portal/Archie anche se dichiarano `permission_classes` proprie."""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from crm.models import Customer

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def dual_profile_user(customer_status):
    """Accesso interno (access_archie + change/delete cliente) e profilo Portal."""
    from portal.models import PortalUserProfile

    user = User.objects.create_user(username="dual", password="pw")
    for codename in ("access_archie", "change_customer", "delete_customer", "view_customer"):
        user.user_permissions.add(Permission.objects.get(codename=codename))
    home = Customer.objects.create(name="Cliente portal", status=customer_status)
    profile = PortalUserProfile.objects.create(user=user, customer=home)
    profile.customers.set([home])
    return user


def _client(user, ambito: str) -> APIClient:
    c = APIClient()
    c.force_login(user)
    session = c.session
    session["ambito"] = ambito
    session.save()
    return c


def _trashed(customer_status) -> Customer:
    return Customer.objects.create(name="Nel cestino", status=customer_status, deleted_at=timezone.now())


def test_restore_from_portal_session_is_blocked(dual_profile_user, customer_status):
    obj = _trashed(customer_status)
    c = _client(dual_profile_user, "portal")

    assert c.post(f"/api/customers/{obj.pk}/restore/").status_code == 403
    assert c.post("/api/customers/bulk_restore/", {"ids": [obj.pk]}, format="json").status_code == 403
    assert c.post(f"/api/customers/{obj.pk}/purge/").status_code == 403

    obj.refresh_from_db()
    assert obj.deleted_at is not None


def test_restore_from_archie_session_still_works(dual_profile_user, customer_status):
    obj = _trashed(customer_status)
    c = _client(dual_profile_user, "site-repo")

    assert c.post(f"/api/customers/{obj.pk}/restore/").status_code in (200, 204)
    obj.refresh_from_db()
    assert obj.deleted_at is None
