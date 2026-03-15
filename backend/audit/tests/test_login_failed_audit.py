import pytest

from audit.models import AuditEvent, AuthAttempt


@pytest.mark.django_db
def test_failed_login_creates_audit_event_for_existing_user(client, superuser):
    res = client.post(
        '/api/auth/login/',
        data='{"username":"admin","password":"wrong-password"}',
        content_type='application/json',
    )

    assert res.status_code == 401
    assert AuthAttempt.objects.filter(username='admin', success=False).count() == 1

    ev = AuditEvent.objects.get(action=AuditEvent.Action.LOGIN_FAILED)
    assert ev.actor is None
    assert ev.subject == 'admin'
    assert ev.content_type is not None
    assert ev.content_type.app_label == 'auth'
    assert ev.content_type.model == 'user'
    assert ev.object_id == str(superuser.id)


@pytest.mark.django_db
def test_failed_login_creates_system_audit_event_for_unknown_user(client):
    res = client.post(
        '/api/auth/login/',
        data='{"username":"ghost","password":"wrong-password"}',
        content_type='application/json',
    )

    assert res.status_code == 401
    assert AuthAttempt.objects.filter(username='ghost', success=False).count() == 1

    ev = AuditEvent.objects.get(action=AuditEvent.Action.LOGIN_FAILED)
    assert ev.actor is None
    assert ev.subject == 'ghost'
    assert ev.content_type is None
    assert ev.object_id == ''
