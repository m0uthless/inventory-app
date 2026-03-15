from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from wiki.models import WikiPage, WikiCategory

pytestmark = pytest.mark.django_db


def _make_user(*, superuser: bool = False):
    User = get_user_model()
    suffix = uuid.uuid4().hex[:6]
    user = User.objects.create_user(username=f"wiki_{suffix}", password="pw")
    if superuser:
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=["is_staff", "is_superuser"])
    return user


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _make_page(owner):
    suffix = uuid.uuid4().hex[:6]
    return WikiPage.objects.create(
        title=f'Page {suffix}',
        slug=f'page-{suffix}',
        content_markdown='# Hello',
        created_by=owner,
        updated_by=owner,
    )


class TestWikiRatingAndPermissions:
    def test_authenticated_user_can_rate_once_without_wiki_model_permissions(self):
        owner = _make_user(superuser=True)
        voter = _make_user()
        page = _make_page(owner)
        client = _auth_client(voter)

        first = client.post(f'/api/wiki-pages/{page.id}/rate/', {'rating': 4}, format='json')
        second = client.post(f'/api/wiki-pages/{page.id}/rate/', {'rating': 5}, format='json')

        assert first.status_code == 201, first.data
        assert first.data['current_user_rating'] == 4
        assert first.data['rating_count'] == 1
        assert second.status_code == 400, second.data

    def test_authenticated_user_can_record_view_without_wiki_model_permissions(self):
        owner = _make_user(superuser=True)
        viewer = _make_user()
        page = _make_page(owner)
        client = _auth_client(viewer)

        res = client.post(f'/api/wiki-pages/{page.id}/view/')

        assert res.status_code == 200, res.data
        page.refresh_from_db()
        assert page.view_count == 1

    def test_wiki_category_create_requires_add_permission(self):
        user = _make_user()
        client = _auth_client(user)

        denied = client.post('/api/wiki-categories/', {'name': 'KB', 'sort_order': 1}, format='json')
        assert denied.status_code == 403, denied.data

        perm = Permission.objects.get(codename='add_wikicategory')
        user.user_permissions.add(perm)
        # Django caches permissions on the user object (_perm_cache / _user_perm_cache).
        # refresh_from_db() does NOT clear these caches — they must be deleted explicitly.
        for attr in ('_perm_cache', '_user_perm_cache', '_prefetched_objects_cache'):
            try:
                delattr(user, attr)
            except AttributeError:
                pass
        client.force_authenticate(user=user)
        allowed = client.post('/api/wiki-categories/', {'name': 'KB', 'sort_order': 1}, format='json')
        assert allowed.status_code == 201, allowed.data
