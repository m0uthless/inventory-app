"""Pagina Clienti (restyle): contatori, filtri per colonna e viste, riepilogo."""
import datetime

import pytest
from django.utils import timezone

from contracts.models import Contract
from crm.models import Contact, Customer
from issues.models import Issue


def _ids(api_client, qs):
    resp = api_client.get(f"/api/customers/?{qs}")
    assert resp.status_code == 200, resp.data
    return {row["id"] for row in resp.data["results"]}


@pytest.mark.django_db
def test_counts_filters_and_summary(api_client, superuser, customer_status):
    today = timezone.localdate()
    a = Customer.objects.create(name="Azienda USL di Imola", display_name="AUSL Imola", status=customer_status, vat_number="00705271203", province="BO")
    b = Customer.objects.create(name="Poliambulatorio Manzano", status=customer_status, province="UD")
    Contact.objects.create(customer=a, name="Laura Gentili", phone="0542 662 410", is_primary=True)
    Issue.objects.create(customer=a, title="Worklist vuota", status="open", created_by=superuser)
    Issue.objects.create(customer=a, title="Lentezza PACS", status="in_progress", created_by=superuser)
    Issue.objects.create(customer=a, title="Chiusa", status="closed", created_by=superuser)
    Contract.objects.create(customer=a, code="C1", title="Full risk", start_date=today, end_date=today + datetime.timedelta(days=20), status="attivo")
    Contract.objects.create(customer=a, code="C2", title="Bozza", start_date=today, end_date=today + datetime.timedelta(days=5), status="bozza")
    api_client.force_authenticate(user=superuser)

    row = api_client.get(f"/api/customers/{a.id}/").data
    assert row["open_issues_count"] == 2
    assert row["active_contracts_count"] == 1
    assert row["next_contract_title"] == "Full risk"

    assert _ids(api_client, "name_q=imola") == {a.id}
    assert _ids(api_client, "city_q=ud") == {b.id}
    assert _ids(api_client, "contact_q=662") == {a.id}
    assert _ids(api_client, "has_open_issues=true") == {a.id}
    assert _ids(api_client, "contract_expiring=true") == {a.id}
    assert _ids(api_client, "incomplete=true") == {b.id}

    s = api_client.get("/api/customers/summary/").data
    assert s["with_open_issues"] == 1 and s["open_issues"] == 2
    assert s["contracts_expiring"] == 1 and s["nearest_expiry"]["title"] == "Full risk"
    assert s["incomplete"] == 1
    assert s["top_open_issues"]["name"] == "AUSL Imola"
