"""Pagina Contatti (restyle): filtri per colonna e viste, riepilogo."""
import pytest

from core.models import SiteStatus
from crm.models import Contact, Customer, Site


def _ids(api_client, qs):
    resp = api_client.get(f"/api/contacts/?{qs}")
    assert resp.status_code == 200, resp.data
    return {row["id"] for row in resp.data["results"]}


@pytest.mark.django_db
def test_contact_filters_and_summary(api_client, superuser, customer_status):
    st = SiteStatus.objects.create(key="active", label="Attivo")
    c = Customer.objects.create(name="Azienda USL di Imola", display_name="AUSL Imola", status=customer_status)
    c2 = Customer.objects.create(name="Rizzoli", status=customer_status)
    site = Site.objects.create(customer=c, name="Ospedale S. Maria", status=st, city="Imola")
    a = Contact.objects.create(customer=c, name="Laura Gentili", department="Radiologia", phone="0542 662 410", is_primary=True)
    b = Contact.objects.create(customer=c, site=site, name="Davide Pirazzoli", email="d.p@ausl.it")
    x = Contact.objects.create(customer=c2, name="Senza Recapiti")
    api_client.force_authenticate(user=superuser)

    assert _ids(api_client, "name_q=laura") == {a.id}
    assert _ids(api_client, "department_q=radio") == {a.id}
    assert _ids(api_client, "customer_q=imola") == {a.id, b.id}
    assert _ids(api_client, "site_q=maria") == {b.id}
    assert _ids(api_client, "phone_q=662") == {a.id}
    assert _ids(api_client, "email_q=ausl") == {b.id}
    assert _ids(api_client, "unreachable=true") == {x.id}
    assert _ids(api_client, "has_site=true") == {b.id}
    assert _ids(api_client, "has_site=false") == {a.id, x.id}

    s = api_client.get("/api/contacts/summary/").data
    assert s["total"] == 3 and s["customers"] == 2 and s["primaries"] == 1
    assert s["with_site"] == 1 and s["without_site"] == 2 and s["unreachable"] == 1
    assert s["customers_total"] == 2 and s["customers_without_primary"] == 1
    assert s["by_customer"][0]["count"] == 2 and len(s["growth"]) == 12
