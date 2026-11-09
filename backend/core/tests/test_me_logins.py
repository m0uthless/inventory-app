import pytest
from django.contrib.auth import get_user_model

from audit.models import AuthAttempt

pytestmark = pytest.mark.django_db


def test_me_has_last_login_and_date_joined(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    data = api_client.get("/api/me/").json()
    assert "last_login" in data and data["date_joined"]


def test_me_logins_only_own_successful_attempts(api_client, superuser):
    other = get_user_model().objects.create_user(username="altro", password="x")
    AuthAttempt.objects.create(username=superuser.username, success=True, ip="10.0.0.1", user_agent="Firefox")
    AuthAttempt.objects.create(username=superuser.username, success=False, ip="10.0.0.2")
    AuthAttempt.objects.create(username=other.username, success=True, ip="10.0.0.3")
    for i in range(6):
        AuthAttempt.objects.create(username=superuser.username.upper(), success=True, ip=f"10.0.1.{i}")

    api_client.force_authenticate(user=superuser)
    res = api_client.get("/api/me/logins/")
    assert res.status_code == 200
    ips = [r["ip"] for r in res.json()]
    assert len(ips) == 5
    assert "10.0.0.2" not in ips and "10.0.0.3" not in ips


def test_me_logins_requires_login(api_client):
    assert api_client.get("/api/me/logins/").status_code in (401, 403)
