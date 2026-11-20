"""Visibilità delle issue per area (spec 2026-11-19, Parte 3): senza il
permesso `issues.view_all_areas` si vedono solo le issue della propria area e
quelle senza area, ovunque (elenco, dettaglio, conteggi, link Wiki)."""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from attendance.models import LeaveArea
from core.models import CustomerStatus, InventoryStatus, InventoryType, SiteStatus, UserProfile
from core.testing import grant_via_group, make_archie_user
from crm.models import Customer, Site
from inventory.models import Inventory
from issues.models import Issue

pytestmark = pytest.mark.django_db

User = get_user_model()
_ids = lambda body: {r["id"] for r in (body["results"] if isinstance(body, dict) else body)}  # noqa: E731


def _area():
    return LeaveArea.objects.create(key=f"a_{uuid.uuid4().hex[:6]}", label="Area")


def _user(area=None, *apps):
    user = make_archie_user(username=f"u_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(*Permission.objects.filter(content_type__app_label__in=("issues", "crm", "inventory", "wiki", *apps)).exclude(codename="view_all_areas"))
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.leave_area = area
    profile.save(update_fields=["leave_area"])
    return User.objects.get(pk=user.pk)


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.fixture
def world():
    """Un cliente con un sito e un inventario; tre issue aperte su quell'inventario:
    una nell'area A, una nell'area B, una senza area."""
    a, b = _area(), _area()
    author = User.objects.create_superuser(username=f"su_{uuid.uuid4().hex[:6]}", password="pw", email="su@example.com")
    k = uuid.uuid4().hex[:6]
    customer = Customer.objects.create(name="Cliente", status=CustomerStatus.objects.get_or_create(key=f"c_{k}", defaults={"label": "A"})[0])
    site = Site.objects.create(customer=customer, name="Sito", status=SiteStatus.objects.get_or_create(key=f"s_{k}", defaults={"label": "A"})[0])
    inv = Inventory.objects.create(
        customer=customer, site=site, name="PC",
        type=InventoryType.objects.get_or_create(key=f"t_{k}", defaults={"label": "T"})[0],
        status=InventoryStatus.objects.get_or_create(key=f"i_{k}", defaults={"label": "A"})[0],
    )
    mk = lambda area, prio="medium": Issue.objects.create(  # noqa: E731
        title=f"Issue {area.label if area else 'senza'}", customer=customer, site=site, inventory=inv,
        created_by=author, area=area, status="open", priority=prio,
    )
    return {"a": a, "b": b, "customer": customer, "site": site, "inv": inv,
            "ia": mk(a), "ib": mk(b, "critical"), "i0": mk(None)}


def test_list_hides_other_area_issues(world):
    ids = _ids(_client(_user(world["a"])).get("/api/issues/").json())
    assert world["ia"].pk in ids and world["i0"].pk in ids
    assert world["ib"].pk not in ids


def test_detail_of_other_area_is_404(world):
    assert _client(_user(world["a"])).get(f"/api/issues/{world['ib'].pk}/").status_code == 404


def test_comments_of_other_area_is_404(world):
    assert _client(_user(world["a"])).get(f"/api/issues/{world['ib'].pk}/comments/").status_code == 404


def test_permission_sees_all_areas(world):
    me = grant_via_group(_user(world["a"]), "issues.view_all_areas")
    ids = _ids(_client(me).get("/api/issues/").json())
    assert {world["ia"].pk, world["ib"].pk, world["i0"].pk} <= ids


def test_superuser_sees_all(world):
    su = User.objects.create_superuser(username="root_vis", password="pw", email="r@example.com")
    ids = _ids(_client(su).get("/api/issues/").json())
    assert {world["ia"].pk, world["ib"].pk, world["i0"].pk} <= ids


def test_user_without_area_sees_all(world):
    ids = _ids(_client(_user(None)).get("/api/issues/").json())
    assert {world["ia"].pk, world["ib"].pk, world["i0"].pk} <= ids


def test_scope_mine_restricts_even_with_permission(world):
    me = grant_via_group(_user(world["a"]), "issues.view_all_areas")
    ids = _ids(_client(me).get("/api/issues/", {"scope": "mine"}).json())
    assert world["ia"].pk in ids and world["i0"].pk in ids
    assert world["ib"].pk not in ids


def test_summary_counts_only_visible(world):
    assert _client(_user(world["a"])).get("/api/issues/summary/").json()["active_count"] == 2


def test_customer_and_site_open_issues_count_only_visible(world):
    c = _client(_user(world["a"]))
    cust = c.get(f"/api/customers/{world['customer'].pk}/").json()
    site = c.get(f"/api/sites/{world['site'].pk}/").json()
    assert cust["open_issues_count"] == 2
    assert site["open_issues_count"] == 2


def test_inventory_active_issue_badge_only_visible(world):
    c = _client(_user(world["a"]))
    # L'unica issue critica è dell'area B: per A la priorità più alta visibile è «medium».
    inv = c.get(f"/api/inventories/{world['inv'].pk}/").json()
    assert inv["has_active_issue"] is True
    assert inv["active_issue_priority"] == "medium"


def test_inventory_active_issue_badge_false_when_only_other_area(world):
    world["ia"].delete()
    world["i0"].delete()
    inv = _client(_user(world["a"])).get(f"/api/inventories/{world['inv'].pk}/").json()
    assert inv["has_active_issue"] is False


def test_wiki_link_label_hides_invisible_issue_title(world):
    from wiki.models import WikiLink, WikiPage
    page = WikiPage.objects.create(title="P", slug=f"p-{uuid.uuid4().hex[:6]}", content_markdown="# P", is_published=True)
    link = WikiLink.objects.create(page=page, entity_type="issue", entity_id=world["ib"].pk)
    data = _client(_user(world["a"])).get(f"/api/wiki-links/{link.pk}/").json()
    assert data["entity_label"] == f"#{world['ib'].pk}"
    assert "Issue" not in data["entity_label"]
