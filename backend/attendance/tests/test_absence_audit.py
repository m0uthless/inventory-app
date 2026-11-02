"""Audit sulla validazione/rifiuto di una singola richiesta di assenza.

Il percorso di gruppo (validate-group/reject-group) registrava già un
AuditEvent per riga; quello singolo (validate/reject) inviava l'email
all'esito ma non lasciava traccia nell'audit.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType

from attendance.models import Absence, AbsenceReason, AbsenceStatus, DayPart
from audit.models import AuditEvent

pytestmark = pytest.mark.django_db

User = get_user_model()
URL = "/api/absences/"


def _make_user(*, coordinator=False):
    u = User.objects.create_user(
        username=f"u-{uuid.uuid4().hex[:8]}", password="pw", email=f"{uuid.uuid4().hex[:6]}@example.com",
    )
    prof = u.profile
    prof.is_leave_coordinator = coordinator
    prof.save()
    return u


def _proposal(user):
    return Absence.objects.create(
        user=user, date="2026-11-20", day_part=DayPart.MATTINA,
        reason=AbsenceReason.FERIE, status=AbsenceStatus.PROPOSTA,
    )


def _audit_events_for(obj):
    ct = ContentType.objects.get_for_model(Absence)
    return AuditEvent.objects.filter(content_type=ct, object_id=str(obj.pk), action="update")


@pytest.mark.parametrize("path, expected", [
    ("validate", AbsenceStatus.VALIDATA),
    ("reject", AbsenceStatus.RIFIUTATA),
])
def test_single_resolution_is_audited_with_status_change(api_client, path, expected):
    coord = _make_user(coordinator=True)
    absence = _proposal(_make_user())
    api_client.force_authenticate(user=coord)

    resp = api_client.post(f"{URL}{absence.id}/{path}/", {}, format="json")
    assert resp.status_code == 200, resp.data

    events = list(_audit_events_for(absence))
    assert len(events) == 1
    assert events[0].actor_id == coord.id
    assert events[0].changes == {"status": {"from": AbsenceStatus.PROPOSTA, "to": expected}}
