"""Route matrix WP-03 (`archie-portalboundary`, audit 2026-08-19 —
SEC-002/VER-001 "Il Portal espone il namespace API interno senza una
barriera server-side centrale").

Sostituisce lo scheletro xfail di WP-01 (test_route_matrix_skeleton.py,
rimosso): i 3 endpoint con evidenza diretta (UserViewSet,
ServiceNowCaseViewSet, PurchaseOrderEntryViewSet) sono ora asserzioni vere,
più un campione rappresentativo degli altri moduli toccati dal fix
centrale (`IsInternalOrPortalDedicatedApp` in DEFAULT_PERMISSION_CLASSES):
Maintenance, Wiki, Drive, ServiceNow, Expenses, Attendance, CustomFields,
Admin — sia per i ViewSet senza permission_classes esplicite (protetti
automaticamente dal nuovo default) sia per quelli con permission_classes
esplicite già estese caso per caso (Drive, Expenses, ServiceNow,
Attendance, CustomFields, Admin).

Nota fixture: force_authenticate() da solo NON passa da login_view, quindi
la sessione non ha SESSION_AMBITO_KEY finché non lo impostiamo a mano —
stesso pattern già usato in vlan/tests/test_portal_scoping.py. Un utente
Portal "vero" (login reale) ha SEMPRE ambito="portal" in sessione (vedo
config/auth_views.py, fine di login_view).
"""
import uuid

import pytest
from django.contrib.auth import get_user_model

from crm.models import Customer

User = get_user_model()

pytestmark = pytest.mark.django_db


def _make_portal_user(customer: Customer) -> "User":
    from portal.models import PortalUserProfile

    user = User.objects.create_user(username=f"portal_{uuid.uuid4().hex[:6]}", password="pw")
    profile = PortalUserProfile.objects.create(user=user, customer=customer)
    profile.customers.add(customer)
    return user


def _set_portal_ambito(api_client):
    session = api_client.session
    session["ambito"] = "portal"
    session.save()
    api_client.cookies["sessionid"] = session.session_key


@pytest.fixture
def portal_client(api_client, customer_status):
    """APIClient autenticato come utente Portal "puro", con ambito di
    sessione esplicitamente "portal" (login reale simulato)."""
    customer = Customer.objects.create(name="RouteMatrixWP03", status=customer_status)
    user = _make_portal_user(customer)
    api_client.force_authenticate(user=user)
    _set_portal_ambito(api_client)
    return api_client


# ─── Categoria C: evidenza diretta SEC-002 (promossi da xfail a assert) ──────

def test_portal_user_cannot_list_internal_users(portal_client):
    resp = portal_client.get("/api/users/")
    assert resp.status_code in (403, 404)


def test_portal_user_cannot_list_servicenow_cases(portal_client):
    resp = portal_client.get("/api/servicenow-cases/")
    assert resp.status_code in (403, 404)


def test_portal_user_cannot_list_purchase_order_entries(portal_client):
    resp = portal_client.get("/api/purchase-order-entries/")
    assert resp.status_code in (403, 404)


# ─── Campione: ViewSet senza permission_classes esplicite, protetti solo ────
# ─── dal nuovo default IsInternalOrPortalDedicatedApp ───────────────────────

@pytest.mark.parametrize("path", [
    "/api/techs/",
    "/api/maintenance-plans/",
    "/api/maintenance-events/",
])
def test_portal_user_cannot_list_maintenance_endpoints(portal_client, path):
    resp = portal_client.get(path)
    assert resp.status_code in (403, 404), path


@pytest.mark.parametrize("path", [
    "/api/wiki-pages/",
    "/api/wiki-categories/",
    "/api/wiki-attachments/",
])
def test_portal_user_cannot_list_wiki_endpoints(portal_client, path):
    resp = portal_client.get(path)
    assert resp.status_code in (403, 404), path


def test_portal_user_cannot_list_issues(portal_client):
    resp = portal_client.get("/api/issues/")
    assert resp.status_code in (403, 404)


def test_portal_user_cannot_list_servicenow_case_types(portal_client):
    """Lookup di sola lettura, ma comunque interno: nessun senso esporlo
    al Portal, che non gestisce case ServiceNow."""
    resp = portal_client.get("/api/servicenow-case-types/")
    assert resp.status_code in (403, 404)


# ─── Campione: ViewSet con permission_classes esplicite estese caso per ─────
# ─── caso in questa stessa patch (Drive, Expenses, ServiceNow, Attendance, ──
# ─── CustomFields, Admin) ────────────────────────────────────────────────────

def test_portal_user_cannot_list_drive_folders(portal_client):
    resp = portal_client.get("/api/drive-folders/")
    assert resp.status_code in (403, 404)


def test_portal_user_cannot_list_expense_reports(portal_client):
    resp = portal_client.get("/api/expense-reports/")
    assert resp.status_code in (403, 404)


def test_portal_user_cannot_list_servicenow_technician_absences(portal_client):
    resp = portal_client.get("/api/servicenow-technician-absences/")
    assert resp.status_code in (403, 404)


def test_portal_user_cannot_list_absences(portal_client):
    resp = portal_client.get("/api/absences/")
    assert resp.status_code in (403, 404)


def test_portal_user_cannot_list_custom_field_definitions(portal_client):
    resp = portal_client.get("/api/custom-field-definitions/")
    assert resp.status_code in (403, 404)


def test_portal_user_cannot_list_admin_users(portal_client):
    resp = portal_client.get("/api/admin-users/")
    assert resp.status_code in (403, 404)


def test_portal_user_cannot_reach_permission_modules(portal_client):
    resp = portal_client.get("/api/admin/permission-modules/")
    assert resp.status_code in (403, 404)


# ─── Controllo negativo: lo staff interno resta invariato ───────────────────

def test_internal_user_with_permission_still_sees_maintenance(api_client, customer_status):
    """Garanzia di non-regressione: un utente interno con i permessi
    giusti (ambito diverso da "portal") deve continuare a vedere gli
    endpoint di categoria D esattamente come prima del fix."""
    from django.contrib.auth.models import Permission

    user = User.objects.create_user(username=f"internal_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(Permission.objects.get(codename="access_archie"))
    user.user_permissions.add(Permission.objects.get(codename="view_tech"))
    api_client.force_authenticate(user=user)
    # Nessun ambito impostato (comportamento storico invariato): deve passare.
    resp = api_client.get("/api/techs/")
    assert resp.status_code == 200
