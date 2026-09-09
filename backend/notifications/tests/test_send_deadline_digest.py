"""Test suite: email giornaliera scadenze (send_deadline_digest).

Copre:
- Nessuna azione fuori dalla finestra oraria (8:00 locali).
- Nessuna azione se già eseguito oggi (ScheduledJobRun).
- Nessuna email per un utente senza scadenze nei prossimi 3 giorni.
- Email con task di area (della sua area) e issue assegnate, entrambe nella
  stessa digest.
- Scadenze oltre 3 giorni o già passate non incluse.
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.utils import timezone

from attendance.models import LeaveArea
from core.models import AreaTask, ScheduledJobRun, UserProfile
from crm.models import Customer, CustomerStatus
from issues.models import Issue

pytestmark = pytest.mark.django_db

User = get_user_model()


def _user_in_area(area, *, email="tech@example.com"):
    user = User.objects.create_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw", email=email)
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.leave_area = area
    profile.save(update_fields=["leave_area"])
    return user


def _area():
    return LeaveArea.objects.create(key=f"area_{uuid.uuid4().hex[:6]}", label="Area Test")


def _customer():
    status = CustomerStatus.objects.get_or_create(
        key=f"active_digest_{uuid.uuid4().hex[:6]}", defaults={"label": "Active"}
    )[0]
    return Customer.objects.create(name="Cliente Test", status=status)


def _run_at(hour):
    """Esegue il comando con l'ora locale forzata a `hour`."""
    fake_now = timezone.localtime().replace(hour=hour, minute=0, second=0, microsecond=0)
    with patch("notifications.management.commands.send_deadline_digest.timezone.localtime", return_value=fake_now):
        call_command("send_deadline_digest")


def test_outside_time_window_does_nothing():
    area = _area()
    _user_in_area(area)
    AreaTask.objects.create(area=area, title="Task", due_date=timezone.localdate())

    _run_at(10)

    assert len(mail.outbox) == 0
    assert not ScheduledJobRun.objects.filter(job_name="send_deadline_digest").exists()


def test_already_ran_today_does_nothing():
    ScheduledJobRun.objects.create(job_name="send_deadline_digest", last_run_date=timezone.localdate())
    area = _area()
    _user_in_area(area)
    AreaTask.objects.create(area=area, title="Task", due_date=timezone.localdate())

    _run_at(8)

    assert len(mail.outbox) == 0


def test_user_with_no_deadlines_gets_no_email():
    area = _area()
    _user_in_area(area)

    _run_at(8)

    assert len(mail.outbox) == 0
    assert ScheduledJobRun.objects.get(job_name="send_deadline_digest").last_run_date == timezone.localdate()


def test_area_task_and_issue_both_included_in_single_email():
    area = _area()
    user = _user_in_area(area)
    author = _user_in_area(area, email="author@example.com")
    customer = _customer()
    today = timezone.localdate()

    AreaTask.objects.create(area=area, title="Rifornire magazzino", due_date=today + timedelta(days=1))
    Issue.objects.create(
        title="Server lento", customer=customer, created_by=author, assigned_to=user,
        due_date=today + timedelta(days=2),
    )

    _run_at(8)

    to_user = [m for m in mail.outbox if m.to == [user.email]]
    assert len(to_user) == 1
    html_body = to_user[0].alternatives[0][0]
    assert "Rifornire magazzino" in html_body
    assert "Server lento" in html_body


def test_deadlines_outside_3_day_window_are_excluded():
    area = _area()
    user = _user_in_area(area)
    today = timezone.localdate()

    AreaTask.objects.create(area=area, title="Troppo lontano", due_date=today + timedelta(days=10))
    AreaTask.objects.create(area=area, title="Già passato", due_date=today - timedelta(days=1))

    _run_at(8)

    assert len(mail.outbox) == 0
