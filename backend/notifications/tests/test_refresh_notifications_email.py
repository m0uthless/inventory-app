"""Test suite: email digest inviata da `refresh_notifications`.

Copre la decisione "serve email?" (nuova notifica o event_date cambiata
rispetto a `last_emailed_event_date`) e l'aggregazione in un'unica email
digest per destinatario per run, sul percorso area_task_due (fixture più
leggera del percorso manutenzione, stessa logica di invio condivisa).
"""
from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.utils import timezone

from attendance.models import LeaveArea
from core.models import AreaTask, UserProfile
from notifications.models import Notification, NotificationType

pytestmark = pytest.mark.django_db

User = get_user_model()


def _user_in_area(area, *, email="tech@example.com"):
    user = User.objects.create_user(
        username=f"u_{uuid.uuid4().hex[:6]}", password="pw", email=email,
    )
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.leave_area = area
    profile.save(update_fields=["leave_area"])
    return user


def _area():
    return LeaveArea.objects.create(key=f"area_{uuid.uuid4().hex[:6]}", label="Area Test")


def _task(area, *, title="Task 1", due_date=None):
    return AreaTask.objects.create(
        area=area,
        title=title,
        due_date=due_date or timezone.localdate(),
        status=AreaTask.STATUS_DA_FARE,
    )


def test_new_notification_sends_digest_email():
    area = _area()
    user = _user_in_area(area)
    _task(area, title="Compila report")

    call_command("refresh_notifications")

    assert len(mail.outbox) == 1
    msg = mail.outbox[0]
    assert msg.to == [user.email]
    assert "Compila report" in msg.alternatives[0][0]

    notif = Notification.objects.get(recipient=user, notification_type=NotificationType.AREA_TASK_DUE)
    assert notif.last_emailed_event_date == notif.event_date


def test_unchanged_notification_does_not_resend_email():
    area = _area()
    user = _user_in_area(area)
    _task(area, title="Compila report")

    call_command("refresh_notifications")
    assert len(mail.outbox) == 1

    call_command("refresh_notifications")
    assert len(mail.outbox) == 1  # nessuna nuova email sullo stesso refresh invariato


def test_changed_event_date_resends_email():
    area = _area()
    user = _user_in_area(area)
    task = _task(area, title="Compila report", due_date=timezone.localdate())

    call_command("refresh_notifications")
    assert len(mail.outbox) == 1

    task.due_date = timezone.localdate() + timedelta(days=1)
    task.save(update_fields=["due_date"])

    call_command("refresh_notifications")
    assert len(mail.outbox) == 2


def test_no_email_when_recipient_has_no_email_address():
    area = _area()
    _user_in_area(area, email="")
    _task(area, title="Compila report")

    call_command("refresh_notifications")

    assert len(mail.outbox) == 0


def test_multiple_due_tasks_same_recipient_produce_single_digest_email():
    area = _area()
    user = _user_in_area(area)
    _task(area, title="Task A")
    _task(area, title="Task B")

    call_command("refresh_notifications")

    assert len(mail.outbox) == 1
    html_body = mail.outbox[0].alternatives[0][0]
    assert "Task A" in html_body
    assert "Task B" in html_body
