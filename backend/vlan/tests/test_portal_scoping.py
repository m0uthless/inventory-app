"""Test per PortalScopedMixin sulle liste di Vlan e VlanIpRequest, dopo il
fix 2.1 (audit 2026-07): lo scope NON dipende più dall'header
X-Portal-Customer (controllabile dal client), ma solo da identità/permessi
server-side:

- utente portale "puro" (PortalUserProfile, nessun accesso interno) →
  SEMPRE scopato sul proprio customer, con o senza header, con o senza
  header manomesso/omesso;
- utente interno (core.access_archie o superuser) → mai scopato;
- utente "duale" (profilo Portal + accesso interno) → NON scopato se la
  sessione non ha ambito="portal" (default, o login con ambito="site-repo"
  dal frontend Archie principale); SCOPATO come un utente Portal puro se
  la sessione ha ambito="portal" (0.9.0, login dal frontend Portal — vedi
  _bypasses_portal_scope in portal/permissions.py e login_view in
  config/auth_views.py).
"""
import pytest

from vlan.models import Vlan, VlanIpRequest
from vlan.tests.conftest import make_portal_user, make_customer, make_dual_user, make_internal_user, make_site

pytestmark = pytest.mark.django_db


def _make_vlan(customer, site, **overrides):
    defaults = dict(
        customer=customer, site=site, vlan_id=800, name="VLAN scoping",
        network="10.40.0.0/29", subnet="255.255.255.248", gateway="10.40.0.1",
    )
    defaults.update(overrides)
    return Vlan.objects.create(**defaults)


def test_portal_user_sees_only_own_customer_with_header(api_client, customer_status, site_status):
    customer_a = make_customer(None, customer_status, "scopea")
    customer_b = make_customer(None, customer_status, "scopeb")
    site_a = make_site(None, customer_a, site_status, "scopea")
    site_b = make_site(None, customer_b, site_status, "scopeb")
    _make_vlan(customer_a, site_a, vlan_id=801, network="10.41.0.0/29",
               subnet="255.255.255.248", gateway="10.41.0.1")
    _make_vlan(customer_b, site_b, vlan_id=802, network="10.42.0.0/29",
               subnet="255.255.255.248", gateway="10.42.0.1")

    portal_user = make_portal_user(customer_a)
    api_client.force_authenticate(user=portal_user)

    resp = api_client.get("/api/vlans/", HTTP_X_PORTAL_CUSTOMER="1")
    assert resp.status_code == 200
    customer_ids = {v["customer"] for v in resp.data["results"]}
    assert customer_ids == {customer_a.id}


def test_portal_user_sees_only_own_customer_without_header(api_client, customer_status, site_status):
    """FIX 2.1: prima del fix, un utente portale senza header vedeva TUTTI
    i customer (bypass completo dello scope, bastava non mandare l'header
    da Postman/curl). Ora lo scope è identico con o senza header."""
    customer_a = make_customer(None, customer_status, "noheadera")
    customer_b = make_customer(None, customer_status, "noheaderb")
    site_a = make_site(None, customer_a, site_status, "noheadera")
    site_b = make_site(None, customer_b, site_status, "noheaderb")
    _make_vlan(customer_a, site_a, vlan_id=803, network="10.43.0.0/29",
               subnet="255.255.255.248", gateway="10.43.0.1")
    _make_vlan(customer_b, site_b, vlan_id=804, network="10.44.0.0/29",
               subnet="255.255.255.248", gateway="10.44.0.1")

    portal_user = make_portal_user(customer_a)
    api_client.force_authenticate(user=portal_user)

    resp = api_client.get("/api/vlans/")  # nessun header
    assert resp.status_code == 200
    customer_ids = {v["customer"] for v in resp.data["results"]}
    assert customer_ids == {customer_a.id}


def test_portal_user_sees_only_own_customer_with_forged_header(api_client, customer_status, site_status):
    """Un header manomesso/arbitrario non deve avere alcun effetto: non è
    più un fattore autorizzativo."""
    customer_a = make_customer(None, customer_status, "forgeda")
    customer_b = make_customer(None, customer_status, "forgedb")
    site_a = make_site(None, customer_a, site_status, "forgeda")
    site_b = make_site(None, customer_b, site_status, "forgedb")
    _make_vlan(customer_a, site_a, vlan_id=815, network="10.55.0.0/29",
               subnet="255.255.255.248", gateway="10.55.0.1")
    _make_vlan(customer_b, site_b, vlan_id=816, network="10.56.0.0/29",
               subnet="255.255.255.248", gateway="10.56.0.1")

    portal_user = make_portal_user(customer_a)
    api_client.force_authenticate(user=portal_user)

    resp = api_client.get("/api/vlans/", HTTP_X_PORTAL_CUSTOMER="qualunque-cosa")
    assert resp.status_code == 200
    customer_ids = {v["customer"] for v in resp.data["results"]}
    assert customer_ids == {customer_a.id}


def test_internal_user_sees_everything_regardless_of_header(api_client, customer_status, site_status):
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

    resp = api_client.get("/api/vlans/", HTTP_X_PORTAL_CUSTOMER="1")
    assert resp.status_code == 200
    customer_ids = {v["customer"] for v in resp.data["results"]}
    assert customer_ids == {customer_a.id, customer_b.id}


def test_dual_profile_user_sees_everything(api_client, customer_status, site_status):
    """Utente con SIA profilo Portal SIA accesso interno, SENZA ambito
    "portal" fissato in sessione (es. force_authenticate nei test, o
    login dal frontend Archie principale con ambito="site-repo"): non
    viene scopato, vede tutti i customer — comportamento storico
    (decisione 2026-07-25), invariato dal fix 0.9.0 dell'ambito.
    force_authenticate non passa da login_view, quindi la sessione non ha
    mai SESSION_AMBITO_KEY: è esattamente il caso "ambito assente" di
    _bypasses_portal_scope, che deve continuare a bypassare lo scope."""
    customer_a = make_customer(None, customer_status, "duala")
    customer_b = make_customer(None, customer_status, "dualb")
    site_a = make_site(None, customer_a, site_status, "duala")
    site_b = make_site(None, customer_b, site_status, "dualb")
    _make_vlan(customer_a, site_a, vlan_id=817, network="10.57.0.0/29",
               subnet="255.255.255.248", gateway="10.57.0.1")
    _make_vlan(customer_b, site_b, vlan_id=818, network="10.58.0.0/29",
               subnet="255.255.255.248", gateway="10.58.0.1")

    dual_user = make_dual_user(customer_a)
    api_client.force_authenticate(user=dual_user)

    resp = api_client.get("/api/vlans/")  # nessun header
    assert resp.status_code == 200
    customer_ids = {v["customer"] for v in resp.data["results"]}
    assert customer_ids == {customer_a.id, customer_b.id}


def test_dual_profile_user_is_scoped_when_session_ambito_is_portal(api_client, customer_status, site_status):
    """0.9.0: stesso utente "duale" del test sopra, ma con la sessione che
    dichiara ambito="portal" (come dopo un vero login dal frontend Portal,
    vedi login_view in config/auth_views.py): deve essere scopato sul
    proprio customer esattamente come un utente Portal puro, pur
    mantenendo `core.access_archie` per operare senza scope quando invece
    fa login dal frontend Archie principale (ambito="site-repo",
    verificato dal test precedente)."""
    customer_a = make_customer(None, customer_status, "dualportala")
    customer_b = make_customer(None, customer_status, "dualportalb")
    site_a = make_site(None, customer_a, site_status, "dualportala")
    site_b = make_site(None, customer_b, site_status, "dualportalb")
    _make_vlan(customer_a, site_a, vlan_id=819, network="10.59.0.0/29",
               subnet="255.255.255.248", gateway="10.59.0.1")
    _make_vlan(customer_b, site_b, vlan_id=820, network="10.60.0.0/29",
               subnet="255.255.255.248", gateway="10.60.0.1")

    dual_user = make_dual_user(customer_a)
    api_client.force_authenticate(user=dual_user)

    # force_authenticate non passa da login_view: simuliamo esplicitamente
    # l'ambito di sessione che login_view fisserebbe per un vero login Portal.
    session = api_client.session
    session["ambito"] = "portal"
    session.save()
    api_client.cookies["sessionid"] = session.session_key

    resp = api_client.get("/api/vlans/")
    assert resp.status_code == 200
    customer_ids = {v["customer"] for v in resp.data["results"]}
    assert customer_ids == {customer_a.id}

    # Lo stesso utente, con ambito "site-repo" (Archie principale), torna
    # a vedere tutto: la scelta è per-sessione, non per-utente.
    session["ambito"] = "site-repo"
    session.save()
    resp2 = api_client.get("/api/vlans/")
    assert resp2.status_code == 200
    customer_ids2 = {v["customer"] for v in resp2.data["results"]}
    assert customer_ids2 == {customer_a.id, customer_b.id}


def test_portal_scoping_applies_to_vlan_ip_requests_too(api_client, customer_status, site_status):
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

    portal_user = make_portal_user(customer_a)
    api_client.force_authenticate(user=portal_user)

    # Senza header: prima del fix 2.1 avrebbe visto entrambi i customer.
    resp = api_client.get("/api/vlan-ip-requests/")
    assert resp.status_code == 200
    customer_ids = {r["customer"] for r in resp.data["results"]}
    assert customer_ids == {customer_a.id}


# ─── Fix 2.2: scritture cross-customer bloccate per utenti portale ────────────

def test_portal_user_cannot_create_vlan_for_another_customer(api_client, customer_status, site_status):
    """Anche inviando esplicitamente il customer/site di un altro cliente,
    la VLAN creata deve appartenere SEMPRE al customer reale dell'utente
    portale (server-side, fix 2.2)."""
    customer_a = make_customer(None, customer_status, "writea")
    customer_b = make_customer(None, customer_status, "writeb")
    site_b = make_site(None, customer_b, site_status, "writeb")

    portal_user = make_portal_user(customer_a, can_edit=True)
    api_client.force_authenticate(user=portal_user)

    resp = api_client.post(
        "/api/vlans/",
        {
            "customer": customer_b.id, "site": site_b.id, "vlan_id": 850,
            "name": "Tentativo cross-tenant",
            "network": "10.60.0.0/29", "subnet": "255.255.255.248", "gateway": "10.60.0.1",
        },
        format="json",
    )
    # Il site appartiene a customer_b, ma il customer viene forzato ad A:
    # la validazione tenant_related_fields deve rifiutare il mismatch.
    assert resp.status_code == 400
    assert "site" in resp.data


def test_portal_user_creates_vlan_forced_to_own_customer(api_client, customer_status, site_status):
    """Un portale che invia dati coerenti con il PROPRIO customer crea
    normalmente, e il campo customer risultante è comunque quello reale
    (anche se il client ne avesse inviato uno diverso)."""
    customer_a = make_customer(None, customer_status, "writeok")
    site_a = make_site(None, customer_a, site_status, "writeok")

    portal_user = make_portal_user(customer_a, can_edit=True)
    api_client.force_authenticate(user=portal_user)

    resp = api_client.post(
        "/api/vlans/",
        {
            "customer": customer_a.id, "site": site_a.id, "vlan_id": 851,
            "name": "VLAN OK",
            "network": "10.61.0.0/29", "subnet": "255.255.255.248", "gateway": "10.61.0.1",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["customer"] == customer_a.id


def test_internal_user_can_still_create_vlan_for_any_customer(api_client, customer_status, site_status):
    """Gli utenti interni non sono vincolati dal tenant enforcement."""
    customer_a = make_customer(None, customer_status, "internalwritea")
    customer_b = make_customer(None, customer_status, "internalwriteb")
    site_b = make_site(None, customer_b, site_status, "internalwriteb")

    internal_user = make_internal_user()
    api_client.force_authenticate(user=internal_user)

    resp = api_client.post(
        "/api/vlans/",
        {
            "customer": customer_b.id, "site": site_b.id, "vlan_id": 852,
            "name": "VLAN da interno",
            "network": "10.62.0.0/29", "subnet": "255.255.255.248", "gateway": "10.62.0.1",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["customer"] == customer_b.id
