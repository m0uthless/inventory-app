from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from core.models import CustomerStatus, SiteStatus
from crm.models import Customer, Site
from device.models import Device, DeviceStatus, DeviceType, DeviceWifi

pytestmark = pytest.mark.django_db


def _superuser():
    User = get_user_model()
    import uuid
    return User.objects.create_superuser(
        username=f"device_upload_{uuid.uuid4().hex[:6]}",
        email="a@example.com",
        password="pw",
    )


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _wifi_detail(user):
    customer_status = CustomerStatus.objects.get_or_create(key='device_upload_cs', defaults={'label': 'Active'})[0]
    site_status = SiteStatus.objects.get_or_create(key='device_upload_ss', defaults={'label': 'Active'})[0]
    device_status = DeviceStatus.objects.get_or_create(name='Attivo upload')[0]
    device_type = DeviceType.objects.get_or_create(name='Modalita upload')[0]
    customer = Customer.objects.create(name='DeviceUpload', status=customer_status)
    site = Site.objects.create(customer=customer, name='HQ', status=site_status)
    device = Device.objects.create(
        customer=customer,
        site=site,
        type=device_type,
        status=device_status,
        wifi=True,
        created_by=user,
        updated_by=user,
    )
    return DeviceWifi.objects.create(device=device)


def test_device_wifi_rejects_invalid_certificate_extension():
    user = _superuser()
    client = _auth_client(user)
    wifi = _wifi_detail(user)

    res = client.patch(
        f'/api/device-wifi/{wifi.id}/',
        {'certificato': SimpleUploadedFile('cert.txt', b'not-a-cert', content_type='text/plain')},
        format='multipart',
    )

    assert res.status_code == 400, res.data
    assert 'certificato' in res.data


def test_device_wifi_accepts_valid_p12_upload():
    user = _superuser()
    client = _auth_client(user)
    wifi = _wifi_detail(user)

    res = client.patch(
        f'/api/device-wifi/{wifi.id}/',
        {'certificato': SimpleUploadedFile('cert.p12', b'fake-cert-bytes', content_type='application/x-pkcs12')},
        format='multipart',
    )

    assert res.status_code == 200, res.data
