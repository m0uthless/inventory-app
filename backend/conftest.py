import pytest


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def superuser(db):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_superuser(
        username="admin",
        email="admin@example.com",
        password="admin",
    )


@pytest.fixture
def customer_status(db):
    from core.models import CustomerStatus

    obj, _ = CustomerStatus.objects.get_or_create(
        key="active",
        defaults={
            "label": "Active",
            "is_active": True,
            "sort_order": 1,
        },
    )
    return obj


@pytest.fixture
def site_status(db):
    from core.models import SiteStatus

    obj, _ = SiteStatus.objects.get_or_create(
        key="active",
        defaults={
            "label": "Active",
            "is_active": True,
            "sort_order": 1,
        },
    )
    return obj


@pytest.fixture
def inventory_status(db):
    from core.models import InventoryStatus

    obj, _ = InventoryStatus.objects.get_or_create(
        key="active",
        defaults={
            "label": "Active",
            "is_active": True,
            "sort_order": 1,
        },
    )
    return obj


@pytest.fixture
def inventory_type(db):
    from core.models import InventoryType

    obj, _ = InventoryType.objects.get_or_create(
        key="server",
        defaults={
            "label": "Server",
            "is_active": True,
            "sort_order": 1,
        },
    )
    return obj


@pytest.fixture(autouse=True)
def field_encryption_key(settings):
    settings.FIELD_ENCRYPTION_KEY = "S1gOn3bVq6gUO-pMx4pPLh0bwHM3jbklDPx77ZKDq_U="
