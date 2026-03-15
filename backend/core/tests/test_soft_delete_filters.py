import pytest

from django.contrib.auth import get_user_model
from django.utils import timezone

from core.models import CustomerStatus
from core.soft_delete import apply_soft_delete_filters
from crm.models import Customer


pytestmark = pytest.mark.django_db


def test_apply_soft_delete_filters_default_active_only():
    User = get_user_model()
    u = User.objects.create_user(username="u", password="p")

    status = CustomerStatus.objects.create(key="active", label="Active")
    active = Customer.objects.create(name="Active", status=status, created_by=u)
    deleted = Customer.objects.create(name="Deleted", status=status, created_by=u, deleted_at=timezone.now())

    qs = Customer.objects.all().order_by("id")
    out = apply_soft_delete_filters(qs, query_params={})
    assert list(out) == [active]
    assert deleted not in out


def test_apply_soft_delete_filters_include_deleted_and_only_deleted():
    User = get_user_model()
    u = User.objects.create_user(username="u2", password="p")

    status = CustomerStatus.objects.create(key="active2", label="Active2")
    active = Customer.objects.create(name="Active2", status=status, created_by=u)
    deleted = Customer.objects.create(name="Deleted2", status=status, created_by=u, deleted_at=timezone.now())

    qs = Customer.objects.all().order_by("id")

    out_all = apply_soft_delete_filters(qs, query_params={"include_deleted": "1"})
    assert list(out_all) == [active, deleted]

    out_deleted = apply_soft_delete_filters(qs, query_params={"only_deleted": "true"})
    assert list(out_deleted) == [deleted]


def test_apply_soft_delete_filters_restore_action_forces_include_deleted():
    User = get_user_model()
    u = User.objects.create_user(username="u3", password="p")

    status = CustomerStatus.objects.create(key="active3", label="Active3")
    active = Customer.objects.create(name="Active3", status=status, created_by=u)
    deleted = Customer.objects.create(name="Deleted3", status=status, created_by=u, deleted_at=timezone.now())

    qs = Customer.objects.all().order_by("id")
    out = apply_soft_delete_filters(qs, query_params={}, action_name="restore")
    assert list(out) == [active, deleted]
