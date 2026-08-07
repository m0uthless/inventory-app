from __future__ import annotations

import io
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from feedback.models import ReportRequest, ReportStatus

pytestmark = pytest.mark.django_db


def _make_user(*, superuser: bool = False):
    User = get_user_model()
    suffix = uuid.uuid4().hex[:6]
    user = User.objects.create_user(username=f"fb_{suffix}", password="pw")
    if superuser:
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=["is_staff", "is_superuser"])
    return user




def _png_bytes() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (2, 2), color=(10, 20, 30))
    img.save(buf, format="PNG")
    return buf.getvalue()


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _make_item(owner, *, with_screenshot: bool = False):
    item = ReportRequest.objects.create(
        kind='bug',
        status=ReportStatus.OPEN,
        section='inventory',
        description='Segnalazione di test',
        created_by=owner,
    )
    if with_screenshot:
        item.screenshot = SimpleUploadedFile('existing.png', _png_bytes(), content_type='image/png')
        item.save(update_fields=['screenshot'])
    return item


class TestReportRequestPermissions:
    def test_creator_can_upload_first_screenshot_without_change_permission(self):
        owner = _make_user()
        item = _make_item(owner, with_screenshot=False)
        client = _auth_client(owner)

        res = client.patch(
            f'/api/feedback-items/{item.id}/',
            {'screenshot': SimpleUploadedFile('screen.png', _png_bytes(), content_type='image/png')},
            format='multipart',
        )

        assert res.status_code == 200, res.data
        item.refresh_from_db()
        assert bool(item.screenshot)

    def test_creator_cannot_replace_existing_screenshot_without_change_permission(self):
        owner = _make_user()
        item = _make_item(owner, with_screenshot=True)
        client = _auth_client(owner)

        res = client.patch(
            f'/api/feedback-items/{item.id}/',
            {'screenshot': SimpleUploadedFile('replacement.png', _png_bytes(), content_type='image/png')},
            format='multipart',
        )

        assert res.status_code == 403, res.data

    def test_other_user_cannot_upload_screenshot_without_change_permission(self):
        owner = _make_user()
        other = _make_user()
        item = _make_item(owner, with_screenshot=False)
        client = _auth_client(other)

        res = client.patch(
            f'/api/feedback-items/{item.id}/',
            {'screenshot': SimpleUploadedFile('screen.png', _png_bytes(), content_type='image/png')},
            format='multipart',
        )

        assert res.status_code == 403, res.data

    def test_creator_cannot_resolve_without_change_permission(self):
        owner = _make_user()
        item = _make_item(owner)
        client = _auth_client(owner)

        res = client.patch(f'/api/feedback-items/{item.id}/', {'status': 'resolved'}, format='json')

        assert res.status_code == 403, res.data
        item.refresh_from_db()
        assert item.status == ReportStatus.OPEN
        assert item.resolved_at is None

    def test_user_with_change_permission_can_resolve(self):
        owner = _make_user()
        manager = _make_user()
        perm = Permission.objects.get(codename='change_reportrequest')
        manager.user_permissions.add(perm)
        item = _make_item(owner)
        client = _auth_client(manager)

        res = client.patch(f'/api/feedback-items/{item.id}/', {'status': 'resolved'}, format='json')

        assert res.status_code == 200, res.data
        item.refresh_from_db()
        assert item.status == ReportStatus.RESOLVED
        assert item.resolved_by_id == manager.id
        assert item.resolved_at is not None

    def test_create_ignores_forced_resolved_status_from_client(self):
        user = _make_user()
        client = _auth_client(user)

        res = client.post(
            '/api/feedback-items/',
            {
                'kind': 'feature',
                'section': 'wiki',
                'description': 'Vorrei una nuova funzione',
                'status': 'resolved',
            },
            format='json',
        )

        assert res.status_code == 201, res.data
        assert res.data['status'] == ReportStatus.OPEN

    def test_creator_cannot_reject_without_change_permission(self):
        owner = _make_user()
        item = _make_item(owner)
        client = _auth_client(owner)

        res = client.patch(
            f'/api/feedback-items/{item.id}/',
            {'status': 'rejected', 'rejection_reason': 'Non prioritario'},
            format='json',
        )

        assert res.status_code == 403, res.data
        item.refresh_from_db()
        assert item.status == ReportStatus.OPEN
        assert item.rejected_at is None

    def test_user_with_change_permission_can_reject_with_reason(self):
        owner = _make_user()
        manager = _make_user()
        perm = Permission.objects.get(codename='change_reportrequest')
        manager.user_permissions.add(perm)
        item = _make_item(owner)
        client = _auth_client(manager)

        res = client.patch(
            f'/api/feedback-items/{item.id}/',
            {'status': 'rejected', 'rejection_reason': 'Duplicato di #12'},
            format='json',
        )

        assert res.status_code == 200, res.data
        item.refresh_from_db()
        assert item.status == ReportStatus.REJECTED
        assert item.rejected_by_id == manager.id
        assert item.rejected_at is not None
        assert item.rejection_reason == 'Duplicato di #12'
        assert item.resolved_at is None
        assert item.resolved_by_id is None

    def test_reject_without_reason_is_rejected_by_validation(self):
        owner = _make_user()
        manager = _make_user()
        perm = Permission.objects.get(codename='change_reportrequest')
        manager.user_permissions.add(perm)
        item = _make_item(owner)
        client = _auth_client(manager)

        res = client.patch(f'/api/feedback-items/{item.id}/', {'status': 'rejected'}, format='json')

        assert res.status_code == 400, res.data
        assert 'rejection_reason' in res.data
        item.refresh_from_db()
        assert item.status == ReportStatus.OPEN

    def test_reopening_a_rejected_item_clears_rejection_fields(self):
        owner = _make_user()
        manager = _make_user()
        perm = Permission.objects.get(codename='change_reportrequest')
        manager.user_permissions.add(perm)
        item = _make_item(owner)
        client = _auth_client(manager)

        client.patch(
            f'/api/feedback-items/{item.id}/',
            {'status': 'rejected', 'rejection_reason': 'Non ora'},
            format='json',
        )
        res = client.patch(f'/api/feedback-items/{item.id}/', {'status': 'open'}, format='json')

        assert res.status_code == 200, res.data
        item.refresh_from_db()
        assert item.status == ReportStatus.OPEN
        assert item.rejected_at is None
        assert item.rejected_by_id is None
        assert item.rejection_reason == ''

    def test_status_filter_accepts_comma_separated_values(self):
        owner = _make_user()
        manager = _make_user()
        perm = Permission.objects.get(codename='change_reportrequest')
        manager.user_permissions.add(perm)
        resolved_item = _make_item(owner)
        rejected_item = _make_item(owner)
        open_item = _make_item(owner)
        client = _auth_client(manager)

        client.patch(f'/api/feedback-items/{resolved_item.id}/', {'status': 'resolved'}, format='json')
        client.patch(
            f'/api/feedback-items/{rejected_item.id}/',
            {'status': 'rejected', 'rejection_reason': 'motivo'},
            format='json',
        )

        res = client.get('/api/feedback-items/', {'status': 'resolved,rejected'})

        assert res.status_code == 200, res.data
        returned_ids = {row['id'] for row in res.data['results']}
        assert resolved_item.id in returned_ids
        assert rejected_item.id in returned_ids
        assert open_item.id not in returned_ids
