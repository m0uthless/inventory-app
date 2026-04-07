from __future__ import annotations

import uuid

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
    return User.objects.create_superuser(
        username=f"device_media_{uuid.uuid4().hex[:6]}",
        email="a@example.com",
        password="pw",
    )


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def test_device_wifi_certificato_uses_protected_api_url_and_x_accel_redirect():
    user = _superuser()
    client = _auth_client(user)

    customer_status = CustomerStatus.objects.get_or_create(key='device_media_cs', defaults={'label': 'Active'})[0]
    site_status = SiteStatus.objects.get_or_create(key='device_media_ss', defaults={'label': 'Active'})[0]
    device_status = DeviceStatus.objects.get_or_create(name='Attivo')[0]
    device_type = DeviceType.objects.get_or_create(name='Modalita')[0]

    customer = Customer.objects.create(name='DeviceMedia', status=customer_status)
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
    wifi = DeviceWifi.objects.create(
        device=device,
        certificato=SimpleUploadedFile('cert.p12', b'fake-cert', content_type='application/x-pkcs12'),
    )

    detail = client.get(f'/api/device-wifi/{wifi.id}/')
    assert detail.status_code == 200, detail.data
    assert detail.data['certificato_url'].endswith(f'/api/device-wifi/{wifi.id}/certificato/')
    assert '/api/media/device_wifi/' not in detail.data['certificato_url']

    download = client.get(f'/api/device-wifi/{wifi.id}/certificato/')
    assert download.status_code == 200
    assert download['X-Accel-Redirect'].startswith('/protected_media/device_wifi/')
    assert download['Content-Disposition'].startswith('attachment;')
