"""Test di regressione sulla paginazione di default.

Il bug: REST_FRAMEWORK dichiarava PAGE_SIZE_QUERY_PARAM e MAX_PAGE_SIZE, ma DRF
legge dai settings solo PAGE_SIZE — gli altri due sono attributi di classe del
paginatore. Con `rest_framework.pagination.PageNumberPagination` di serie,
`page_size_query_param` restava None e `?page_size=` veniva ignorato: ogni lista
paginata restituiva sempre 25 righe, qualunque cosa chiedesse il frontend.

Questi test bloccano la regressione a livello di paginatore (unitario) e sul
comportamento reale di un endpoint (integrazione).
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.request import Request
from rest_framework.settings import api_settings
from rest_framework.test import APIClient, APIRequestFactory

from core.models import CustomerStatus
from crm.models import Customer

pytestmark = pytest.mark.django_db

User = get_user_model()


# ─── unitari sul paginatore ──────────────────────────────────────────────────

def _paginator():
    return api_settings.DEFAULT_PAGINATION_CLASS()


def test_page_size_query_param_is_enabled():
    """Il cuore del bug: se torna None, ?page_size= è di nuovo ignorato ovunque."""
    assert _paginator().page_size_query_param == "page_size"


def test_max_page_size_is_enforced():
    assert _paginator().max_page_size == 200


@pytest.mark.parametrize(
    "query,expected",
    [
        ("", 25),                  # default
        ("?page_size=50", 50),     # rispettato
        ("?page_size=200", 200),   # al limite
        ("?page_size=2000", 200),  # cappato, non fallisce
        ("?page_size=abc", 25),    # input non valido → default
        ("?page_size=0", 25),      # non positivo → default
    ],
)
def test_get_page_size(query, expected):
    paginator = _paginator()
    request = Request(APIRequestFactory().get("/x/" + query))
    assert paginator.get_page_size(request) == expected


# ─── integrazione su un endpoint reale ───────────────────────────────────────

def _superuser():
    return User.objects.create_superuser(
        username=f"pag_{uuid.uuid4().hex[:6]}", email="p@example.com", password="pw",
    )


@pytest.fixture
def many_customers():
    status = CustomerStatus.objects.get_or_create(
        key="pag_status", defaults={"label": "Active"},
    )[0]
    Customer.objects.bulk_create(
        [Customer(name=f"PagCustomer {i:03d}", status=status) for i in range(60)]
    )


def test_endpoint_defaults_to_25(many_customers):
    client = APIClient()
    client.force_authenticate(user=_superuser())

    resp = client.get("/api/customers/")

    assert resp.status_code == 200
    assert len(resp.data["results"]) == 25


def test_endpoint_honours_page_size(many_customers):
    """Prima di questo fix la risposta conteneva 25 elementi anche chiedendone 50."""
    client = APIClient()
    client.force_authenticate(user=_superuser())

    resp = client.get("/api/customers/", {"page_size": 50})

    assert resp.status_code == 200
    assert len(resp.data["results"]) == 50
    assert resp.data["count"] >= 60  # il totale resta quello vero


def test_endpoint_caps_page_size_at_max(many_customers):
    """page_size oltre il tetto non deve fallire: DRF lo cappa in silenzio."""
    client = APIClient()
    client.force_authenticate(user=_superuser())

    resp = client.get("/api/customers/", {"page_size": 5000})

    assert resp.status_code == 200
    assert len(resp.data["results"]) <= 200
