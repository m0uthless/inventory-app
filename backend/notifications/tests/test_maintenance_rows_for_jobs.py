"""I job (cron) leggono le scadenze di manutenzione senza passare dall'API.

Prima chiamavano la vista `todo` senza utente e ricevevano 401: nessuna notifica
in-app di manutenzione veniva creata e il riepilogo all'ufficio sarebbe stato vuoto.
"""
from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command

from core.app_settings import set_settings
from maintenance.tests.test_todo import setup  # noqa: F401  (fixture)
from notifications.maintenance_office import send_maintenance_office_digest
from notifications.models import Notification

pytestmark = pytest.mark.django_db


def test_refresh_creates_in_app_maintenance_notifications(setup):  # noqa: F811
    from core.models import InventoryType
    from maintenance.models import IntervalUnit, MaintenancePlan, ScheduleType

    soon = MaintenancePlan.objects.create(title="Backup", customer=setup["cust"], schedule_type=ScheduleType.INTERVAL,
                                          interval_unit=IntervalUnit.YEARS, interval_value=1, next_due_date=setup["today"] + timedelta(days=5))
    soon.inventory_types.set([InventoryType.objects.get(key="todo_srv")])
    get_user_model().objects.create_user(username="tecnico_job", password="pw", email="t@example.com")
    call_command("refresh_notifications")
    keys = set(Notification.objects.filter(notification_type="maintenance_due").values_list("source_key", flat=True))
    assert keys == {f"{soon.id}:{setup['s1'].id}", f"{soon.id}:{setup['s2'].id}"}
    assert mail.outbox == []  # agli utenti niente email di manutenzione (solo in-app)


def test_office_digest_sees_real_overdue_rows(setup):  # noqa: F811
    set_settings({"maintenance.office_emails": "manutenzione@biotron.it"})
    assert send_maintenance_office_digest(setup["today"]) == 1
    body = mail.outbox[0].alternatives[0][0]
    assert "SRV-1" in body and "SRV-2" in body
