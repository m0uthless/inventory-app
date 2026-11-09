"""Articoli Wiki collegati a una issue e passi della procedura (scheda issue → «Procedura»)."""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from core.models import CustomerStatus
from crm.models import Customer
from issues.models import Issue
from wiki.models import WikiLink, WikiPage
from wiki.procedure import procedure_steps

pytestmark = pytest.mark.django_db
User = get_user_model()

MD_TASKS = """# Riavvio MWL

Introduzione.

- [ ] Verificare l'invio degli ordini dal **RIS**
- [x] Controllare lo stato del servizio [MWL](https://x)
- [ ] Riavviare il servizio
"""


def _user(*perms, superuser=False):
    u = User.objects.create_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw")
    if superuser:
        u.is_staff = u.is_superuser = True
        u.save(update_fields=["is_staff", "is_superuser"])
    for codename in perms:
        app, code = codename.split(".")
        u.user_permissions.add(Permission.objects.get(content_type__app_label=app, codename=code))
    return User.objects.get(pk=u.pk)


def _issue(author):
    status = CustomerStatus.objects.get_or_create(key=f"st_{uuid.uuid4().hex[:6]}", defaults={"label": "Active"})[0]
    customer = Customer.objects.create(name="Cliente", status=status)
    return Issue.objects.create(title="Worklist vuota", customer=customer, created_by=author)


def _page(md=MD_TASKS, published=True):
    return WikiPage.objects.create(title="Riavvio servizio MWL", slug=f"p-{uuid.uuid4().hex[:6]}", content_markdown=md, is_published=published)


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


# ── Parser ──────────────────────────────────────────────────────────────────

def test_steps_from_task_list_are_cleaned():
    assert procedure_steps(MD_TASKS) == [
        "Verificare l'invio degli ordini dal RIS", "Controllare lo stato del servizio MWL", "Riavviare il servizio",
    ]


def test_steps_fall_back_to_first_ordered_list_and_skip_code():
    md = "Testo\n\n```\n1. non questo\n```\n\n1. Primo\n2. Secondo\n   dettaglio\n3. Terzo\n\nAltro\n\n1. Altro elenco\n"
    assert procedure_steps(md) == ["Primo", "Secondo", "Terzo"]


def test_no_list_means_no_steps():
    assert procedure_steps("Solo testo, nessun elenco.") == []
    assert procedure_steps(None) == []


# ── API ─────────────────────────────────────────────────────────────────────

def test_link_check_and_unlink_flow():
    admin = _user(superuser=True)
    issue, page = _issue(admin), _page()
    c = _client(admin)

    r = c.post(f"/api/issues/{issue.id}/wiki/", {"page": page.id}, format="json")
    assert r.status_code == 201, r.data
    link_id = r.data["id"]
    assert [s["checked"] for s in r.data["steps"]] == [False, False, False]

    # Collegare due volte lo stesso articolo non crea un doppione
    assert c.post(f"/api/issues/{issue.id}/wiki/", {"page": page.id}, format="json").status_code == 200
    assert WikiLink.objects.filter(entity_type="issue", entity_id=issue.id, deleted_at__isnull=True).count() == 1

    step = r.data["steps"][1]["text"]
    r = c.patch(f"/api/issues/{issue.id}/wiki/{link_id}/", {"step": step, "checked": True}, format="json")
    assert r.status_code == 200, r.data
    assert [s["checked"] for s in r.data["steps"]] == [False, True, False]

    r = c.get(f"/api/issues/{issue.id}/wiki/")
    assert r.status_code == 200 and r.data[0]["steps"][1]["checked"] is True

    r = c.patch(f"/api/issues/{issue.id}/wiki/{link_id}/", {"step": "Passo inventato", "checked": True}, format="json")
    assert r.status_code == 400

    assert c.delete(f"/api/issues/{issue.id}/wiki/{link_id}/").status_code == 204
    assert c.get(f"/api/issues/{issue.id}/wiki/").data == []


def test_unpublished_page_cannot_be_linked():
    admin = _user(superuser=True)
    issue, page = _issue(admin), _page(published=False)
    r = _client(admin).post(f"/api/issues/{issue.id}/wiki/", {"page": page.id}, format="json")
    assert r.status_code == 400


def test_link_of_another_issue_is_not_reachable():
    admin = _user(superuser=True)
    a, b, page = _issue(admin), _issue(admin), _page()
    c = _client(admin)
    link_id = c.post(f"/api/issues/{a.id}/wiki/", {"page": page.id}, format="json").data["id"]
    assert c.delete(f"/api/issues/{b.id}/wiki/{link_id}/").status_code == 404


def test_permissions():
    admin = _user(superuser=True)
    issue, page = _issue(admin), _page()
    link_id = _client(admin).post(f"/api/issues/{issue.id}/wiki/", {"page": page.id}, format="json").data["id"]

    # Vede la issue ma non la Wiki: niente articoli
    no_wiki = _user("core.access_archie", "issues.view_issue")
    assert _client(no_wiki).get(f"/api/issues/{issue.id}/wiki/").status_code == 403

    # Vede issue e Wiki ma non può modificare la issue: legge, non spunta né collega
    reader = _user("core.access_archie", "issues.view_issue", "wiki.view_wikipage")
    rc = _client(reader)
    assert rc.get(f"/api/issues/{issue.id}/wiki/").status_code == 200
    assert rc.post(f"/api/issues/{issue.id}/wiki/", {"page": page.id}, format="json").status_code == 403
    assert rc.patch(f"/api/issues/{issue.id}/wiki/{link_id}/", {"step": "Riavviare il servizio", "checked": True}, format="json").status_code == 403

    editor = _user("core.access_archie", "issues.view_issue", "issues.change_issue", "wiki.view_wikipage")
    r = _client(editor).patch(f"/api/issues/{issue.id}/wiki/{link_id}/", {"step": "Riavviare il servizio", "checked": True}, format="json")
    assert r.status_code == 200, r.data
