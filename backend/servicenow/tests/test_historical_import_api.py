"""Test di integrazione per gli endpoint dell'import storico ServiceNow
(preview + commit). La logica di mappatura è testata a fondo in
test_historical_import.py; qui verifichiamo il ciclo HTTP: permessi,
risposte, effetti sul DB, assenza di notifiche Teams.
"""
import io
import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from servicenow.models import ServiceNowCase, ServiceNowCaseType, ServiceNowCaseCategory

pytestmark = pytest.mark.django_db

User = get_user_model()

CSV_HEADER = "number,account,opened_at,short_description,priority,assignment_group,assigned_to,sys_tags"


def _csv_file(*lines: str, name: str = "storico.csv") -> SimpleUploadedFile:
    content = "\n".join([CSV_HEADER, *lines]) + "\n"
    return SimpleUploadedFile(name, content.encode("utf-8"), content_type="text/csv")


def _ensure_case_types():
    for name in ["L1", "EBIT", "RIS", "AC", "GEMELLI"]:
        ServiceNowCaseType.objects.get_or_create(category=ServiceNowCaseCategory.PHILIPS, name=name)
    for name in ["L1", "PRIVATI", "CDD"]:
        ServiceNowCaseType.objects.get_or_create(category=ServiceNowCaseCategory.BIOTRON, name=name)


# ─── Preview ──────────────────────────────────────────────────────────────────

def test_preview_requires_file(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    resp = api_client.post("/api/servicenow-cases/import-historical-preview/", {}, format="multipart")
    assert resp.status_code == 400


def test_preview_rejects_csv_missing_required_columns(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    upload = SimpleUploadedFile("bad.csv", b"number,account\nCS1,ACME\n", content_type="text/csv")
    resp = api_client.post(
        "/api/servicenow-cases/import-historical-preview/", {"file": upload}, format="multipart",
    )
    assert resp.status_code == 400
    assert "opened_at" in resp.data["detail"]


def test_preview_does_not_write_to_db(api_client, superuser):
    _ensure_case_types()
    api_client.force_authenticate(user=superuser)
    upload = _csv_file('CS9001,ACME Hospital,03-08-2026 10:00:00,Server down,3 - Moderate,Radiology IIG,,')
    resp = api_client.post(
        "/api/servicenow-cases/import-historical-preview/", {"file": upload}, format="multipart",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["summary"]["to_create"] == 1
    assert not ServiceNowCase.objects.filter(number="CS9001").exists()


def test_preview_maps_category_and_type_correctly(api_client, superuser):
    _ensure_case_types()
    api_client.force_authenticate(user=superuser)
    upload = _csv_file(
        'CS9002,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,,EBIT1',
        'CS9003,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology Italy Biotron,,CDD',
    )
    resp = api_client.post(
        "/api/servicenow-cases/import-historical-preview/", {"file": upload}, format="multipart",
    )
    assert resp.status_code == 200, resp.data
    rows = {r["number"]: r for r in resp.data["rows"]}
    assert rows["CS9002"]["category"] == "philips"
    assert rows["CS9002"]["case_type_name"] == "EBIT"
    assert rows["CS9003"]["category"] == "biotron"
    assert rows["CS9003"]["case_type_name"] == "CDD"


def test_preview_flags_duplicate_against_existing_case(api_client, superuser):
    _ensure_case_types()
    case_type = ServiceNowCaseType.objects.get(category=ServiceNowCaseCategory.PHILIPS, name="L1")
    ServiceNowCase.objects.create(
        number="CS9004", account="ACME", priority="3",
        category=ServiceNowCaseCategory.PHILIPS, case_type=case_type,
    )
    api_client.force_authenticate(user=superuser)
    upload = _csv_file('CS9004,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,,')
    resp = api_client.post(
        "/api/servicenow-cases/import-historical-preview/", {"file": upload}, format="multipart",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["summary"]["duplicates"] == 1
    assert resp.data["rows"][0]["outcome"] == "duplicate"


def test_preview_matches_assigned_to_by_name(api_client, superuser):
    _ensure_case_types()
    User.objects.create_user(username="nspazzoli", first_name="Nicole", last_name="Spazzoli")
    api_client.force_authenticate(user=superuser)
    upload = _csv_file('CS9005,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,Nicole Spazzoli,')
    resp = api_client.post(
        "/api/servicenow-cases/import-historical-preview/", {"file": upload}, format="multipart",
    )
    assert resp.status_code == 200, resp.data
    row = resp.data["rows"][0]
    assert row["assigned_to_label"] == "Nicole Spazzoli"
    assert not row["warnings"]


def test_preview_requires_permission(api_client):
    # Utente autenticato ma senza permesso 'add' su ServiceNowCase.
    user = User.objects.create_user(username=f"u{uuid.uuid4().hex[:6]}", password="x")
    api_client.force_authenticate(user=user)
    upload = _csv_file('CS9006,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,,')
    resp = api_client.post(
        "/api/servicenow-cases/import-historical-preview/", {"file": upload}, format="multipart",
    )
    assert resp.status_code == 403


# ─── Commit ───────────────────────────────────────────────────────────────────

def test_commit_assigns_ac_and_ris_to_fixed_service_users(api_client, superuser):
    _ensure_case_types()
    ac_user = User.objects.create_user(username="ac.philips", first_name="Servizio", last_name="AC")
    ris_user = User.objects.create_user(username="ris.philips", first_name="Servizio", last_name="RIS")
    api_client.force_authenticate(user=superuser)
    upload = _csv_file(
        'CS9201,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG AC,Nome Ignorato Nel Csv,',
        'CS9202,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG RIS,Altro Nome Ignorato,',
    )
    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/import-historical-commit/", {"file": upload}, format="multipart",
        )
    assert resp.status_code == 200, resp.data
    assert resp.data["created"] == 2

    case_ac = ServiceNowCase.objects.get(number="CS9201")
    assert case_ac.case_type.name == "AC"
    assert case_ac.assigned_to_id == ac_user.id

    case_ris = ServiceNowCase.objects.get(number="CS9202")
    assert case_ris.case_type.name == "RIS"
    assert case_ris.assigned_to_id == ris_user.id


def test_commit_ac_without_fixed_user_leaves_unassigned_with_warning(api_client, superuser):
    _ensure_case_types()  # nessun utente ac.philips creato
    api_client.force_authenticate(user=superuser)
    upload = _csv_file('CS9203,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG AC,,')
    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/import-historical-commit/", {"file": upload}, format="multipart",
        )
    assert resp.status_code == 200, resp.data
    assert resp.data["created"] == 1
    case = ServiceNowCase.objects.get(number="CS9203")
    assert case.assigned_to_id is None
    row = resp.data["rows"][0]
    assert any("ac.philips" in w for w in row["warnings"])


def test_commit_creates_cases_and_never_notifies_teams(api_client, superuser):
    _ensure_case_types()
    api_client.force_authenticate(user=superuser)
    upload = _csv_file(
        'CS9101,ACME Hospital,03-08-2026 10:00:00,Server down,3 - Moderate,Radiology IIG,,',
        'CS9102,Fondazione GEMELLI,03-08-2026 11:00:00,PACS down,2 - High,Radiology IIG,,',
    )
    with patch("servicenow.api.notify_teams_new_case") as mock_notify:
        resp = api_client.post(
            "/api/servicenow-cases/import-historical-commit/", {"file": upload}, format="multipart",
        )
    assert resp.status_code == 200, resp.data
    assert resp.data["created"] == 2
    assert mock_notify.call_count == 0  # MAI notifica Teams per l'import storico

    case1 = ServiceNowCase.objects.get(number="CS9101")
    assert case1.category == ServiceNowCaseCategory.PHILIPS
    assert case1.case_type.name == "L1"
    assert case1.status == "open"

    case2 = ServiceNowCase.objects.get(number="CS9102")
    assert case2.case_type.name == "GEMELLI"


def test_commit_skips_existing_duplicate_without_touching_it(api_client, superuser):
    _ensure_case_types()
    case_type = ServiceNowCaseType.objects.get(category=ServiceNowCaseCategory.PHILIPS, name="L1")
    existing = ServiceNowCase.objects.create(
        number="CS9103", account="Original Account", priority="3",
        category=ServiceNowCaseCategory.PHILIPS, case_type=case_type,
    )
    api_client.force_authenticate(user=superuser)
    upload = _csv_file('CS9103,Nuovo Account Dal CSV,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,,')
    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/import-historical-commit/", {"file": upload}, format="multipart",
        )
    assert resp.status_code == 200, resp.data
    assert resp.data["created"] == 0
    existing.refresh_from_db()
    assert existing.account == "Original Account"  # non toccato


def test_commit_partial_success_one_bad_row_does_not_block_others(api_client, superuser):
    _ensure_case_types()
    api_client.force_authenticate(user=superuser)
    upload = _csv_file(
        'CS9104,ACME Hospital,03-08-2026 10:00:00,ok,3 - Moderate,Radiology IIG,,',
        ',Account senza numero,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,,',
    )
    with patch("servicenow.api.notify_teams_new_case"):
        resp = api_client.post(
            "/api/servicenow-cases/import-historical-commit/", {"file": upload}, format="multipart",
        )
    assert resp.status_code == 200, resp.data
    assert resp.data["created"] == 1
    assert ServiceNowCase.objects.filter(number="CS9104").exists()


def test_commit_requires_permission(api_client):
    user = User.objects.create_user(username=f"u{uuid.uuid4().hex[:6]}", password="x")
    api_client.force_authenticate(user=user)
    upload = _csv_file('CS9105,ACME Hospital,03-08-2026 10:00:00,x,3 - Moderate,Radiology IIG,,')
    resp = api_client.post(
        "/api/servicenow-cases/import-historical-commit/", {"file": upload}, format="multipart",
    )
    assert resp.status_code == 403
    assert not ServiceNowCase.objects.filter(number="CS9105").exists()
