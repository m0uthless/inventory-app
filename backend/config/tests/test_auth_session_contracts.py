import json

import pytest


@pytest.mark.django_db
class TestAuthSessionContracts:
    def test_csrf_endpoint_sets_cookie(self, client):
        res = client.get('/api/auth/csrf/')

        assert res.status_code == 200
        assert res.json()['detail'] == 'ok'
        assert 'csrftoken' in res.cookies

    def test_successful_login_returns_ok_and_creates_session(self, client, superuser):
        res = client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'admin', 'password': 'admin'}),
            content_type='application/json',
        )

        assert res.status_code == 200
        assert res.json()['detail'] == 'ok'
        assert '_auth_user_id' in client.session
        assert str(client.session['_auth_user_id']) == str(superuser.pk)

    def test_logout_returns_ok_and_clears_session(self, client, superuser):
        client.force_login(superuser)
        assert '_auth_user_id' in client.session

        res = client.post('/api/auth/logout/')

        assert res.status_code == 200
        assert res.json()['detail'] == 'ok'
        assert '_auth_user_id' not in client.session
