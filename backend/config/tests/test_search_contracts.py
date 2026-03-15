import pytest
from django.contrib.auth.models import Group, Permission

from crm.models import Contact, Customer, Site
from drive.models import DriveFile, DriveFolder
from inventory.models import Inventory
from maintenance.models import MaintenancePlan
from wiki.models import WikiCategory, WikiPage


@pytest.fixture
def search_dataset(db, customer_status, site_status, inventory_status, inventory_type):
    customer = Customer.objects.create(name="Alpha Industries", status=customer_status)
    site = Site.objects.create(customer=customer, name="HQ", status=site_status)
    contact = Contact.objects.create(customer=customer, name="Alpha Admin", email="alpha@example.com")
    inventory = Inventory.objects.create(
        customer=customer,
        site=site,
        name="Alpha Server",
        hostname="alpha-srv",
        status=inventory_status,
        type=inventory_type,
    )
    plan = MaintenancePlan.objects.create(
        title="Alpha Plan",
        customer=customer,
        schedule_type="interval",
        interval_unit="months",
        interval_value=1,
        next_due_date="2026-04-01",
    )
    category = WikiCategory.objects.create(name="Ops")
    published_page = WikiPage.objects.create(
        title="Alpha Runbook",
        slug="alpha-runbook",
        is_published=True,
        content_markdown="Alpha notes",
        category=category,
    )
    WikiPage.objects.create(
        title="Alpha Draft",
        slug="alpha-draft",
        is_published=False,
        content_markdown="draft",
        category=category,
    )
    folder = DriveFolder.objects.create(name="Alpha Folder")
    file = DriveFile.objects.create(name="Alpha File", folder=folder)
    return {
        "customer": customer,
        "site": site,
        "contact": contact,
        "inventory": inventory,
        "plan": plan,
        "published_page": published_page,
        "folder": folder,
        "file": file,
    }


def _grant(user, codename: str):
    perm = Permission.objects.get(codename=codename)
    user.user_permissions.add(perm)


class TestSearchContracts:
    def test_search_returns_expected_entities_with_path_and_meta(self, api_client, superuser, search_dataset):
        for codename in [
            "view_customer",
            "view_site",
            "view_contact",
            "view_inventory",
            "view_maintenanceplan",
            "view_wikipage",
            "view_drivefolder",
            "view_drivefile",
        ]:
            _grant(superuser, codename)
        api_client.force_authenticate(user=superuser)

        res = api_client.get("/api/search/?q=Alpha&limit=20")
        assert res.status_code == 200
        results = res.json()["results"]
        assert results
        by_kind = {row["kind"]: row for row in results}

        assert by_kind["customer"]["path"] == f"/customers?open={search_dataset['customer'].id}"
        assert by_kind["site"]["path"] == f"/sites?open={search_dataset['site'].id}"
        assert by_kind["contact"]["path"] == f"/contacts?open={search_dataset['contact'].id}"
        assert by_kind["inventory"]["path"] == f"/inventory?open={search_dataset['inventory'].id}"
        assert by_kind["maintenance_plan"]["path"] == f"/maintenance?tab=plans&open={search_dataset['plan'].id}"
        assert by_kind["wiki_page"]["path"] == f"/wiki/{search_dataset['published_page'].id}"
        assert by_kind["drive_file"]["title"] == "Alpha File"
        assert by_kind["drive_folder"]["path"] == "/drive"
        assert "code" in by_kind["customer"]["meta"]
        assert all(r["title"] != "Alpha Draft" for r in results)

    def test_search_hides_drive_results_outside_allowed_groups(self, api_client, superuser, search_dataset):
        restricted = Group.objects.create(name="Restricted")
        outsider = Group.objects.create(name="Outsider")
        folder = search_dataset["folder"]
        file = search_dataset["file"]
        folder.allowed_groups.add(restricted)
        file.allowed_groups.add(restricted)

        superuser.is_superuser = False
        superuser.save(update_fields=["is_superuser"])
        superuser.groups.add(outsider)
        for codename in ["view_drivefolder", "view_drivefile"]:
            _grant(superuser, codename)
        api_client.force_authenticate(user=superuser)

        res = api_client.get("/api/search/?q=Alpha&limit=20")
        assert res.status_code == 200
        kinds = {row["kind"] for row in res.json()["results"]}
        assert "drive_folder" not in kinds
        assert "drive_file" not in kinds

    def test_empty_query_returns_empty_results(self, api_client, superuser):
        api_client.force_authenticate(user=superuser)
        res = api_client.get("/api/search/?q=")
        assert res.status_code == 200
        assert res.json()["results"] == []
