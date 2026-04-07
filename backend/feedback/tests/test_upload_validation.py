from __future__ import annotations

import io
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from feedback.models import ReportRequest

pytestmark = pytest.mark.django_db


def _make_user():
    User = get_user_model()
    suffix = uuid.uuid4().hex[:6]
    return User.objects.create_user(username=f"fb_val_{suffix}", password="pw")


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (2, 2), color=(12, 34, 56))
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_feedback_rejects_non_image_screenshot_upload():
    owner = _make_user()
    item = ReportRequest.objects.create(
        kind='bug',
        status='open',
        section='inventory',
        description='Segnalazione con allegato non valido',
        created_by=owner,
    )
    client = _auth_client(owner)

    res = client.patch(
        f'/api/feedback-items/{item.id}/',
        {'screenshot': SimpleUploadedFile('malware.exe', b'MZ-not-allowed', content_type='application/x-msdownload')},
        format='multipart',
    )

    assert res.status_code == 400, res.data
    assert 'screenshot' in res.data


def test_feedback_accepts_valid_png_screenshot_upload():
    owner = _make_user()
    item = ReportRequest.objects.create(
        kind='bug',
        status='open',
        section='inventory',
        description='Segnalazione con screenshot valido',
        created_by=owner,
    )
    client = _auth_client(owner)

    res = client.patch(
        f'/api/feedback-items/{item.id}/',
        {'screenshot': SimpleUploadedFile('screen.png', _png_bytes(), content_type='image/png')},
        format='multipart',
    )

    assert res.status_code == 200, res.data
    item.refresh_from_db()
    assert bool(item.screenshot)
