"""Test di regressione per il fix 0.9.1 (WP-04, archie-realiplimit —
audit 2026-08-19, SEC-007): il rate-limit di login per IP usava
REMOTE_ADDR grezzo, che dietro backend_nginx (proxy_pass) è sempre l'IP
del container nginx stesso, non del client reale — il rate-limit era di
fatto un unico bucket condiviso da tutti gli utenti, indipendentemente
dal loro IP.

Copre:
- _client_ip() preferisce X-Real-IP quando presente (impostato in modo
  affidabile da nginx dopo real_ip_module, vedi nginx/backend.conf);
- fallback su REMOTE_ADDR quando X-Real-IP non è presente (dev locale
  senza nginx davanti, o richieste dirette in test);
- il rate-limit per IP distingue correttamente due IP diversi via
  X-Real-IP, invece di trattarli come lo stesso client.
"""
import pytest
from django.core.cache import cache

from config.auth_views import _client_ip

pytestmark = pytest.mark.django_db


class TestClientIpHelper:
    def test_prefers_x_real_ip_over_remote_addr(self, rf):
        request = rf.post("/api/auth/login/")
        request.META["REMOTE_ADDR"] = "172.19.0.5"  # IP del container nginx
        request.META["HTTP_X_REAL_IP"] = "203.0.113.42"  # IP reale del client
        assert _client_ip(request) == "203.0.113.42"

    def test_falls_back_to_remote_addr_without_x_real_ip(self, rf):
        request = rf.post("/api/auth/login/")
        request.META["REMOTE_ADDR"] = "127.0.0.1"
        request.META.pop("HTTP_X_REAL_IP", None)
        assert _client_ip(request) == "127.0.0.1"

    def test_unknown_when_nothing_available(self, rf):
        request = rf.post("/api/auth/login/")
        request.META.pop("REMOTE_ADDR", None)
        request.META.pop("HTTP_X_REAL_IP", None)
        assert _client_ip(request) == "unknown"


def test_login_rate_limit_distinguishes_real_client_ips_via_x_real_ip(client, settings):
    """Riproduce lo scenario del bug: due 'client' diversi (via X-Real-IP)
    non devono condividere lo stesso contatore di rate-limit, anche se il
    REMOTE_ADDR visto da Django è identico per entrambi (come succede
    sempre dietro backend_nginx)."""
    cache.clear()
    # Isola il limite per IP: disabilita quello per username (altrimenti
    # scatterebbe prima, dato che ogni tentativo qui usa lo stesso
    # username "ghost") e abbassa la soglia IP per un test rapido.
    settings.AUTH_LOGIN_FAILURE_LIMIT = 0
    settings.AUTH_LOGIN_IP_FAILURE_LIMIT = 3

    def attempt(real_ip: str):
        return client.post(
            "/api/auth/login/",
            data='{"username":"ghost","password":"wrong-password"}',
            content_type="application/json",
            REMOTE_ADDR="172.19.0.5",  # sempre lo stesso: IP del proxy nginx
            HTTP_X_REAL_IP=real_ip,
        )

    # Esaurisce il limite per IP per il client A (i primi tentativi
    # rispondono 401, l'ultimo/successivi diventano 429).
    ip_limit_hit = False
    for _ in range(10):
        res = attempt("203.0.113.10")
        if res.status_code == 429:
            ip_limit_hit = True
            break
    assert ip_limit_hit, "il rate-limit per IP dovrebbe scattare per il client A dopo N tentativi"

    # Il client B, con un X-Real-IP diverso, non deve essere bloccato dal
    # limite già raggiunto dal client A.
    res_b = attempt("203.0.113.99")
    assert res_b.status_code != 429
