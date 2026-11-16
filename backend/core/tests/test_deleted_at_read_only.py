"""B-11 (QA 2026-11-15): `deleted_at` non si scrive via API; cestino e
ripristino passano solo dalle action dedicate."""
from __future__ import annotations

import pytest
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from core.testing import make_archie_user
from crm.models import Customer, Site

pytestmark = pytest.mark.django_db


def _editor():
    user = make_archie_user(username="editor", password="pw")
    for codename in ("view_customer", "change_customer", "view_site", "change_site"):
        user.user_permissions.add(Permission.objects.get(content_type__app_label="crm", codename=codename))
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def test_patch_cannot_trash_without_delete_permission(customer_status):
    obj = Customer.objects.create(name="Vivo", status=customer_status)

    resp = _editor().patch(f"/api/customers/{obj.pk}/", {"deleted_at": "2026-01-01T00:00:00Z"}, format="json")

    assert resp.status_code == 200
    obj.refresh_from_db()
    assert obj.deleted_at is None


def test_patch_cannot_restore_child_of_trashed_parent(customer_status, site_status):
    parent = Customer.objects.create(name="Nel cestino", status=customer_status, deleted_at=timezone.now())
    site = Site.objects.create(customer=parent, name="Sito", status=site_status, deleted_at=timezone.now())

    _editor().patch(f"/api/sites/{site.pk}/?include_deleted=1", {"deleted_at": None}, format="json")

    site.refresh_from_db()
    assert site.deleted_at is not None
