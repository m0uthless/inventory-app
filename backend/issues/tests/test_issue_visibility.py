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


def _wiki_link(issue, notes=""):
    from wiki.models import WikiLink, WikiPage
    page = WikiPage.objects.create(title="P", slug=f"p-{uuid.uuid4().hex[:6]}", content_markdown="# P", is_published=True)
    return WikiLink.objects.create(page=page, entity_type="issue", entity_id=issue.pk, notes=notes)


def test_wiki_links_list_hides_links_to_invisible_issues(world):
    visible, hidden = _wiki_link(world["ia"]), _wiki_link(world["ib"], notes="segreto")
    ids = _ids(_client(_user(world["a"])).get("/api/wiki-links/?entity_type=issue").json())
    assert visible.pk in ids
    assert hidden.pk not in ids


def test_wiki_link_detail_of_invisible_issue_is_404(world):
    link = _wiki_link(world["ib"])
    assert _client(_user(world["a"])).get(f"/api/wiki-links/{link.pk}/").status_code == 404


def test_wiki_links_of_invisible_issue_visible_with_permission(world):
    link = _wiki_link(world["ib"])
    user = _user(world["a"])
    user.user_permissions.add(Permission.objects.get(content_type__app_label="issues", codename="view_all_areas"))
    user = User.objects.get(pk=user.pk)
    assert link.pk in _ids(_client(user).get("/api/wiki-links/").json())


def test_wiki_links_to_other_entities_unaffected(world):
    from wiki.models import WikiLink, WikiPage
    page = WikiPage.objects.create(title="P", slug=f"p-{uuid.uuid4().hex[:6]}", content_markdown="# P", is_published=True)
    link = WikiLink.objects.create(page=page, entity_type="customer", entity_id=world["customer"].pk)
    assert link.pk in _ids(_client(_user(world["a"])).get("/api/wiki-links/").json())


def test_wiki_link_restore_of_invisible_issue_is_404(world):
    from django.utils import timezone
    link = _wiki_link(world["ib"])
    link.deleted_at = timezone.now()
    link.save(update_fields=["deleted_at"])
    resp = _client(_user(world["a"])).post(f"/api/wiki-links/{link.pk}/restore/")
    assert resp.status_code == 404
    link.refresh_from_db()
    assert link.deleted_at is not None


def test_wiki_link_label_without_user_hides_issue_title(world):
    from wiki.api.helpers import _label_for_wiki_link
    assert _label_for_wiki_link("issue", world["ib"].pk, None) == f"#{world['ib'].pk}"


def test_audit_events_hide_invisible_issues(world):
    from audit.utils import log_event
    me = _user(world["a"], "audit")
    for issue in (world["ia"], world["ib"], world["i0"]):
        log_event(actor=None, action="update", instance=issue, changes={"status": {"from": "open", "to": "in_progress"}})
    body = _client(me).get("/api/audit-events/", {"app_label": "issues", "model": "issue"}).json()
    seen = {r["object_id"] for r in (body["results"] if isinstance(body, dict) else body)}
    assert str(world["ia"].pk) in seen and str(world["i0"].pk) in seen
    assert str(world["ib"].pk) not in seen


def test_audit_events_all_issues_with_permission(world):
    from audit.utils import log_event
    me = grant_via_group(_user(world["a"], "audit"), "issues.view_all_areas")
    log_event(actor=None, action="update", instance=world["ib"], changes={"status": {"from": "open", "to": "in_progress"}})
    body = _client(me).get("/api/audit-events/", {"app_label": "issues", "model": "issue"}).json()
    assert str(world["ib"].pk) in {r["object_id"] for r in (body["results"] if isinstance(body, dict) else body)}


# ── Menu «Area» della pagina Issue ────────────────────────────────────────────

def test_filter_no_area(world):
    su = User.objects.create_superuser(username="root_na", password="pw", email="na@example.com")
    ids = _ids(_client(su).get("/api/issues/", {"no_area": "true"}).json())
    assert world["i0"].pk in ids
    assert world["ia"].pk not in ids and world["ib"].pk not in ids


def test_summary_by_area_id(world):
    su = User.objects.create_superuser(username="root_sa", password="pw", email="sa@example.com")
    assert _client(su).get("/api/issues/summary/", {"area": world["b"].pk}).json()["active_count"] == 1


def test_summary_without_area(world):
    su = User.objects.create_superuser(username="root_sn", password="pw", email="sn@example.com")
    assert _client(su).get("/api/issues/summary/", {"area": "none"}).json()["active_count"] == 1


def test_summary_by_area_still_respects_visibility(world):
    me = _user(world["a"])
    assert _client(me).get("/api/issues/summary/", {"area": world["b"].pk}).json()["active_count"] == 0


# ── Test mancanti (revisione 20/11) ──

def test_customer_active_issue_count_ignores_other_area(world):
    c = _client(_user(world["a"]))
    assert c.get(f"/api/customers/{world['customer'].pk}/").json()["active_issue_count"] == 1
    world["ia"].delete()
    world["i0"].delete()
    assert c.get(f"/api/customers/{world['customer'].pk}/").json()["active_issue_count"] == 0


def test_customers_summary_counts_only_visible(world):
    data = _client(_user(world["a"])).get("/api/customers/summary/").json()
    assert data["open_issues"] == 2
    assert data["top_open_issues"]["count"] == 2


def test_sites_summary_counts_only_visible(world):
    data = _client(_user(world["a"])).get("/api/sites/summary/").json()
    assert data["open_issues"] == 2
    assert data["top_open_issues_list"][0]["count"] == 2


def test_inventories_summary_priority_only_visible(world):
    data = _client(_user(world["a"])).get("/api/inventories/summary/").json()
    assert data["with_issue"] == 1
    assert data["issue_priority"]["critical"] == 0
    assert data["issue_priority"]["medium"] == 1


def test_superuser_with_area_in_profile_sees_all(world):
    su = User.objects.create_superuser(username=f"su_{uuid.uuid4().hex[:6]}", password="pw", email="su2@example.com")
    profile, _ = UserProfile.objects.get_or_create(user=su)
    profile.leave_area = world["a"]
    profile.save(update_fields=["leave_area"])
    su = User.objects.get(pk=su.pk)
    c = _client(su)
    ids = _ids(c.get("/api/issues/").json())
    assert {world["ia"].pk, world["ib"].pk, world["i0"].pk} <= ids
    assert c.get(f"/api/issues/{world['ib'].pk}/").json()["can_edit"] is True
    assert c.get(f"/api/customers/{world['customer'].pk}/").json()["open_issues_count"] == 3
