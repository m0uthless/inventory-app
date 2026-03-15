import json

import pytest
from django.core.cache import cache
from django.test import Client, override_settings


@pytest.fixture(autouse=True)
def clear_auth_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
@override_settings(
    AUTH_LOGIN_FAILURE_LIMIT=3,
    AUTH_LOGIN_IP_FAILURE_LIMIT=10,
    AUTH_LOGIN_WINDOW_SECONDS=60,
)
def test_login_rate_limit_blocks_after_threshold(superuser):
    client = Client(enforce_csrf_checks=True)
    client.get('/api/auth/csrf/')
    csrftoken = client.cookies['csrftoken'].value

    payload = json.dumps({'username': superuser.username, 'password': 'wrong-password'})
    headers = {'content_type': 'application/json', 'HTTP_X_CSRFTOKEN': csrftoken}

    first = client.post('/api/auth/login/', payload, **headers)
    second = client.post('/api/auth/login/', payload, **headers)
    third = client.post('/api/auth/login/', payload, **headers)
    fourth = client.post('/api/auth/login/', payload, **headers)

    assert first.status_code == 401
    assert second.status_code == 401
    assert third.status_code == 401
    assert fourth.status_code == 429
    assert fourth.json()['detail'] == 'Too many failed login attempts. Retry later.'


@pytest.mark.django_db
@override_settings(
    AUTH_LOGIN_FAILURE_LIMIT=2,
    AUTH_LOGIN_IP_FAILURE_LIMIT=10,
    AUTH_LOGIN_WINDOW_SECONDS=60,
)
def test_successful_login_resets_rate_limit_counter(superuser):
    client = Client(enforce_csrf_checks=True)
    client.get('/api/auth/csrf/')
    csrftoken = client.cookies['csrftoken'].value
    headers = {'content_type': 'application/json', 'HTTP_X_CSRFTOKEN': csrftoken}

    bad_payload = json.dumps({'username': superuser.username, 'password': 'wrong-password'})
    good_payload = json.dumps({'username': superuser.username, 'password': 'admin'})

    assert client.post('/api/auth/login/', bad_payload, **headers).status_code == 401
    assert client.post('/api/auth/login/', good_payload, **headers).status_code == 200

    refreshed_headers = {
        'content_type': 'application/json',
        'HTTP_X_CSRFTOKEN': client.cookies['csrftoken'].value,
    }
    assert client.post('/api/auth/login/', bad_payload, **refreshed_headers).status_code == 401
