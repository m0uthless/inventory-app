"""Test suite: conversione di un task di area in issue (POST
/api/area-tasks/{id}/convert-to-issue/).

Copre:
- conversione riuscita (issue creata, campi copiati, commenti copiati con
  autore originale, task marcato completato e collegato alla issue, risposta
  201 con la forma {task, issue}, email inviate).
- 403 se l'utente non ha il permesso issues.add_issue.
- 403 se l'utente non è nell'area del task (e non è superuser).
- 409 se il task è già stato convertito.
- 400 se manca il customer nel payload.
"""
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core import mail
from rest_framework.test import APIClient

from attendance.models import LeaveArea
from core.models import AreaTask, AreaTaskComment, CustomerStatus, UserProfile
from crm.models import Customer
from core.testing import grant_via_group, make_archie_user

pytestmark = pytest.mark.django_db

User = get_user_model()


def _area(label="Area"):
    return LeaveArea.objects.create(key=f"area_{uuid.uuid4().hex[:6]}", label=label)


def _user(area=None, *, superuser=False, can_add_issue=False, is_technician=False, email=None):
    username = f"u_{uuid.uuid4().hex[:6]}"
    email = email if email is not None else f"{username}@example.com"
    if superuser:
        user = User.objects.create_superuser(username=username, password="pw", email=email)
    else:
        user = make_archie_user(username=username, password="pw", email=email)
    if can_add_issue:
        perm = Permission.objects.get(codename="add_issue", content_type__app_label="issues")
        user.user_permissions.add(perm)
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.leave_area = area
    profile.save(update_fields=["leave_area"])
    if is_technician:
        grant_via_group(user, "issues.be_assignee")
    return User.objects.get(pk=user.pk)


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _customer():
    status = CustomerStatus.objects.get_or_create(
        key=f"active_convert_{uuid.uuid4().hex[:6]}", defaults={"label": "Active"}
    )[0]
    return Customer.objects.create(name="Cliente Test", status=status)


def _url(task):
    return f"/api/area-tasks/{task.id}/convert-to-issue/"


def test_convert_success_creates_issue_copies_fields_comments_and_closes_task(django_capture_on_commit_callbacks):
    area = _area()
    tech = _user(area, can_add_issue=True, is_technician=True, email="tech@example.com")
    actor = _user(area, can_add_issue=True)
    customer = _customer()

    task = AreaTask.objects.create(
        area=area, title="Fix stampante", description="Descrizione originale",
        priority="high", assigned_to=tech,
    )
    author = _user(area)
    AreaTaskComment.objects.create(task=task, author=author, body="Primo commento")
    AreaTaskComment.objects.create(task=task, author=actor, body="Secondo commento")

    # Le notifiche sono deferite con transaction.on_commit: in un test
    # racchiuso nella atomic di default di pytest-django il commit reale non
    # avviene mai, quindi serve questo fixture per eseguirle "come se" la
    # transazione fosse commitata con successo (comportamento reale in prod).
    with django_capture_on_commit_callbacks(execute=True):
        resp = _client(actor).post(_url(task), {"customer": customer.id}, format="json")
    assert resp.status_code == 201, resp.data

    data = resp.data
    assert set(data.keys()) == {"task", "issue"}
    issue_id = data["issue"]["id"]
    assert data["issue"]["title"] == "Fix stampante"

    from issues.models import Issue, IssueComment
    issue = Issue.objects.get(pk=issue_id)
    assert issue.title == "Fix stampante"
    assert issue.description == "Descrizione originale"
    assert issue.priority == "high"
    assert issue.customer_id == customer.id
    assert issue.assigned_to_id == tech.id
    assert issue.created_by_id == actor.id

    comments = list(IssueComment.objects.filter(issue=issue).order_by("created_at"))
    assert [c.body for c in comments] == ["Primo commento", "Secondo commento"]
    assert [c.author_id for c in comments] == [author.id, actor.id]

    task.refresh_from_db()
    assert task.status == AreaTask.STATUS_COMPLETATO
    assert task.completed_at is not None
    assert task.converted_to_issue_id == issue.id

    assert data["task"]["converted_to_issue"] == issue.id
    assert data["task"]["converted_to_issue_title"] == "Fix stampante"
    assert data["task"]["status"] == AreaTask.STATUS_COMPLETATO

    # Email: broadcast ai tecnici assegnabili + assegnazione al tecnico.
    recipients = [m.to[0] for m in mail.outbox]
    assert "tech@example.com" in recipients
    subjects_for_tech = {m.subject for m in mail.outbox if m.to == ["tech@example.com"]}
    assert any("Nuova issue" in s for s in subjects_for_tech)
    assert any("assegnata a te" in s for s in subjects_for_tech)


def test_convert_forbidden_without_add_issue_permission():
    from issues.models import Issue

    area = _area()
    actor = _user(area, can_add_issue=False)
    customer = _customer()
    task = AreaTask.objects.create(area=area, title="T")
    issue_count_before = Issue.objects.count()

    resp = _client(actor).post(_url(task), {"customer": customer.id}, format="json")
    assert resp.status_code == 403
    task.refresh_from_db()
    assert task.converted_to_issue_id is None
    assert Issue.objects.count() == issue_count_before
    assert mail.outbox == []


def test_convert_forbidden_for_user_of_other_area():
    from issues.models import Issue

    mine, other = _area(), _area()
    actor = _user(mine, can_add_issue=True)
    customer = _customer()
    task = AreaTask.objects.create(area=other, title="T")
    issue_count_before = Issue.objects.count()

    resp = _client(actor).post(_url(task), {"customer": customer.id}, format="json")
    assert resp.status_code == 403
    task.refresh_from_db()
    assert task.converted_to_issue_id is None
    assert Issue.objects.count() == issue_count_before
    assert mail.outbox == []


def test_convert_conflict_when_already_converted():
    from issues.models import Issue

    area = _area()
    actor = _user(area, can_add_issue=True)
    customer = _customer()
    task = AreaTask.objects.create(area=area, title="T")

    existing_issue = Issue.objects.create(title="Already", customer=customer, created_by=actor)
    task.converted_to_issue = existing_issue
    task.save(update_fields=["converted_to_issue"])
    issue_count_before = Issue.objects.count()
    mail.outbox.clear()

    resp = _client(actor).post(_url(task), {"customer": customer.id}, format="json")
    assert resp.status_code == 409
    assert Issue.objects.count() == issue_count_before
    assert mail.outbox == []


def test_convert_bad_request_without_customer():
    from issues.models import Issue

    area = _area()
    actor = _user(area, can_add_issue=True)
    task = AreaTask.objects.create(area=area, title="T")
    issue_count_before = Issue.objects.count()

    resp = _client(actor).post(_url(task), {}, format="json")
    assert resp.status_code == 400
    task.refresh_from_db()
    assert task.converted_to_issue_id is None
    assert Issue.objects.count() == issue_count_before
    assert mail.outbox == []


def test_convert_rolls_back_and_sends_no_email_when_a_later_step_fails(monkeypatch):
    """Se un passo successivo alla creazione della issue (copia commenti,
    salvataggio task, audit) fallisce, l'intera transazione deve rollbackare
    e NESSUNA email deve essere stata inviata: le notifiche sono deferite con
    transaction.on_commit, quindi un rollback le annulla con l'intera tx."""
    from issues.models import Issue, IssueComment

    area = _area()
    tech = _user(area, can_add_issue=True, is_technician=True, email="tech@example.com")
    actor = _user(area, can_add_issue=True)
    customer = _customer()
    task = AreaTask.objects.create(area=area, title="T", assigned_to=tech)
    AreaTaskComment.objects.create(task=task, author=actor, body="c1")

    def _boom(*args, **kwargs):
        raise RuntimeError("boom - simulated failure after issue creation")

    monkeypatch.setattr(IssueComment.objects, "create", _boom)

    client = _client(actor)
    client.raise_request_exception = False
    resp = client.post(_url(task), {"customer": customer.id}, format="json")
    assert resp.status_code == 500

    assert Issue.objects.count() == 0
    assert mail.outbox == []
    task.refresh_from_db()
    assert task.converted_to_issue_id is None
    assert task.status != AreaTask.STATUS_COMPLETATO


def test_convert_second_call_after_conversion_returns_409_without_duplicate_issue():
    """Esercita lo stesso percorso di codice che una race condition
    colpirebbe (il recheck con select_for_update dentro la transazione)."""
    from issues.models import Issue

    area = _area()
    actor = _user(area, can_add_issue=True)
    customer = _customer()
    task = AreaTask.objects.create(area=area, title="T")

    client = _client(actor)
    resp1 = client.post(_url(task), {"customer": customer.id}, format="json")
    assert resp1.status_code == 201, resp1.data
    count_after_first = Issue.objects.count()

    mail.outbox.clear()
    resp2 = client.post(_url(task), {"customer": customer.id}, format="json")
    assert resp2.status_code == 409
    assert Issue.objects.count() == count_after_first
    assert mail.outbox == []


def test_convert_with_non_assignable_assignee_leaves_issue_unassigned_and_skips_assignment_email(
    django_capture_on_commit_callbacks,
):
    """Un task assegnato a un membro d'area qualsiasi (non tecnico
    ServiceNow/non-Philips) non deve far fallire la conversione con un 400 su
    assigned_to: l'issue nasce semplicemente non assegnata."""
    area = _area()
    actor = _user(area, can_add_issue=True)
    broadcast_tech = _user(area, email="broadcast@example.com", is_technician=True)
    plain_member = _user(area, email="plain@example.com", is_technician=False)
    customer = _customer()
    task = AreaTask.objects.create(area=area, title="T", assigned_to=plain_member)

    with django_capture_on_commit_callbacks(execute=True):
        resp = _client(actor).post(_url(task), {"customer": customer.id}, format="json")
    assert resp.status_code == 201, resp.data

    from issues.models import Issue
    issue = Issue.objects.get(pk=resp.data["issue"]["id"])
    assert issue.assigned_to_id is None

    # Il broadcast "nuova issue" ai tecnici assegnabili avviene comunque...
    assert any(m.to == ["broadcast@example.com"] for m in mail.outbox)
    # ...ma nessuna email di assegnazione, dato che l'issue non è assegnata.
    assert not any(
        ("assegnata a te" in m.subject or "riassegnata" in m.subject) for m in mail.outbox
    )


def test_convert_copies_area():
    area = _area()
    actor = _user(area, can_add_issue=True)
    task = AreaTask.objects.create(area=area, title="Con area")
    resp = _client(actor).post(_url(task), {"customer": _customer().id}, format="json")
    assert resp.status_code == 201, resp.data

    from issues.models import Issue
    assert Issue.objects.get(pk=resp.data["issue"]["id"]).area_id == area.id


def test_convert_with_assignee_outside_task_area_leaves_issue_unassigned():
    area, other = _area(), _area()
    actor = _user(area, can_add_issue=True)
    outsider = _user(other, is_technician=True)  # assegnatario issue, ma di un'altra area
    task = AreaTask.objects.create(area=area, title="Assegnato fuori area", assigned_to=outsider)
    resp = _client(actor).post(_url(task), {"customer": _customer().id}, format="json")
    assert resp.status_code == 201, resp.data

    from issues.models import Issue
    issue = Issue.objects.get(pk=resp.data["issue"]["id"])
    assert issue.area_id == area.id
    assert issue.assigned_to_id is None


# ── Revisione 20/11: issue di un'altra area, issue nel cestino ──

def _converted_task(area, issue_area=None):
    from issues.models import Issue
    issue = Issue.objects.create(title="Issue riservata", customer=_customer(), created_by=_user(area), area=issue_area)
    task = AreaTask.objects.create(area=area, title="Task", converted_to_issue=issue, status=AreaTask.STATUS_COMPLETATO)
    return task, issue


def _view_tasks(user):
    user.user_permissions.add(Permission.objects.get(codename="view_areatask", content_type__app_label="core"))
    return User.objects.get(pk=user.pk)


def test_converted_issue_title_hidden_when_issue_in_other_area():
    area = _area()
    task, issue = _converted_task(area, issue_area=_area())
    data = _client(_view_tasks(_user(area))).get(f"/api/area-tasks/{task.id}/").json()
    assert data["converted_to_issue"] == issue.id
    assert data["converted_to_issue_title"] is None


def test_converted_issue_title_shown_when_issue_visible():
    area = _area()
    task, _ = _converted_task(area, issue_area=area)
    data = _client(_view_tasks(_user(area))).get(f"/api/area-tasks/{task.id}/").json()
    assert data["converted_to_issue_title"] == "Issue riservata"
    assert data["converted_to_issue_deleted"] is False


def test_converted_issue_deleted_flag():
    from django.utils import timezone
    area = _area()
    task, issue = _converted_task(area)
    issue.deleted_at = timezone.now()
    issue.save(update_fields=["deleted_at"])
    data = _client(_view_tasks(_user(area))).get(f"/api/area-tasks/{task.id}/").json()
    assert data["converted_to_issue_deleted"] is True


def test_reconvert_allowed_when_issue_is_trashed():
    from django.utils import timezone
    from issues.models import Issue
    area = _area()
    task, old = _converted_task(area)
    old.deleted_at = timezone.now()
    old.save(update_fields=["deleted_at"])
    resp = _client(_user(area, can_add_issue=True)).post(_url(task), {"customer": _customer().id}, format="json")
    assert resp.status_code == 201, resp.data
    task.refresh_from_db()
    assert task.converted_to_issue_id == resp.data["issue"]["id"] != old.id
    assert resp.data["task"]["converted_to_issue_deleted"] is False
    assert Issue.objects.filter(pk=old.pk, deleted_at__isnull=False).exists()


# ── Allegati ereditati dal task (spec 2026-11-20) ──

def _drive_file(name):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from drive.models import DriveFile
    return DriveFile.objects.create(name=name, file=SimpleUploadedFile(name, b"x"))


def test_convert_copies_task_files_as_task_attachments():
    from issues.models import IssueAttachment
    area = _area()
    task = AreaTask.objects.create(area=area, title="Con allegati")
    a, b = _drive_file("verbale.pdf"), _drive_file("foto.png")
    task.drive_files.add(a, b)
    resp = _client(_user(area, can_add_issue=True)).post(_url(task), {"customer": _customer().id}, format="json")
    assert resp.status_code == 201, resp.data
    atts = IssueAttachment.objects.filter(issue_id=resp.data["issue"]["id"]).order_by("name")
    assert [(x.name, x.from_task, x.drive_file_id, bool(x.file)) for x in atts] == [
        ("[Task] foto.png", True, b.id, False), ("[Task] verbale.pdf", True, a.id, False),
    ]
