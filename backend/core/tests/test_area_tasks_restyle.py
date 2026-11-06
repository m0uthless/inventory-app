"""Task di area (restyle): filtri delle viste, ricerca per colonna e riepilogo per gli indicatori."""
import uuid
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from attendance.models import LeaveArea
from core.models import AreaTask, UserProfile

pytestmark = pytest.mark.django_db
User = get_user_model()
URL = "/api/area-tasks/"


def _area(label):
    return LeaveArea.objects.create(key=f"a_{uuid.uuid4().hex[:6]}", label=label)


def _user(area, first="", last=""):
    u = User.objects.create_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw", first_name=first, last_name=last)
    p, _ = UserProfile.objects.get_or_create(user=u)
    p.leave_area = area
    p.save(update_fields=["leave_area"])
    return User.objects.get(pk=u.pk)


def _ids(c, qs):
    r = c.get(f"{URL}?include_hidden=1&{qs}")
    assert r.status_code == 200, r.data
    data = r.data["results"] if isinstance(r.data, dict) else r.data
    return {x["id"] for x in data}


def test_view_filters_and_column_search():
    area = _area("AVEC")
    me = _user(area, "Federico", "Mutuale")
    anna = _user(area, "Anna", "Rossi")
    today = timezone.localdate()
    late = AreaTask.objects.create(area=area, title="Rinnovare certificati TLS", due_date=today - timedelta(days=2), assigned_to=anna)
    mine = AreaTask.objects.create(area=area, title="Spazio disco", due_date=today, assigned_to=me, status=AreaTask.STATUS_IN_CORSO)
    free = AreaTask.objects.create(area=area, title="Piano ferie")
    done = AreaTask.objects.create(area=area, title="Switch rack", status=AreaTask.STATUS_COMPLETATO, completed_at=timezone.now(), due_date=today - timedelta(days=5))
    c = APIClient(); c.force_authenticate(me)

    assert _ids(c, "is_open=true") == {late.id, mine.id, free.id}
    assert _ids(c, "is_open=false") == {done.id}
    assert _ids(c, "overdue=true") == {late.id}  # il completato scaduto non conta
    assert _ids(c, "unassigned=true") == {free.id, done.id}
    assert _ids(c, "mine=true") == {mine.id}
    assert _ids(c, "title_q=certif") == {late.id}
    assert _ids(c, "assigned_q=ross") == {late.id}


def test_stats_per_area():
    area, other = _area("AVEC"), _area("Romagna")
    me = _user(area)
    today = timezone.localdate()
    AreaTask.objects.create(area=area, title="a", due_date=today - timedelta(days=1))
    AreaTask.objects.create(area=area, title="b", due_date=today, assigned_to=me, status=AreaTask.STATUS_IN_CORSO)
    AreaTask.objects.create(area=area, title="c", due_date=today + timedelta(days=3), status=AreaTask.STATUS_IN_ATTESA)
    AreaTask.objects.create(area=area, title="d", status=AreaTask.STATUS_COMPLETATO, completed_at=timezone.now())
    AreaTask.objects.create(area=area, title="e", status=AreaTask.STATUS_COMPLETATO, completed_at=timezone.now() - timedelta(days=10))
    AreaTask.objects.create(area=other, title="f")
    c = APIClient(); c.force_authenticate(me)

    s = c.get(f"{URL}stats/?area={area.id}").data
    assert (s["open"], s["overdue"], s["due_today"], s["due_week"]) == (3, 1, 1, 1)
    assert (s["mine"], s["mine_in_progress"], s["mine_waiting"]) == (1, 1, 0)
    assert s["unassigned"] == 2
    assert s["done_recent"] == 1  # quello chiuso 10 giorni fa non è più in elenco
    assert (s["da_fare"], s["in_corso"], s["in_attesa"]) == (1, 1, 1)
    assert len(s["trend"]) == 14 and s["trend"][-1]["count"] == 3

    assert c.get(f"{URL}stats/").data["open"] == 4  # senza area: tutte
