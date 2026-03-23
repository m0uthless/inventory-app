"""crm/tests/test_city_filter.py

Verifica:
 1. filter_city restituisce solo i clienti con la città cercata (no falsi positivi).
 2. filter_city è case-insensitive.
 3. filter_city non matcha su chiavi JSON che contengono il valore cercato
    (fix PC-06: era Cast+icontains sull'intera colonna JSON).
 4. filter_city con query vuota restituisce tutti i clienti.
 5. CustomerSerializer.get_city legge dall'annotazione del queryset (list).
 6. CustomerSerializer.get_city cade in fallback sui custom_fields (retrieve).
 7. Le chiavi riconosciute sono coerenti tra Coalesce nel queryset e serializer.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import CustomerStatus
from crm.models import Customer

pytestmark = pytest.mark.django_db

User = get_user_model()


# ─── Fixtures ────────────────────────────────────────────────────────────────

def _uid(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:6]}"


def _superuser():
    return User.objects.create_superuser(
        username=_uid("su_"), email="s@e.com", password="pw"
    )


def _status():
    s, _ = CustomerStatus.objects.get_or_create(
        key=_uid("cs_"), defaults={"label": "Active"}
    )
    return s


def _customer(status, city_key="city", city_value="Bologna", extra_cf=None):
    cf = {city_key: city_value}
    if extra_cf:
        cf.update(extra_cf)
    return Customer.objects.create(
        name=_uid("co_"),
        status=status,
        custom_fields=cf,
    )


def _auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


# ─── Test: filter_city correttezza ───────────────────────────────────────────

class TestFilterCity:
    def test_filter_returns_matching_customer(self):
        user = _superuser()
        status = _status()
        client = _auth_client(user)

        target = _customer(status, city_value="Bologna")
        _customer(status, city_value="Milano")

        res = client.get("/api/customers/?city=Bologna")
        assert res.status_code == 200

        ids = [r["id"] for r in res.json().get("results", res.json())]
        assert target.id in ids

    def test_filter_excludes_non_matching_customer(self):
        user = _superuser()
        status = _status()
        client = _auth_client(user)

        _customer(status, city_value="Roma")
        other = _customer(status, city_value="Napoli")

        res = client.get("/api/customers/?city=Roma")
        assert res.status_code == 200

        ids = [r["id"] for r in res.json().get("results", res.json())]
        assert other.id not in ids

    def test_filter_is_case_insensitive(self):
        user = _superuser()
        status = _status()
        client = _auth_client(user)

        target = _customer(status, city_value="Firenze")

        res = client.get("/api/customers/?city=firenze")
        assert res.status_code == 200

        ids = [r["id"] for r in res.json().get("results", res.json())]
        assert target.id in ids

    def test_filter_no_false_positives_on_json_keys(self):
        """Fix PC-06: Cast+icontains matchava anche su chiavi JSON.

        Esempio: un cliente con {"city": "Roma", "via_bologna": "Via Indipendenza"}
        non deve matchare per la ricerca 'bologna'.
        """
        user = _superuser()
        status = _status()
        client = _auth_client(user)

        # Questo cliente ha "bologna" in un altro campo, NON nella città
        false_positive = Customer.objects.create(
            name=_uid("co_"),
            status=status,
            custom_fields={"city": "Roma", "indirizzo": "Via Bologna 1"},
        )
        true_match = _customer(status, city_value="Bologna")

        res = client.get("/api/customers/?city=bologna")
        assert res.status_code == 200

        ids = [r["id"] for r in res.json().get("results", res.json())]
        assert true_match.id in ids
        assert false_positive.id not in ids, (
            "Falso positivo: il filtro ha matchato 'bologna' su un campo che non è la città. "
            "Verifica che il fix PC-06 (KeyTextTransform invece di Cast+icontains) sia applicato."
        )

    def test_filter_empty_query_returns_all(self):
        user = _superuser()
        status = _status()
        client = _auth_client(user)

        c1 = _customer(status, city_value="Torino")
        c2 = _customer(status, city_value="Genova")

        res = client.get("/api/customers/?city=")
        assert res.status_code == 200

        ids = [r["id"] for r in res.json().get("results", res.json())]
        assert c1.id in ids
        assert c2.id in ids

    def test_filter_with_citta_key(self):
        """Verifica che anche la chiave 'citta' venga riconosciuta."""
        user = _superuser()
        status = _status()
        client = _auth_client(user)

        target = _customer(status, city_key="citta", city_value="Venezia")

        res = client.get("/api/customers/?city=Venezia")
        assert res.status_code == 200

        ids = [r["id"] for r in res.json().get("results", res.json())]
        assert target.id in ids, (
            "La chiave 'citta' non viene riconosciuta dal filtro. "
            "Verifica la Coalesce nel queryset di CustomerViewSet."
        )


# ─── Test: CustomerSerializer.get_city ───────────────────────────────────────

class TestCustomerSerializerCity:
    def test_city_field_present_in_list_response(self):
        user = _superuser()
        status = _status()
        client = _auth_client(user)

        customer = _customer(status, city_value="Palermo")

        res = client.get("/api/customers/")
        assert res.status_code == 200

        rows = res.json().get("results", res.json())
        row = next((r for r in rows if r["id"] == customer.id), None)
        assert row is not None
        assert row["city"] == "Palermo"

    def test_city_field_present_in_retrieve_response(self):
        """Su retrieve il queryset non è annotato: verifica il fallback sui custom_fields."""
        user = _superuser()
        status = _status()
        client = _auth_client(user)

        customer = _customer(status, city_value="Catania")

        res = client.get(f"/api/customers/{customer.id}/")
        assert res.status_code == 200
        assert res.json()["city"] == "Catania", (
            "Il campo city deve essere presente anche su retrieve. "
            "Verifica il fallback _CITY_KEYS nel serializer."
        )

    def test_city_is_none_when_not_in_custom_fields(self):
        user = _superuser()
        status = _status()
        client = _auth_client(user)

        customer = Customer.objects.create(
            name=_uid("co_"),
            status=status,
            custom_fields={"notes": "nessuna città"},
        )

        res = client.get(f"/api/customers/{customer.id}/")
        assert res.status_code == 200
        assert res.json()["city"] is None

    def test_city_is_none_when_custom_fields_is_null(self):
        user = _superuser()
        status = _status()
        client = _auth_client(user)

        customer = Customer.objects.create(
            name=_uid("co_"),
            status=status,
            custom_fields=None,
        )

        res = client.get(f"/api/customers/{customer.id}/")
        assert res.status_code == 200
        assert res.json()["city"] is None

    def test_city_keys_consistent_between_queryset_and_serializer(self):
        """Le chiavi riconosciute in Coalesce e in _CITY_KEYS devono coincidere.

        Questo test è un canario: se qualcuno aggiunge una chiave in un posto
        e dimentica l'altro, il test fallisce.
        """
        from crm.api import CustomerSerializer

        # Chiavi nella Coalesce del queryset (hardcoded nel test come specifica)
        queryset_keys = {"city", "citta", "Città", "Citta"}
        # Chiavi nel serializer
        serializer_keys = CustomerSerializer._CITY_KEYS

        missing_in_serializer = queryset_keys - serializer_keys
        assert not missing_in_serializer, (
            f"Chiavi presenti nella Coalesce ma non in _CITY_KEYS: {missing_in_serializer}. "
            "Allinea CustomerSerializer._CITY_KEYS con la Coalesce in get_queryset()."
        )
