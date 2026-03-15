import pytest

from crm.models import Customer, Site
from inventory.models import Inventory


@pytest.mark.django_db
class TestPublicStatusContracts:
    def test_system_stats_endpoint_is_public_and_returns_expected_shape(
        self,
        client,
        customer_status,
        site_status,
        inventory_status,
        inventory_type,
    ):
        customer = Customer.objects.create(
            name="Customer 01",
            status=customer_status,
        )
        site = Site.objects.create(
            customer=customer,
            name="Site 01",
            status=site_status,
        )
        Inventory.objects.create(
            customer=customer,
            site=site,
            name="Srv 01",
            status=inventory_status,
            type=inventory_type,
        )

        res = client.get('/api/system-stats/')

        assert res.status_code == 200
        data = res.json()
        assert data['inventory_count'] == 1
        assert isinstance(data['uptime'], str)
        assert data['version']

    def test_health_endpoint_reports_ok_when_database_is_available(self, client):
        res = client.get('/api/health/')

        assert res.status_code == 200
        assert res.json() == {
            'status': 'ok',
            'database': 'ok',
            'version': '0.5.0',
        }
