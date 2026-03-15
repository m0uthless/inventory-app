import pytest

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from core.models import CustomerStatus
from crm.models import Customer
from issues.models import Issue


pytestmark = pytest.mark.django_db


def test_issue_restore_requires_change_permission():
    """Ensure Issues restore is protected by CanRestoreModelPermission."""

    User = get_user_model()
    creator = User.objects.create_user(username="creator", password="p")
    no_perm = User.objects.create_user(username="noperm", password="p")
    has_perm = User.objects.create_user(username="hasperm", password="p")

    # Grant change permission on Issue model
    perm = Permission.objects.get(codename="change_issue")
    has_perm.user_permissions.add(perm)

    status = CustomerStatus.objects.create(key="acme", label="ACME")
    customer = Customer.objects.create(name="ACME", status=status, created_by=creator)

    issue = Issue.objects.create(
        title="Broken",
        description="x",
        customer=customer,
        created_by=creator,
    )
    issue.soft_delete()

    url = f"/api/issues/{issue.pk}/restore/"

    c = APIClient()

    c.force_authenticate(user=no_perm)
    r = c.post(url)
    assert r.status_code == 403

    c.force_authenticate(user=has_perm)
    r = c.post(url)
    assert r.status_code == 200
    issue.refresh_from_db()
    assert issue.deleted_at is None
