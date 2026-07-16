"""Test per AuslBoScopedMixin sulle liste di Vlan e VlanIpRequest:
- utente portale AUSL BO con header X-Auslbo-Portal:1 → vede solo il proprio customer
- utente portale senza header (richiesta da Archie) → vede tutto
- utente interno → vede tutto indipendentemente dall'header
"""
import pytest

from vlan.models import Vlan, VlanIpRequest
from vlan.tests.conftest import make_auslbo_user, make_customer, make_internal_user, make_site

pytestmark = pytest.mark.django_db


def _make_vlan(customer, site, **overrides):
    defaults = dict(
        customer=customer, site=site, vlan_id=800, name="VLAN scoping",
        network="10.40.0.0/29", subnet="255.255.255.248", gateway="10.40.0.1",
    )
    defaults.update(overrides)
    return Vlan.objects.create(**defaults)


def test_auslbo_user_with_portal_header_sees_only_own_customer(api_client, customer_status, site_status):
    customer_a = make_customer(None, customer_status, "scopea")
    customer_b = make_customer(None, customer_status, "scopeb")
    site_a = make_site(None, customer_a, site_status, "scopea")
    site_b = make_site(None, customer_b, site_status, "scopeb")
    _make_vlan(customer_a, site_a, vlan_id=801, network="10.41.0.0/29",
               subnet="255.255.255.248", gateway="10.41.0.1")
    _make_vlan(customer_b, site_b, vlan_id=802, network="10.42.0.0/29",
               subnet="255.255.255.248", gateway="10.42.0.1")

    portal_user = make_auslbo_user(customer_a)
    api_client.force_authenticate(user=portal_user)

    resp = api_client.get("/api/vlans/", HTTP_X_AUSLBO_PORTAL="1")
    assert resp.status_code == 200
    customer_ids = {v["customer"] for v in resp.data["results"]}
    assert customer_ids == {customer_a.id}


def test_auslbo_user_without_portal_header_sees_everything(api_client, customer_status, site_status):
    """Se l'header manca, la richiesta si considera proveniente da Archie
    principale: anche un utente con profilo AUSL BO vede tutto (comportamento
    documentato in auslbo/mixins.py)."""
    customer_a = make_customer(None, customer_status, "noheadera")
    customer_b = make_customer(None, customer_status, "noheaderb")
    site_a = make_site(None, customer_a, site_status, "noheadera")
    site_b = make_site(None, customer_b, site_status, "noheaderb")
    _make_vlan(customer_a, site_a, vlan_id=803, network="10.43.0.0/29",
               subnet="255.255.255.248", gateway="10.43.0.1")
    _make_vlan(customer_b, site_b, vlan_id=804, network="10.44.0.0/29",
               subnet="255.255.255.248", gateway="10.44.0.1")

    portal_user = make_auslbo_user(customer_a)
    api_client.force_authenticate(user=portal_user)

    resp = api_client.get("/api/vlans/")  # nessun header
    assert resp.status_code == 200
    customer_ids = {v["customer"] for v in resp.data["results"]}
    assert customer_ids == {customer_a.id, customer_b.id}


def test_internal_user_sees_everything_even_with_portal_header(api_client, customer_status, site_status):
    customer_a = make_customer(None, customer_status, "intera")
    customer_b = make_customer(None, customer_status, "interb")
    site_a = make_site(None, customer_a, site_status, "intera")
    site_b = make_site(None, customer_b, site_status, "interb")
    _make_vlan(customer_a, site_a, vlan_id=805, network="10.45.0.0/29",
               subnet="255.255.255.248", gateway="10.45.0.1")
    _make_vlan(customer_b, site_b, vlan_id=806, network="10.46.0.0/29",
               subnet="255.255.255.248", gateway="10.46.0.1")

    internal_user = make_internal_user()
    api_client.force_authenticate(user=internal_user)

    resp = api_client.get("/api/vlans/", HTTP_X_AUSLBO_PORTAL="1")
    assert resp.status_code == 200
    customer_ids = {v["customer"] for v in resp.data["results"]}
    assert customer_ids == {customer_a.id, customer_b.id}


def test_auslbo_scoping_applies_to_vlan_ip_requests_too(api_client, customer_status, site_status):
    customer_a = make_customer(None, customer_status, "reqscopea")
    customer_b = make_customer(None, customer_status, "reqscopeb")
    site_a = make_site(None, customer_a, site_status, "reqscopea")
    site_b = make_site(None, customer_b, site_status, "reqscopeb")
    vlan_a = _make_vlan(customer_a, site_a, vlan_id=807, network="10.47.0.0/29",
                         subnet="255.255.255.248", gateway="10.47.0.1")
    vlan_b = _make_vlan(customer_b, site_b, vlan_id=808, network="10.48.0.0/29",
                         subnet="255.255.255.248", gateway="10.48.0.1")
    VlanIpRequest.objects.create(customer=customer_a, vlan=vlan_a, ip="10.47.0.2", modalita="pacs")
    VlanIpRequest.objects.create(customer=customer_b, vlan=vlan_b, ip="10.48.0.2", modalita="pacs")

    portal_user = make_auslbo_user(customer_a)
    api_client.force_authenticate(user=portal_user)

    resp = api_client.get("/api/vlan-ip-requests/", HTTP_X_AUSLBO_PORTAL="1")
    assert resp.status_code == 200
    customer_ids = {r["customer"] for r in resp.data["results"]}
    assert customer_ids == {customer_a.id}


def test_superuser_with_portal_header_and_no_profile_sees_nothing(api_client, customer_status, site_status, superuser):
    """CASO LIMITE SCOPERTO (vedi nota di consegna): _is_auslbo_user()
    ritorna True per qualunque superuser (bypass esplicito), a prescindere
    dall'esistenza di un AuslBoUserProfile. Se un superuser invia l'header
    X-Auslbo-Portal:1 (es. per debug/test manuale da Postman), il mixin
    prova comunque ad applicare lo scoping: _get_auslbo_customer_id()
    restituisce None (nessun profilo), e il queryset diventa .none() —
    il superuser non vede NESSUNA vlan, anche se ne esistono. Non è un
    problema pratico nell'uso reale (il frontend AUSL BO manda l'header
    solo per chi ha davvero un profilo portal), ma vale la pena saperlo se
    mai si testa manualmente l'API con quell'header da un account admin."""
    customer = make_customer(None, customer_status, "superuserscope")
    site = make_site(None, customer, site_status, "superuserscope")
    _make_vlan(customer, site, vlan_id=809, network="10.49.0.0/29",
               subnet="255.255.255.248", gateway="10.49.0.1")

    api_client.force_authenticate(user=superuser)
    resp = api_client.get("/api/vlans/", HTTP_X_AUSLBO_PORTAL="1")
    assert resp.status_code == 200
    assert resp.data["results"] == []
