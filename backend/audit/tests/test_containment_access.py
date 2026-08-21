"""Test di regressione per il contenimento 0.9.1 di SEC-001/SEC-002
(audit indipendente 2026-08-19): prima di questa patch, AuditEventViewSet
non dichiarava permission_classes proprie ed ereditava il default globale
IsAuthenticatedDjangoModelPermissions, che per GET/HEAD non richiede alcun
permesso Django — bastava essere autenticati, incluso un utente Portal con
privilegi minimi o un utente "duale" loggato dal frontend Portal
(ambito="portal").

Questi test riproducono lo scenario del finding (deve fallire PRIMA del fix,
diventare verde DOPO) e coprono la matrice minima richiesta:
- utente Portal puro → negato;
- utente interno senza permesso audit.view_auditevent → negato;
- utente interno CON il permesso ma in ambito "portal" di sessione → negato;
- utente interno con permesso e ambito normale/assente → consentito;
- superuser → sempre consentito (override di sistema, stessa semantica di
  _bypasses_portal_scope).

Non copre ancora la sanitizzazione del contenuto (masking password VPN nel
diff), che resta un intervento separato lato log_event/crm.api (SEC-001
completo, fuori scope di questa patch di contenimento).
"""
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission

from audit.models import AuditEvent
from audit.utils import log_event
from crm.models import Customer

User = get_user_model()

pytestmark = pytest.mark.django_db


def _make_internal_user(*, with_audit_perm: bool) -> "User":
    user = User.objects.create_user(username=f"internal_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(Permission.objects.get(codename="access_archie"))
    if with_audit_perm:
        user.user_permissions.add(Permission.objects.get(codename="view_auditevent"))
    return user


def _make_portal_user(customer: Customer) -> "User":
    from portal.models import PortalUserProfile

    user = User.objects.create_user(username=f"portal_{uuid.uuid4().hex[:6]}", password="pw")
    profile = PortalUserProfile.objects.create(user=user, customer=customer)
    profile.customers.add(customer)
    return user


def _set_session_ambito(api_client, ambito: str | None):
    session = api_client.session
    if ambito is None:
        session.pop("ambito", None)
    else:
        session["ambito"] = ambito
    session.save()
    api_client.cookies["sessionid"] = session.session_key


def _seed_event(actor, customer):
    log_event(
        actor=actor,
        action=AuditEvent.Action.UPDATE,
        instance=customer,
        changes={"name": {"from": "A", "to": "B"}},
        subject=str(customer),
    )


def test_portal_user_cannot_read_audit_events(api_client, customer_status):
    customer = Customer.objects.create(name="AuditContain1", status=customer_status)
    portal_user = _make_portal_user(customer)
    _seed_event(portal_user, customer)

    api_client.force_authenticate(user=portal_user)
    resp = api_client.get("/api/audit-events/")

    assert resp.status_code in (403, 404)


def test_internal_user_without_audit_permission_is_denied(api_client, customer_status):
    customer = Customer.objects.create(name="AuditContain2", status=customer_status)
    internal_user = _make_internal_user(with_audit_perm=False)
    _seed_event(internal_user, customer)

    api_client.force_authenticate(user=internal_user)
    resp = api_client.get("/api/audit-events/")

    assert resp.status_code in (403, 404)


def test_dual_profile_user_in_portal_ambito_is_denied_even_with_permission(api_client, customer_status):
    """Caso VER-001: un utente "duale" con audit.view_auditevent MA loggato
    dal frontend Portal (ambito="portal" in sessione) non deve poter leggere
    l'audit interno nella stessa sessione."""
    customer = Customer.objects.create(name="AuditContain3", status=customer_status)
    dual_user = _make_internal_user(with_audit_perm=True)
    _seed_event(dual_user, customer)

    api_client.force_authenticate(user=dual_user)
    _set_session_ambito(api_client, "portal")

    resp = api_client.get("/api/audit-events/")
    assert resp.status_code in (403, 404)

    # Stesso utente, stesso permesso, ma ambito "site-repo" (Archie
    # principale): torna ad essere consentito.
    _set_session_ambito(api_client, "site-repo")
    resp2 = api_client.get("/api/audit-events/")
    assert resp2.status_code == 200


def test_internal_user_with_permission_and_no_ambito_is_allowed(api_client, customer_status):
    """Sessioni precedenti a questa modifica, senza SESSION_AMBITO_KEY:
    comportamento invariato, non devono rompersi."""
    customer = Customer.objects.create(name="AuditContain4", status=customer_status)
    internal_user = _make_internal_user(with_audit_perm=True)
    _seed_event(internal_user, customer)

    api_client.force_authenticate(user=internal_user)
    _set_session_ambito(api_client, None)

    resp = api_client.get("/api/audit-events/")
    assert resp.status_code == 200


def test_superuser_always_allowed_regardless_of_ambito(api_client, superuser, customer_status):
    customer = Customer.objects.create(name="AuditContain5", status=customer_status)
    _seed_event(superuser, customer)

    api_client.force_authenticate(user=superuser)
    _set_session_ambito(api_client, "portal")

    resp = api_client.get("/api/audit-events/")
    assert resp.status_code == 200
