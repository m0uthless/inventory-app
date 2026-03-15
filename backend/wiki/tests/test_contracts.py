from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from core.models import CustomerStatus
from crm.models import Customer
from wiki.models import WikiAttachment, WikiLink, WikiPage, WikiPageRevision

pytestmark = pytest.mark.django_db


def _make_superuser():
    User = get_user_model()
    suffix = uuid.uuid4().hex[:6]
    user = User.objects.create_user(username=f"wiki_contract_{suffix}", password="pw")
    user.is_staff = True
    user.is_superuser = True
    user.save(update_fields=["is_staff", "is_superuser"])
    return user


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _make_page(user, *, slug: str | None = None) -> WikiPage:
    suffix = uuid.uuid4().hex[:6]
    return WikiPage.objects.create(
        title=f"Page {suffix}",
        slug=slug or f"page-{suffix}",
        content_markdown="# Hello",
        created_by=user,
        updated_by=user,
    )


def _make_customer_status() -> CustomerStatus:
    suffix = uuid.uuid4().hex[:6]
    return CustomerStatus.objects.create(key=f"active-{suffix}", label="Active")


def test_slug_availability_returns_suggested_slug_and_honors_exclude_id():
    user = _make_superuser()
    page = _make_page(user, slug=f"manual-{uuid.uuid4().hex[:6]}")
    client = _auth_client(user)

    taken = client.get("/api/wiki-pages/slug-availability/", {"slug": page.slug})
    assert taken.status_code == 200, taken.data
    assert taken.data["available"] is False
    assert taken.data["suggested_slug"].startswith(page.slug)
    assert taken.data["suggested_slug"] != page.slug

    same_page = client.get(
        "/api/wiki-pages/slug-availability/",
        {"slug": page.slug, "exclude_id": page.id},
    )
    assert same_page.status_code == 200, same_page.data
    assert same_page.data["available"] is True
    assert same_page.data["suggested_slug"] == page.slug


def test_wiki_related_lists_filter_with_page_id_without_colliding_with_pagination():
    user = _make_superuser()
    page_a = _make_page(user)
    page_b = _make_page(user)
    client = _auth_client(user)

    WikiAttachment.objects.create(
        page=page_a,
        filename="a.txt",
        mime_type="text/plain",
        file=SimpleUploadedFile("a.txt", b"a", content_type="text/plain"),
    )
    WikiAttachment.objects.create(
        page=page_b,
        filename="b.txt",
        mime_type="text/plain",
        file=SimpleUploadedFile("b.txt", b"b", content_type="text/plain"),
    )

    WikiLink.objects.create(page=page_a, entity_type="customer", entity_id=101)
    WikiLink.objects.create(page=page_b, entity_type="customer", entity_id=202)

    WikiPageRevision.objects.create(
        page=page_a,
        revision_number=1,
        title=page_a.title,
        content_markdown=page_a.content_markdown,
        saved_by=user,
    )
    WikiPageRevision.objects.create(
        page=page_b,
        revision_number=1,
        title=page_b.title,
        content_markdown=page_b.content_markdown,
        saved_by=user,
    )

    links = client.get("/api/wiki-links/", {"page_id": page_a.id, "page": 1, "page_size": 100})
    assert links.status_code == 200, links.data
    assert links.data["count"] == 1
    assert links.data["results"][0]["page"] == page_a.id

    attachments = client.get(
        "/api/wiki-attachments/",
        {"page_id": page_a.id, "page": 1, "page_size": 100},
    )
    assert attachments.status_code == 200, attachments.data
    assert attachments.data["count"] == 1
    assert attachments.data["results"][0]["page"] == page_a.id

    revisions = client.get(
        "/api/wiki-revisions/",
        {"page_id": page_a.id, "page": 1, "page_size": 100},
    )
    assert revisions.status_code == 200, revisions.data
    assert revisions.data["count"] == 1
    assert revisions.data["results"][0]["page"] == page_a.id


def test_wiki_link_serializer_exposes_entity_label_and_path_for_customers():
    user = _make_superuser()
    status = _make_customer_status()
    customer = Customer.objects.create(name="Acme Srl", status=status, created_by=user, updated_by=user)
    page = _make_page(user)
    link = WikiLink.objects.create(page=page, entity_type="customer", entity_id=customer.id)
    client = _auth_client(user)

    response = client.get(f"/api/wiki-links/{link.id}/")

    assert response.status_code == 200, response.data
    assert response.data["entity_label"] == "Acme Srl"
    assert response.data["entity_path"] == f"/customers?open={customer.id}"
