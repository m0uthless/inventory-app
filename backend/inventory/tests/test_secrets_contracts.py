import pytest
from uuid import uuid4
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission

from audit.models import AuditEvent
from core.models import InventoryStatus, InventoryType, CustomerStatus, SiteStatus
from crm.models import Customer, Site
from inventory.models import Inventory


@pytest.fixture(autouse=True)
def field_encryption_key(settings):
    settings.FIELD_ENCRYPTION_KEY = "S1gOn3bVq6gUO-pMx4pPLh0bwHM3jbklDPx77ZKDq_U="


@pytest.fixture
def inventory_record(db):
    customer_status, _ = CustomerStatus.objects.get_or_create(
        key="active",
        defaults={"label": "Active", "is_active": True, "sort_order": 1},
    )
    site_status, _ = SiteStatus.objects.get_or_create(
        key="active",
        defaults={"label": "Active", "is_active": True, "sort_order": 1},
    )
    inventory_status, _ = InventoryStatus.objects.get_or_create(
        key="active",
        defaults={"label": "Active", "is_active": True, "sort_order": 1},
    )
    inventory_type, _ = InventoryType.objects.get_or_create(
        key="server",
        defaults={"label": "Server", "is_active": True, "sort_order": 1},
    )

    customer = Customer.objects.create(name="Alpha Industries", status=customer_status)
    site = Site.objects.create(customer=customer, name="HQ", status=site_status)
    return Inventory.objects.create(
        customer=customer,
        site=site,
        name="Alpha Server",
        status=inventory_status,
        type=inventory_type,
        os_user="root",
        os_pwd="super-secret-os",
        app_usr="svc-alpha",
        app_pwd="super-secret-app",
        vnc_pwd="super-secret-vnc",
    )


def _user_with_inventory_perms(*codenames: str):
    User = get_user_model()
    user = User.objects.create_user(username=f"ops-{uuid4().hex[:8]}", password="ops")
    perms = Permission.objects.filter(content_type__app_label="inventory", codename__in=codenames)
    user.user_permissions.add(*perms)
    return user


@pytest.mark.django_db
class TestInventorySecretsContracts:
    def test_detail_without_view_secrets_omits_password_fields(self, api_client, inventory_record):
        user = _user_with_inventory_perms("view_inventory")
        api_client.force_authenticate(user=user)

        res = api_client.get(f"/api/inventories/{inventory_record.id}/")

        assert res.status_code == 200
        data = res.json()
        assert data["os_user"] == "root"
        assert data["app_usr"] == "svc-alpha"
        assert "os_pwd" not in data
        assert "app_pwd" not in data
        assert "vnc_pwd" not in data

    def test_update_without_view_secrets_cannot_modify_password_fields(self, api_client, inventory_record):
        user = _user_with_inventory_perms("view_inventory", "change_inventory")
        api_client.force_authenticate(user=user)

        res = api_client.patch(
            f"/api/inventories/{inventory_record.id}/",
            {"os_pwd": "new-secret-value"},
            format="json",
        )

        assert res.status_code == 403
        inventory_record.refresh_from_db()
        # Value in DB remains the old encrypted secret; retrieve with a privileged user to verify.
        admin = _user_with_inventory_perms("view_inventory", "view_secrets")
        api_client.force_authenticate(user=admin)
        detail = api_client.get(f"/api/inventories/{inventory_record.id}/")
        assert detail.status_code == 200
        assert detail.json()["os_pwd"] == "super-secret-os"

    def test_update_with_view_secrets_masks_password_in_audit(self, api_client, inventory_record):
        user = _user_with_inventory_perms("view_inventory", "change_inventory", "view_secrets")
        api_client.force_authenticate(user=user)

        res = api_client.patch(
            f"/api/inventories/{inventory_record.id}/",
            {"os_pwd": "rotated-secret"},
            format="json",
        )

        assert res.status_code == 200
        event = AuditEvent.objects.filter(action="update", object_id=str(inventory_record.id)).latest("created_at")
        assert event.changes["os_pwd"]["from"] == "••••"
        assert event.changes["os_pwd"]["to"] == "••••"
