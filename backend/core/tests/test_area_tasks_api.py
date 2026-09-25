import uuid
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from attendance.models import LeaveArea
from core.models import AreaTask, AreaTaskComment, UserProfile

pytestmark = pytest.mark.django_db

User = get_user_model()
URL = "/api/area-tasks/"


def _area(label="Area"):
    return LeaveArea.objects.create(key=f"area_{uuid.uuid4().hex[:6]}", label=label)


def _user(area=None, *, superuser=False, username=None):
    username = username or f"u_{uuid.uuid4().hex[:6]}"
    if superuser:
        user = User.objects.create_superuser(username=username, password="pw", email=f"{username}@example.com")
    else:
        user = User.objects.create_user(username=username, password="pw", email=f"{username}@example.com")
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.leave_area = area
    profile.save(update_fields=["leave_area"])
    return User.objects.get(pk=user.pk)  # rilegge: evita la cache stale di user.profile


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _results(resp):
    data = resp.data
    return data["results"] if isinstance(data, dict) and "results" in data else data


def _ids(resp):
    return {row["id"] for row in _results(resp)}


# ── caratterizzazione del comportamento esistente ─────────────────────────────

def test_user_creates_task_in_own_area_regardless_of_payload():
    mine, other = _area("Mia"), _area("Altra")
    user = _user(mine)
    resp = _client(user).post(URL, {"title": "T", "area": other.id}, format="json")
    assert resp.status_code == 201, resp.data
    task = AreaTask.objects.get(pk=resp.data["id"])
    assert task.area_id == mine.id
    assert task.created_by_id == user.id


def test_user_without_area_cannot_create():
    user = _user(None)
    resp = _client(user).post(URL, {"title": "T"}, format="json")
    assert resp.status_code == 403


def test_superuser_can_create_in_chosen_area():
    area = _area()
    resp = _client(_user(None, superuser=True)).post(URL, {"title": "T", "area": area.id}, format="json")
    assert resp.status_code == 201, resp.data
    assert AreaTask.objects.get(pk=resp.data["id"]).area_id == area.id


def test_cannot_update_or_delete_task_of_other_area_but_can_read_it():
    mine, other = _area(), _area()
    task = AreaTask.objects.create(area=other, title="Altrui")
    client = _client(_user(mine))
    assert task.id in _ids(client.get(URL))
    assert client.patch(f"{URL}{task.id}/", {"title": "X"}, format="json").status_code == 403
    assert client.delete(f"{URL}{task.id}/").status_code == 403


def test_completing_sets_completed_at_and_reopening_clears_it():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T")
    client = _client(_user(area))
    client.patch(f"{URL}{task.id}/", {"status": "completato"}, format="json")
    task.refresh_from_db()
    assert task.completed_at is not None
    client.patch(f"{URL}{task.id}/", {"status": "da_fare"}, format="json")
    task.refresh_from_db()
    assert task.completed_at is None


def test_completed_tasks_older_than_3_days_hidden_from_list_unless_include_hidden():
    area = _area()
    old = AreaTask.objects.create(area=area, title="Vecchio", status="completato",
                                  completed_at=timezone.now() - timedelta(days=4))
    recent = AreaTask.objects.create(area=area, title="Recente", status="completato",
                                     completed_at=timezone.now() - timedelta(days=1))
    client = _client(_user(area))
    assert old.id not in _ids(client.get(URL))
    assert recent.id in _ids(client.get(URL))
    assert old.id in _ids(client.get(URL, {"include_hidden": "1"}))


def test_delete_is_soft_and_task_leaves_the_list():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T")
    client = _client(_user(area))
    assert client.delete(f"{URL}{task.id}/").status_code == 204
    task.refresh_from_db()
    assert task.deleted_at is not None
    assert task.id not in _ids(client.get(URL))


def test_due_returns_only_own_area_open_tasks_due_by_tomorrow():
    mine, other = _area(), _area()
    today = timezone.localdate()
    due = AreaTask.objects.create(area=mine, title="Scade", due_date=today)
    waiting = AreaTask.objects.create(area=mine, title="In attesa", due_date=today, status="in_attesa")
    AreaTask.objects.create(area=mine, title="Fatto", due_date=today, status="completato")
    AreaTask.objects.create(area=other, title="Altra area", due_date=today)
    AreaTask.objects.create(area=mine, title="Lontano", due_date=today + timedelta(days=10))
    resp = _client(_user(mine)).get(f"{URL}due/")
    assert {row["id"] for row in resp.data} == {due.id, waiting.id}


# ── nuovi: restore, trash, filtri, ricerca ────────────────────────────────────

def _grant_change(user):
    user.user_permissions.add(Permission.objects.get(codename="change_areatask"))


def test_restore_requires_change_permission_and_own_area():
    mine, other = _area(), _area()
    task = AreaTask.objects.create(area=mine, title="T")
    task.soft_delete()
    url = f"{URL}{task.id}/restore/"

    no_perm = _user(mine)
    assert _client(no_perm).post(url).status_code == 403

    wrong_area = _user(other)
    _grant_change(wrong_area)
    assert _client(wrong_area).post(url).status_code == 403

    ok = _user(mine)
    _grant_change(ok)
    assert _client(ok).post(url).status_code == 204
    task.refresh_from_db()
    assert task.deleted_at is None
    assert task.updated_by_id == ok.id


def test_restore_works_for_completed_task_older_than_3_days():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T", status="completato",
                                   completed_at=timezone.now() - timedelta(days=10))
    task.soft_delete()
    user = _user(area)
    _grant_change(user)
    assert _client(user).post(f"{URL}{task.id}/restore/").status_code == 204


def test_bulk_restore_only_restores_own_area():
    mine, other = _area(), _area()
    a = AreaTask.objects.create(area=mine, title="A")
    b = AreaTask.objects.create(area=other, title="B")
    a.soft_delete()
    b.soft_delete()
    user = _user(mine)
    _grant_change(user)
    resp = _client(user).post(f"{URL}bulk_restore/", {"ids": [a.id, b.id]}, format="json")
    assert resp.status_code == 200
    assert resp.data["restored"] == [a.id]
    b.refresh_from_db()
    assert b.deleted_at is not None


def test_only_deleted_lists_trash_and_include_deleted_lists_both():
    area = _area()
    live = AreaTask.objects.create(area=area, title="Live")
    gone = AreaTask.objects.create(area=area, title="Gone")
    gone.soft_delete()
    client = _client(_user(area))
    assert _ids(client.get(URL, {"only_deleted": "1"})) == {gone.id}
    assert _ids(client.get(URL, {"include_deleted": "1"})) == {live.id, gone.id}


def test_filters_status_priority_assignee_area_due_and_mine():
    a1, a2 = _area(), _area()
    me = _user(a1)
    colleague = _user(a1)
    today = timezone.localdate()
    t1 = AreaTask.objects.create(area=a1, title="t1", status="in_corso", priority="high",
                                 assigned_to=me, due_date=today)
    t2 = AreaTask.objects.create(area=a1, title="t2", status="da_fare", priority="low",
                                 assigned_to=colleague, due_date=today + timedelta(days=5))
    t3 = AreaTask.objects.create(area=a2, title="t3", status="in_attesa", priority="high")
    client = _client(me)

    assert _ids(client.get(URL, {"status": "in_corso"})) == {t1.id}
    assert _ids(client.get(URL, {"status": ["da_fare", "in_attesa"]})) == {t2.id, t3.id}
    assert _ids(client.get(URL, {"priority": "high"})) == {t1.id, t3.id}
    assert _ids(client.get(URL, {"assigned_to": colleague.id})) == {t2.id}
    assert _ids(client.get(URL, {"area": a2.id})) == {t3.id}
    assert _ids(client.get(URL, {"due_before": str(today)})) == {t1.id}
    assert _ids(client.get(URL, {"due_after": str(today + timedelta(days=1))})) == {t2.id}
    assert _ids(client.get(URL, {"mine": "true"})) == {t1.id}


def test_search_matches_title_and_description():
    area = _area()
    a = AreaTask.objects.create(area=area, title="Ordine toner", description="")
    b = AreaTask.objects.create(area=area, title="Altro", description="chiamare il fornitore")
    client = _client(_user(area))
    assert _ids(client.get(URL, {"search": "toner"})) == {a.id}
    assert _ids(client.get(URL, {"search": "fornitore"})) == {b.id}


# ── assegnatario e priorità ───────────────────────────────────────────────────

def test_create_with_priority_and_assignee_from_same_area():
    area = _area()
    creator = _user(area)
    assignee = _user(area, username="mario")
    resp = _client(creator).post(
        URL, {"title": "T", "priority": "high", "assigned_to": assignee.id}, format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["priority"] == "high"
    assert resp.data["assigned_to"] == assignee.id
    assert resp.data["assigned_to_name"] == "mario"
    assert resp.data["comments_count"] == 0


def test_priority_defaults_to_medium_and_rejects_unknown_values():
    area = _area()
    client = _client(_user(area))
    assert client.post(URL, {"title": "T"}, format="json").data["priority"] == "medium"
    assert client.post(URL, {"title": "T", "priority": "urgentissima"}, format="json").status_code == 400


def test_assignee_from_other_area_rejected_on_create_and_update():
    mine, other = _area(), _area()
    outsider = _user(other)
    client = _client(_user(mine))
    resp = client.post(URL, {"title": "T", "assigned_to": outsider.id}, format="json")
    assert resp.status_code == 400
    assert "assigned_to" in resp.data

    task = AreaTask.objects.create(area=mine, title="T")
    resp = client.patch(f"{URL}{task.id}/", {"assigned_to": outsider.id}, format="json")
    assert resp.status_code == 400


def test_assignee_without_area_or_inactive_rejected():
    area = _area()
    client = _client(_user(area))
    no_area = _user(None)
    assert client.post(URL, {"title": "T", "assigned_to": no_area.id}, format="json").status_code == 400
    inactive = _user(area)
    inactive.is_active = False
    inactive.save(update_fields=["is_active"])
    assert client.post(URL, {"title": "T", "assigned_to": inactive.id}, format="json").status_code == 400


def test_assignee_can_be_cleared_with_null():
    area = _area()
    assignee = _user(area)
    task = AreaTask.objects.create(area=area, title="T", assigned_to=assignee)
    resp = _client(_user(area)).patch(f"{URL}{task.id}/", {"assigned_to": None}, format="json")
    assert resp.status_code == 200
    task.refresh_from_db()
    assert task.assigned_to is None


def test_superuser_may_assign_to_user_of_other_area_when_creating_in_chosen_area():
    a1, a2 = _area(), _area()
    outsider = _user(a2)
    resp = _client(_user(None, superuser=True)).post(
        URL, {"title": "T", "area": a1.id, "assigned_to": outsider.id}, format="json",
    )
    assert resp.status_code == 201, resp.data


def test_status_in_attesa_accepted_and_does_not_set_completed_at():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T")
    resp = _client(_user(area)).patch(f"{URL}{task.id}/", {"status": "in_attesa"}, format="json")
    assert resp.status_code == 200
    task.refresh_from_db()
    assert task.status == "in_attesa"
    assert task.completed_at is None


# ── ordinamento di default e comments_count ───────────────────────────────────

def test_default_list_order_is_status_due_date_newest_first():
    area = _area()
    today = timezone.localdate()
    d1, d2 = today + timedelta(days=1), today + timedelta(days=5)
    mk = lambda title, st, due: AreaTask.objects.create(area=area, title=title, status=st, due_date=due)
    a = mk("a", "in_attesa", d1)
    b = mk("b", "da_fare", d2)
    c = mk("c", "da_fare", d1)   # stesso stato e scadenza di d: c piu' vecchio
    d = mk("d", "da_fare", d1)
    e = mk("e", "da_fare", None)
    resp = _client(_user(area)).get(URL)
    assert resp.status_code == 200
    assert [r["id"] for r in _results(resp)] == [d.id, c.id, b.id, e.id, a.id]


def test_comments_count_on_list_and_retrieve():
    area = _area()
    user = _user(area)
    task = AreaTask.objects.create(area=area, title="T")
    AreaTaskComment.objects.create(task=task, author=user, body="ciao")
    client = _client(user)
    assert _results(client.get(URL))[0]["comments_count"] == 1
    assert client.get(f"{URL}{task.id}/").data["comments_count"] == 1


# ── commenti ──────────────────────────────────────────────────────────────────

def test_comment_create_list_and_count():
    area = _area()
    author = _user(area, username="anna")
    task = AreaTask.objects.create(area=area, title="T")
    client = _client(author)

    resp = client.post(f"{URL}{task.id}/comments/", {"body": "Fatto il primo passo"}, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["author"] == author.id
    assert resp.data["author_name"] == "anna"

    listing = client.get(f"{URL}{task.id}/comments/")
    assert [c["body"] for c in listing.data] == ["Fatto il primo passo"]
    assert client.get(f"{URL}{task.id}/").data["comments_count"] == 1


def test_comment_body_required():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T")
    assert _client(_user(area)).post(f"{URL}{task.id}/comments/", {"body": ""}, format="json").status_code == 400


def test_other_area_can_read_comments_but_not_post():
    mine, other = _area(), _area()
    task = AreaTask.objects.create(area=other, title="T")
    client = _client(_user(mine))
    assert client.get(f"{URL}{task.id}/comments/").status_code == 200
    assert client.post(f"{URL}{task.id}/comments/", {"body": "x"}, format="json").status_code == 403


def test_comment_edit_and_delete_only_by_author_or_superuser():
    area = _area()
    author = _user(area)
    colleague = _user(area)
    task = AreaTask.objects.create(area=area, title="T")
    comment = AreaTaskComment.objects.create(task=task, author=author, body="originale")
    url = f"{URL}{task.id}/comments/{comment.id}/"

    assert _client(colleague).patch(url, {"body": "x"}, format="json").status_code == 403
    assert _client(colleague).delete(url).status_code == 403

    assert _client(author).patch(url, {"body": "corretto"}, format="json").status_code == 200
    comment.refresh_from_db()
    assert comment.body == "corretto"

    assert _client(_user(None, superuser=True)).delete(url).status_code == 204
    assert not AreaTaskComment.objects.filter(pk=comment.pk).exists()


def test_comment_of_another_task_is_404():
    area = _area()
    author = _user(area)
    t1 = AreaTask.objects.create(area=area, title="1")
    t2 = AreaTask.objects.create(area=area, title="2")
    comment = AreaTaskComment.objects.create(task=t1, author=author, body="x")
    assert _client(author).patch(f"{URL}{t2.id}/comments/{comment.id}/", {"body": "y"}, format="json").status_code == 404


def test_adding_comment_writes_audit_event():
    from audit.models import AuditEvent

    area = _area()
    author = _user(area)
    task = AreaTask.objects.create(area=area, title="T")
    before = AuditEvent.objects.count()
    _client(author).post(f"{URL}{task.id}/comments/", {"body": "nota"}, format="json")
    assert AuditEvent.objects.count() == before + 1


# ── allegati Drive ────────────────────────────────────────────────────────────

from django.contrib.auth.models import Group  # noqa: E402
from django.core.files.uploadedfile import SimpleUploadedFile  # noqa: E402

from drive.models import DriveFile  # noqa: E402


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)


def _drive_file(name="a.pdf", *, group=None):
    f = DriveFile.objects.create(name=name, file=SimpleUploadedFile(name, b"x"))
    if group is not None:
        f.allowed_groups.add(group)
    return f


def _in_group(user, group):
    user.groups.add(group)
    return user


def test_link_accessible_files_and_read_detail():
    area = _area()
    f = _drive_file("verbale.pdf")
    resp = _client(_user(area)).post(URL, {"title": "T", "drive_files": [f.id]}, format="json")
    assert resp.status_code == 201, resp.data
    detail = resp.data["drive_files_detail"]
    assert [d["id"] for d in detail] == [f.id]
    assert detail[0]["name"] == "verbale.pdf"
    assert set(detail[0]) == {"id", "name", "mime_type", "size", "folder"}


def test_cannot_link_file_without_access():
    area = _area()
    group = Group.objects.create(name="riservato")
    secret = _drive_file("segreto.pdf", group=group)
    client = _client(_user(area))
    resp = client.post(URL, {"title": "T", "drive_files": [secret.id]}, format="json")
    assert resp.status_code == 400
    assert "drive_files" in resp.data
    assert AreaTask.objects.count() == 0


def test_cannot_link_missing_or_soft_deleted_file():
    area = _area()
    gone = _drive_file("gone.pdf")
    gone.soft_delete()
    client = _client(_user(area))
    assert client.post(URL, {"title": "T", "drive_files": [gone.id]}, format="json").status_code == 400
    assert client.post(URL, {"title": "T", "drive_files": [999999]}, format="json").status_code == 400


def test_restricted_file_is_hidden_from_users_without_access():
    area = _area()
    group = Group.objects.create(name="riservato")
    secret = _drive_file("segreto.pdf", group=group)
    public = _drive_file("pubblico.pdf")
    task = AreaTask.objects.create(area=area, title="T")
    task.drive_files.add(secret, public)

    allowed = _in_group(_user(area), group)
    outsider = _user(area)

    seen_by_allowed = _client(allowed).get(f"{URL}{task.id}/").data["drive_files_detail"]
    seen_by_outsider = _client(outsider).get(f"{URL}{task.id}/").data["drive_files_detail"]
    assert {d["id"] for d in seen_by_allowed} == {secret.id, public.id}
    assert {d["id"] for d in seen_by_outsider} == {public.id}
    # anche nella lista, senza rivelare l'esistenza del file riservato
    row = next(r for r in _results(_client(outsider).get(URL)) if r["id"] == task.id)
    assert {d["id"] for d in row["drive_files_detail"]} == {public.id}
    assert "segreto" not in str(row)
    assert "drive_files" not in row
    assert secret.id not in [d["id"] for d in row["drive_files_detail"]]
    retrieve = _client(outsider).get(f"{URL}{task.id}/")
    assert "drive_files" not in retrieve.data
    assert secret.id not in [d["id"] for d in retrieve.data["drive_files_detail"]]


def test_soft_deleted_drive_file_disappears_and_reappears_on_restore():
    area = _area()
    f = _drive_file("a.pdf")
    task = AreaTask.objects.create(area=area, title="T")
    task.drive_files.add(f)
    client = _client(_user(area))

    f.soft_delete()
    assert client.get(f"{URL}{task.id}/").data["drive_files_detail"] == []
    f.deleted_at = None
    f.save(update_fields=["deleted_at"])
    assert [d["id"] for d in client.get(f"{URL}{task.id}/").data["drive_files_detail"]] == [f.id]


def test_update_replaces_visible_links_but_preserves_hidden_ones():
    area = _area()
    group = Group.objects.create(name="riservato")
    secret = _drive_file("segreto.pdf", group=group)
    old_public = _drive_file("vecchio.pdf")
    new_public = _drive_file("nuovo.pdf")
    trashed = _drive_file("cestino.pdf")
    task = AreaTask.objects.create(area=area, title="T")
    task.drive_files.add(secret, old_public, trashed)
    trashed.soft_delete()

    outsider = _user(area)
    resp = _client(outsider).patch(f"{URL}{task.id}/", {"drive_files": [new_public.id]}, format="json")
    assert resp.status_code == 200, resp.data
    assert set(task.drive_files.values_list("pk", flat=True)) == {secret.id, trashed.id, new_public.id}
    assert [d["id"] for d in resp.data["drive_files_detail"]] == [new_public.id]


def test_update_without_drive_files_key_leaves_links_untouched_and_empty_list_clears_visible():
    area = _area()
    f = _drive_file("a.pdf")
    task = AreaTask.objects.create(area=area, title="T")
    task.drive_files.add(f)
    client = _client(_user(area))

    client.patch(f"{URL}{task.id}/", {"title": "Nuovo titolo"}, format="json")
    assert task.drive_files.count() == 1
    client.patch(f"{URL}{task.id}/", {"drive_files": []}, format="json")
    assert task.drive_files.count() == 0


def test_link_and_unlink_are_audited():
    from audit.models import AuditEvent

    area = _area()
    f = _drive_file("a.pdf")
    task = AreaTask.objects.create(area=area, title="T")
    client = _client(_user(area))

    before = AuditEvent.objects.count()
    client.patch(f"{URL}{task.id}/", {"drive_files": [f.id]}, format="json")
    client.patch(f"{URL}{task.id}/", {"drive_files": []}, format="json")
    assert AuditEvent.objects.count() == before + 2
    last = AuditEvent.objects.order_by("-id").first()
    assert "drive_files" in str(last.changes)


def test_soft_deleted_file_id_absent_from_raw_response():
    area = _area()
    f = _drive_file("a.pdf")
    task = AreaTask.objects.create(area=area, title="T")
    task.drive_files.add(f)
    f.soft_delete()
    client = _client(_user(area))
    resp = client.get(f"{URL}{task.id}/")
    assert "drive_files" not in resp.data
    assert f.id not in [d["id"] for d in resp.data["drive_files_detail"]]
    row = next(r for r in _results(client.get(URL)) if r["id"] == task.id)
    assert "drive_files" not in row
    assert row["drive_files_detail"] == []


# ── fix wave finale ───────────────────────────────────────────────────────────

def _portal_client(user):
    c = _client(user)
    s = c.session
    s["ambito"] = "portal"
    s.save()
    return c


def test_restore_and_bulk_restore_blocked_for_portal_session():
    area = _area()
    user = _user(area)
    _grant_change(user)
    task = AreaTask.objects.create(area=area, title="T")
    task.soft_delete()
    pc = _portal_client(user)
    assert pc.post(f"{URL}{task.id}/restore/").status_code == 403
    assert pc.post(f"{URL}bulk_restore/", {"ids": [task.id]}, format="json").status_code == 403
    nc = _client(user)
    assert nc.post(f"{URL}{task.id}/restore/").status_code == 204


def test_include_deleted_does_not_make_trashed_tasks_writable():
    area = _area()
    user = _user(area)
    task = AreaTask.objects.create(area=area, title="T")
    task.soft_delete()
    c = _client(user)
    assert c.patch(f"{URL}{task.id}/?include_deleted=1", {"title": "X"}, format="json").status_code == 404
    assert c.post(f"{URL}{task.id}/comments/?include_deleted=1", {"body": "x"}, format="json").status_code == 404
    assert c.get(f"{URL}{task.id}/?include_deleted=1").status_code == 200


def test_create_audit_records_real_area_not_client_value():
    from audit.models import AuditEvent
    mine, other = _area("Mia"), _area("AltraXYZ")
    user = _user(mine)
    resp = _client(user).post(URL, {"title": "T", "area": other.id}, format="json")
    assert resp.status_code == 201
    ev = AuditEvent.objects.filter(action="create", object_id=str(resp.data["id"])).latest("id")
    area_change = ev.changes["area"]["to"]
    assert "AltraXYZ" not in str(area_change)
    assert "Mia" in str(area_change) or str(mine.id) in str(area_change)


def test_superuser_can_restore_task_of_other_area():
    task = AreaTask.objects.create(area=_area(), title="T")
    task.soft_delete()
    assert _client(_user(None, superuser=True)).post(f"{URL}{task.id}/restore/").status_code == 204


def test_bulk_restore_without_change_permission_403():
    area = _area()
    task = AreaTask.objects.create(area=area, title="T")
    task.soft_delete()
    resp = _client(_user(area)).post(f"{URL}bulk_restore/", {"ids": [task.id]}, format="json")
    assert resp.status_code == 403


def test_stale_assignee_does_not_block_unrelated_edit():
    a, b = _area(), _area()
    actor = _user(a)
    x = _user(a)
    task = AreaTask.objects.create(area=a, title="T", assigned_to=x)
    p = x.profile
    p.leave_area = b
    p.save(update_fields=["leave_area"])
    c = _client(actor)
    r = c.patch(f"{URL}{task.id}/", {"title": "Nuovo", "assigned_to": x.id}, format="json")
    assert r.status_code == 200, r.data
    y = _user(b)
    r = c.patch(f"{URL}{task.id}/", {"assigned_to": y.id}, format="json")
    assert r.status_code == 400


# ── numero di query costante sull'elenco ──────────────────────────────────────

from django.db import connection  # noqa: E402
from django.test.utils import CaptureQueriesContext  # noqa: E402


def _queries_for(client, url, params=None):
    with CaptureQueriesContext(connection) as ctx:
        resp = client.get(url, params or {})
    assert resp.status_code == 200, resp.data
    return len(ctx)


def _make_tasks(area, creator, count, *, files_per_task=2):
    files = [_drive_file(f"f{i}.pdf") for i in range(files_per_task)]
    tasks = []
    for i in range(count):
        t = AreaTask.objects.create(area=area, title=f"T{i}", created_by=creator, assigned_to=creator,
                                    due_date=timezone.localdate())
        t.drive_files.add(*files)
        tasks.append(t)
    return tasks


def test_list_query_count_does_not_grow_with_the_number_of_tasks():
    area = _area()
    user = _user(area)
    client = _client(user)
    _make_tasks(area, user, 1)
    _queries_for(client, URL, {"page_size": 50})  # warm-up: cache one-shot (permessi, ecc.)
    few = _queries_for(client, URL, {"page_size": 50})
    _make_tasks(area, user, 7)
    many = _queries_for(client, URL, {"page_size": 50})
    assert many == few


def test_due_query_count_does_not_grow_with_the_number_of_tasks():
    area = _area()
    user = _user(area)
    client = _client(user)
    _make_tasks(area, user, 1)
    _queries_for(client, f"{URL}due/")  # warm-up: cache one-shot (permessi, ecc.)
    few = _queries_for(client, f"{URL}due/")
    _make_tasks(area, user, 7)
    many = _queries_for(client, f"{URL}due/")
    assert many == few


def test_list_still_hides_restricted_and_deleted_files_per_task():
    area = _area()
    group = Group.objects.create(name="riservato-q")
    user = _user(area)
    public = _drive_file("pubblico.pdf")
    secret = _drive_file("segreto.pdf", group=group)
    trashed = _drive_file("cestino.pdf")
    task = AreaTask.objects.create(area=area, title="T", created_by=user)
    task.drive_files.add(public, secret, trashed)
    trashed.soft_delete()
    rows = _results(_client(user).get(URL))
    row = next(r for r in rows if r["id"] == task.id)
    assert [d["id"] for d in row["drive_files_detail"]] == [public.id]


def test_ordering_is_stable_across_pages_with_ties_and_null_due_dates():
    area = _area()
    user = _user(area)
    day = timezone.localdate() + timedelta(days=3)
    created = []
    for i in range(7):
        due = day if i < 4 else None
        created.append(AreaTask.objects.create(area=area, title=f"T{i}", created_by=user, due_date=due).id)
    client = _client(user)
    seen = []
    for page in (1, 2, 3):
        resp = client.get(URL, {"ordering": "due_date", "page_size": 3, "page": page})
        assert resp.status_code == 200, resp.data
        seen.extend(row["id"] for row in _results(resp))
    assert sorted(seen) == sorted(created)
    assert len(seen) == len(set(seen))
    dated = [i for i in seen if i in created[:4]]
    assert dated == sorted(dated)
    undated = [i for i in seen if i in created[4:]]
    assert undated == sorted(undated)
