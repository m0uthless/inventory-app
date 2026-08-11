from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from wiki.models import WikiPage, WikiPageRevision

pytestmark = pytest.mark.django_db


def _make_superuser():
    User = get_user_model()
    suffix = uuid.uuid4().hex[:6]
    user = User.objects.create_user(username=f"wiki_stats_{suffix}", password="pw")
    user.is_staff = True
    user.is_superuser = True
    user.save(update_fields=["is_staff", "is_superuser"])
    return user


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _make_page_with_revision(user, *, deleted: bool = False) -> WikiPage:
    suffix = uuid.uuid4().hex[:6]
    page = WikiPage.objects.create(
        title=f"Page {suffix}",
        slug=f"page-{suffix}",
        content_markdown="# Hello",
        created_by=user,
        updated_by=user,
    )
    WikiPageRevision.objects.create(
        page=page,
        revision_number=1,
        title=page.title,
        content_markdown=page.content_markdown,
        saved_by=user,
    )
    if deleted:
        page.soft_delete()
    return page


def test_wiki_stats_total_pages_reflects_deletion_immediately():
    """Regressione: la cache di WikiStatsView non veniva invalidata alla
    cancellazione di una pagina, quindi il totale restava quello vecchio
    fino allo scadere del TTL (5 minuti)."""
    from django.core.cache import cache
    cache.clear()

    user = _make_superuser()
    _make_page_with_revision(user, deleted=False)
    page_b = _make_page_with_revision(user, deleted=False)

    client = _auth_client(user)

    first = client.get("/api/wiki-stats/")
    assert first.status_code == 200, first.data
    assert first.data["totals"]["total"] == 2

    # Cancellazione via API (stesso percorso della UI), non via ORM diretto,
    # per esercitare l'invalidazione agganciata a perform_destroy.
    delete_response = client.delete(f"/api/wiki-pages/{page_b.id}/")
    assert delete_response.status_code in (200, 204), delete_response.data

    second = client.get("/api/wiki-stats/")
    assert second.status_code == 200, second.data
    assert second.data["totals"]["total"] == 1


def test_wiki_stats_top_authors_excludes_revisions_of_deleted_pages():
    from django.core.cache import cache
    cache.clear()  # evita di leggere un risultato cachato da un run precedente

    user = _make_superuser()
    # Una pagina attiva e una cancellata, entrambe con una revisione dello stesso utente.
    _make_page_with_revision(user, deleted=False)
    _make_page_with_revision(user, deleted=True)

    client = _auth_client(user)
    response = client.get("/api/wiki-stats/")

    assert response.status_code == 200, response.data
    top_authors = response.data["top_authors"]
    matching = [row for row in top_authors if row["user_id"] == user.id]
    assert len(matching) == 1
    # Solo la revisione della pagina NON cancellata deve contare.
    assert matching[0]["edits"] == 1
