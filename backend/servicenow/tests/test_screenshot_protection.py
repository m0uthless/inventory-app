"""Test per la protezione degli screenshot dei ServiceNow Case.

Prima di questa modifica `screenshot_url` esponeva `obj.screenshot.url`, cioè
/api/media/servicenow_cases/... — un path che nginx serve senza autenticazione.
Ora l'URL punta all'action /api/servicenow-cases/{id}/screenshot/, protetta dai
permessi del ViewSet e servita via X-Accel-Redirect.
"""
import uuid

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from servicenow.models import ServiceNowCase, ServiceNowCaseType, ServiceNowCaseCategory

pytestmark = pytest.mark.django_db


# PNG 1x1 valido: basta a ImageField per accettare l'upload.
_PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06"
    b"\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05"
    b"\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _make_case(with_screenshot=True):
    case_type = ServiceNowCaseType.objects.create(
        category=ServiceNowCaseCategory.BIOTRON, name=f"TT{uuid.uuid4().hex[:8]}"
    )
    case = ServiceNowCase(
        number=f"CS{uuid.uuid4().hex[:8]}",
        account="ACME Hospital",
        priority="3",
        category=ServiceNowCaseCategory.BIOTRON,
        case_type=case_type,
        short_description="Server down",
    )
    if with_screenshot:
        case.screenshot = SimpleUploadedFile("shot.png", _PNG_1X1, content_type="image/png")
    case.save()
    return case


# ─── screenshot_url punta all'action, non a MEDIA_URL ────────────────────────

def test_screenshot_url_points_to_protected_action(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case = _make_case()

    resp = api_client.get(f"/api/servicenow-cases/{case.id}/")

    assert resp.status_code == 200, resp.data
    url = resp.data["screenshot_url"]
    assert url is not None
    assert f"/api/servicenow-cases/{case.id}/screenshot/" in url
    # Il path pubblico di MEDIA_URL non deve più comparire da nessuna parte.
    assert "/api/media/" not in url
    assert "servicenow_cases/screenshots" not in url


def test_screenshot_url_is_null_without_screenshot(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case = _make_case(with_screenshot=False)

    resp = api_client.get(f"/api/servicenow-cases/{case.id}/")

    assert resp.status_code == 200, resp.data
    assert resp.data["screenshot_url"] is None


# ─── l'action richiede autenticazione ────────────────────────────────────────

def test_screenshot_action_requires_authentication(api_client):
    case = _make_case()

    resp = api_client.get(f"/api/servicenow-cases/{case.id}/screenshot/")

    assert resp.status_code in (401, 403)


# ─── l'action serve il file via X-Accel-Redirect ─────────────────────────────

def test_screenshot_action_returns_accel_redirect(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case = _make_case()

    resp = api_client.get(f"/api/servicenow-cases/{case.id}/screenshot/")

    assert resp.status_code == 200
    # Django non fa da proxy ai byte: delega a nginx.
    assert resp["X-Accel-Redirect"].startswith("/protected_media/")
    assert case.screenshot.name in resp["X-Accel-Redirect"]
    # inline: il frontend lo mostra in un <img>
    assert resp["Content-Disposition"].startswith("inline")
    assert resp.content == b""


def test_screenshot_action_404_when_no_screenshot(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    case = _make_case(with_screenshot=False)

    resp = api_client.get(f"/api/servicenow-cases/{case.id}/screenshot/")

    assert resp.status_code == 404


# ─── lo screenshot resta accessibile per i case nel cestino ──────────────────

def test_screenshot_accessible_for_soft_deleted_case(api_client, superuser):
    """Un case soft-deleted è ancora visibile nella vista "eliminati": lo
    screenshot deve continuare a caricarsi, altrimenti il drawer del cestino
    mostrerebbe un'immagine rotta. Regressione attesa se l'action usasse
    self.get_object(), che applica i filtri di soft-delete.
    """
    api_client.force_authenticate(user=superuser)
    case = _make_case()

    assert api_client.delete(f"/api/servicenow-cases/{case.id}/").status_code == 204
    case.refresh_from_db()
    assert case.deleted_at is not None

    resp = api_client.get(f"/api/servicenow-cases/{case.id}/screenshot/")

    assert resp.status_code == 200
    assert resp["X-Accel-Redirect"].startswith("/protected_media/")
