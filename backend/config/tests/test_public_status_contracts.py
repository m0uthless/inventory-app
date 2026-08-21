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
        data = res.json()
        assert data['status'] == 'ok'
        assert data['database'] == 'ok'
        # 0.9.1 (WP-01, audit 2026-08-19): NON asserire più un valore di
        # versione hardcoded ("0.5.0"), che era già disallineato dalla vera
        # fonte di verità (SPECTACULAR_SETTINGS["VERSION"] in settings.py,
        # oggi != "0.5.0") e avrebbe reso questo test permanentemente rosso
        # o richiesto un aggiornamento manuale ad ogni release. La singola
        # fonte di verità resta settings.py (vedi anche il commento in
        # config/system_stats_api.py, fix "versione prodotto disallineata"
        # dell'audit 2026-07): qui verifichiamo solo che l'endpoint esponga
        # esattamente quella stessa fonte, non un valore duplicato.
        from django.conf import settings
        assert data['version'] == settings.SPECTACULAR_SETTINGS.get("VERSION")
