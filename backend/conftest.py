import pytest


@pytest.fixture(autouse=True)
def _isolated_media_root(settings, tmp_path_factory):
    """I file caricati dai test vanno in una cartella temporanea, mai nel
    volume media reale (in dev i test girano nel container con il volume
    montato, e da root: lasciavano cartelle root-owned, causa di B-16)."""
    settings.MEDIA_ROOT = str(tmp_path_factory.mktemp("media"))


@pytest.fixture(autouse=True)
def _fresh_module_switches():
    """Lo stato dei moduli spenti e della manutenzione sta in cache
    (core/modules.py, core/maintenance.py) e il rollback del DB tra un test
    e l'altro non la invalida."""
    from core.maintenance import invalidate_cache as invalidate_maintenance
    from core.modules import invalidate_cache

    invalidate_cache()
    invalidate_maintenance()
    yield
    invalidate_cache()
    invalidate_maintenance()


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
