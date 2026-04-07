from __future__ import annotations

import io
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from feedback.models import ReportRequest, ReportStatus

pytestmark = pytest.mark.django_db


def _make_superuser():
    User = get_user_model()
    suffix = uuid.uuid4().hex[:6]
    user = User.objects.create_user(username=f"fb_media_{suffix}", password="pw")
    user.is_staff = True
    user.is_superuser = True
    user.save(update_fields=["is_staff", "is_superuser"])
    return user




def _png_bytes() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (2, 2), color=(50, 60, 70))
    img.save(buf, format="PNG")
    return buf.getvalue()


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def test_feedback_screenshot_uses_protected_api_url_and_x_accel_redirect():
    user = _make_superuser()
    item = ReportRequest.objects.create(
        kind='bug',
        status=ReportStatus.OPEN,
        section='inventory',
        description='Segnalazione con screenshot',
        created_by=user,
        screenshot=SimpleUploadedFile('screen.png', _png_bytes(), content_type='image/png'),
    )
    client = _auth_client(user)

    detail = client.get(f'/api/feedback-items/{item.id}/')
    assert detail.status_code == 200, detail.data
    assert detail.data['screenshot_url'].endswith(f'/api/feedback-items/{item.id}/screenshot/')
    assert '/api/media/report_request_screenshots/' not in detail.data['screenshot_url']

    preview = client.get(f'/api/feedback-items/{item.id}/screenshot/')
    assert preview.status_code == 200
    assert preview['X-Accel-Redirect'].startswith('/protected_media/report_request_screenshots/')
    assert preview['Content-Disposition'].startswith('inline;')
