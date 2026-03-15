import pytest

from core.models import CustomerStatus, SiteStatus
from crm.models import Customer, Site


@pytest.mark.django_db
def test_site_detail_includes_province_and_country(api_client, superuser):
    customer_status = CustomerStatus.objects.create(key="active", label="Attivo")
    site_status = SiteStatus.objects.create(key="active", label="Attivo")
    customer = Customer.objects.create(name="ACME", status=customer_status)
    site = Site.objects.create(
        customer=customer,
        name="HQ Milano",
        status=site_status,
        city="Milano",
        province="MI",
        country="IT",
    )

    api_client.force_authenticate(user=superuser)
    resp = api_client.get(f"/api/sites/{site.id}/")

    assert resp.status_code == 200
    assert resp.data["province"] == "MI"
    assert resp.data["country"] == "IT"
