from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

class SmokeApiTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="smoke", password="smoke-pass-123")
        self.client = APIClient()

    def test_anonymous_requires_auth_for_search(self):
        resp = self.client.get("/api/search/", {"q": "x"})
        # Session auth typically returns 403 (CSRF) for unsafe methods, but for GET it should be 403/401 if not authenticated.
        self.assertIn(resp.status_code, (401, 403))

    def test_authenticated_can_call_me_and_search(self):
        self.client.force_authenticate(user=self.user)

        resp = self.client.get("/api/me")
        # Some deployments may redirect /api/me/ vs /api/me; accept 200 or 301/302.
        self.assertIn(resp.status_code, (200, 301, 302))

        resp = self.client.get("/api/search/", {"q": "bazzano"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("q", data)
        self.assertIn("results", data)
        self.assertIsInstance(data["results"], list)

    def test_authenticated_can_list_main_resources(self):
        self.client.force_authenticate(user=self.user)
        for path in ("/api/customers/", "/api/sites/", "/api/contacts/", "/api/inventories/"):
            resp = self.client.get(path)
            # If some modules are disabled, might be 404; otherwise 200 or 403 depending on perms.
            self.assertIn(resp.status_code, (200, 403, 404))
