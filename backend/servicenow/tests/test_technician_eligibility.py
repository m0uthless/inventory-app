"""B-22 (QA 2026-11-15): solo i tecnici interni sono assegnabili e ricevono
le email delle issue; i clienti del Portal mai, anche con il flag."""
from __future__ import annotations

from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import UserProfile
from core.technicians import eligible_technician_q, is_eligible_technician
from core.testing import grant_via_group, make_archie_user

pytestmark = pytest.mark.django_db

User = get_user_model()


def _flag(user, **profile):
    """Tecnico = permesso `servicenow.be_technician` dato da un gruppo, più
    gli eventuali flag di profilo (Philips, account funzionale)."""
    prof, _ = UserProfile.objects.get_or_create(user=user)
    for k, v in profile.items():
        setattr(prof, k, v)
    prof.save()
    grant_via_group(user, "servicenow.be_technician")
    return user


@pytest.fixture
def portal_customer_user(customer_status):
    """Cliente Portal a cui qualcuno ha lasciato il flag tecnico (come i dati del QA)."""
    from crm.models import Customer
    from portal.models import PortalUserProfile

    user = User.objects.create_user(username="cliente", password="pw", email="cliente@example.com")
    customer = Customer.objects.create(name="Cliente", status=customer_status)
    pp = PortalUserProfile.objects.create(user=user, customer=customer)
    pp.customers.set([customer])
    return _flag(user)


def test_archie_user_without_permission_is_not_technician():
    user = make_archie_user(username="nuovo", password="pw")
    assert is_eligible_technician(user) is False
    assert not User.objects.filter(eligible_technician_q(), pk=user.pk).exists()


def test_group_permission_makes_technician():
    user = _flag(make_archie_user(username="tec", password="pw"))
    assert is_eligible_technician(user) is True
    assert User.objects.filter(eligible_technician_q(), pk=user.pk).exists()


def test_superuser_without_group_is_not_technician():
    su = User.objects.create_superuser(username="root2", password="pw", email="r@example.com")
    assert is_eligible_technician(su) is False
    assert not User.objects.filter(eligible_technician_q(), pk=su.pk).exists()


def test_inactive_user_with_permission_is_not_technician():
    user = _flag(make_archie_user(username="spento", password="pw"))
    user.is_active = False
    user.save(update_fields=["is_active"])
    assert is_eligible_technician(user) is False


def test_assignee_permission_does_not_make_technician():
    user = make_archie_user(username="assegnatario", password="pw")
    grant_via_group(user, "issues.be_assignee")
    assert is_eligible_technician(user) is False


def test_portal_user_is_not_listed_nor_assignable(superuser, portal_customer_user):
    tech = _flag(make_archie_user(username="tecnico", password="pw"))
    philips = _flag(User.objects.create_user(username="philips", password="pw"), is_philips=True)
    c = APIClient()
    c.force_authenticate(superuser)

    listed = {row["id"] for row in c.get("/api/servicenow-technician-absences/technicians/").json()}
    assert tech.pk in listed
    assert philips.pk in listed
    assert portal_customer_user.pk not in listed

    body = c.get("/api/users/").json()
    users = {row["id"]: row for row in (body["results"] if isinstance(body, dict) else body)}
    assert users[tech.pk]["is_servicenow_technician"] is True
    assert users[portal_customer_user.pk]["is_servicenow_technician"] is False


def test_case_cannot_be_assigned_to_portal_user(superuser, portal_customer_user):
    from servicenow.models import ServiceNowCase, ServiceNowCaseCategory
    from servicenow.tests.test_case_api import _make_case_type

    case = ServiceNowCase.objects.create(
        number="CS0000001", account="ACME", priority="3", category=ServiceNowCaseCategory.BIOTRON,
        case_type=_make_case_type(), opened_date="2026-01-10", opened_time="09:00",
    )
    c = APIClient()
    c.force_authenticate(superuser)

    resp = c.patch(f"/api/servicenow-cases/{case.pk}/", {"assigned_to": portal_customer_user.pk}, format="json")

    assert resp.status_code == 400
    assert "assigned_to" in resp.json()


def test_issue_created_email_skips_portal_users(portal_customer_user):
    from issues import api as issues_api

    tech = grant_via_group(make_archie_user(username="tecnico2", password="pw", email="tecnico@example.com"), "issues.be_assignee")
    grant_via_group(portal_customer_user, "issues.be_assignee")
    issue = mock.Mock(title="T", description="", get_priority_display=lambda: "Alta")
    with mock.patch.object(issues_api, "send_templated_email", return_value=(True, None)) as send, \
            mock.patch.object(issues_api, "_issue_customer_display", return_value="Cliente"):
        issues_api.notify_issue_created(tech, issue)

    sent_to = {addr for call in send.call_args_list for addr in call.kwargs["recipient_list"]}
    assert "tecnico@example.com" in sent_to
    assert "cliente@example.com" not in sent_to
