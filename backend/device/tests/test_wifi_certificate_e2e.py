"""Test end-to-end per il flusso di upload del certificato WiFi (.p12):
- creazione completa via multipart (device + ip + mac + certificato + password + scadenza)
- cifratura at-rest della password (Fernet, prefisso enc::) e decifratura in lettura
- idempotenza della cifratura su update parziali (niente doppia cifratura)
- limiti di dimensione e content-type
- download del certificato via endpoint protetto
- soft-delete/restore
- permessi (matrice reale view/add/change/delete_devicewifi via AuslBoModelPermissions)
- fix 2.4: pass_certificato nascosta senza device.view_wifi_secrets, scope tenant

Segue le convenzioni già in uso in device/tests/ (helper locali, non le
fixture del conftest.py di root, dato che questo modulo usa SQLite in-memory
tramite device/tests/conftest.py).
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from core.crypto import decrypt, is_encrypted
from core.models import CustomerStatus, SiteStatus
from crm.models import Customer, Site
from device.api import WIFI_CERT_MAX_BYTES
from device.models import Device, DeviceStatus, DeviceType, DeviceWifi

pytestmark = pytest.mark.django_db

User = get_user_model()


def _superuser():
    return User.objects.create_superuser(
        username=f"wifi_e2e_{uuid.uuid4().hex[:6]}", email="a@example.com", password="pw",
    )


def _internal_user(*, can_edit: bool):
    user = User.objects.create_user(username=f"wifi_internal_{uuid.uuid4().hex[:6]}", password="pw")
    user.user_permissions.add(Permission.objects.get(codename="access_archie"))
    if can_edit:
        codenames = ["view_devicewifi", "add_devicewifi", "change_devicewifi", "delete_devicewifi"]
        user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return user


def _auslbo_user(customer, *, can_edit: bool = False, can_view_secrets: bool = False):
    """Utente portale AUSL BO associato al customer indicato (fix 2.4:
    DeviceWifiViewSet ora rispetta lo scope tenant)."""
    from auslbo.models import AuslBoUserProfile

    user = User.objects.create_user(username=f"wifi_auslbo_{uuid.uuid4().hex[:6]}", password="pw")
    AuslBoUserProfile.objects.create(user=user, customer=customer)
    codenames = []
    if can_edit:
        codenames += ["view_devicewifi", "add_devicewifi", "change_devicewifi", "delete_devicewifi"]
    if can_view_secrets:
        codenames.append("view_wifi_secrets")
    if codenames:
        user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return user


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _make_device(user, *, suffix="a", wifi=True):
    customer_status = CustomerStatus.objects.get_or_create(
        key=f"wifi_e2e_cs_{suffix}", defaults={"label": "Active"},
    )[0]
    site_status = SiteStatus.objects.get_or_create(
        key=f"wifi_e2e_ss_{suffix}", defaults={"label": "Active"},
    )[0]
    device_status = DeviceStatus.objects.get_or_create(name=f"Attivo_wifi_e2e_{suffix}")[0]
    device_type = DeviceType.objects.get_or_create(name=f"Modalita_wifi_e2e_{suffix}")[0]
    customer = Customer.objects.create(name=f"WifiE2E_{suffix}", status=customer_status)
    site = Site.objects.create(customer=customer, name="HQ", status=site_status)
    return Device.objects.create(
        customer=customer, site=site, type=device_type, status=device_status,
        wifi=wifi, created_by=user, updated_by=user,
    )


def _p12_file(name="cert.p12", content=b"fake-cert-bytes", content_type="application/x-pkcs12"):
    return SimpleUploadedFile(name, content, content_type=content_type)


# ─── Flusso completo di creazione ──────────────────────────────────────────

def test_create_wifi_detail_full_multipart_flow():
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="create")

    resp = client.post(
        "/api/device-wifi/",
        {
            "device": device.id,
            "ip": "10.50.0.10",
            "mac_address": "AA:BB:CC:DD:EE:FF",
            "certificato": _p12_file(),
            "pass_certificato": "S3cr3tCertPass!",
            "scad_certificato": "2027-06-30",
        },
        format="multipart",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["ip"] == "10.50.0.10"
    assert resp.data["mac_address"] == "AA:BB:CC:DD:EE:FF"
    assert resp.data["scad_certificato"] == "2027-06-30"
    # La password non torna mai in chiaro raw: il campo custom la decifra
    # per la lettura, ma il valore memorizzato su disco è cifrato (verificato sotto).
    assert resp.data["pass_certificato"] == "S3cr3tCertPass!"
    assert resp.data["certificato_url"].endswith(f'/api/device-wifi/{resp.data["id"]}/certificato/')
    assert "certificato" not in resp.data  # write_only


# ─── Cifratura at-rest ──────────────────────────────────────────────────────

def test_password_is_encrypted_at_rest_and_decrypted_on_read():
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="enc")

    resp = client.post(
        "/api/device-wifi/",
        {"device": device.id, "certificato": _p12_file(), "pass_certificato": "PlainTextPass"},
        format="multipart",
    )
    assert resp.status_code == 201, resp.data
    wifi_id = resp.data["id"]

    # Direttamente dal DB, il valore deve essere cifrato (prefisso enc::), mai in chiaro.
    wifi = DeviceWifi.objects.get(pk=wifi_id)
    assert is_encrypted(wifi.pass_certificato)
    assert wifi.pass_certificato != "PlainTextPass"
    assert decrypt(wifi.pass_certificato) == "PlainTextPass"

    # Via API, il campo custom la decifra per la risposta.
    get_resp = client.get(f"/api/device-wifi/{wifi_id}/")
    assert get_resp.data["pass_certificato"] == "PlainTextPass"


def test_password_encryption_is_idempotent_across_partial_updates():
    """Un PATCH che non tocca pass_certificato non deve ri-cifrare (né
    corrompere) il valore già cifrato salvato in precedenza."""
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="idempotent")

    create_resp = client.post(
        "/api/device-wifi/",
        {"device": device.id, "pass_certificato": "OriginalPass"},
        format="json",
    )
    wifi_id = create_resp.data["id"]
    original_encrypted = DeviceWifi.objects.get(pk=wifi_id).pass_certificato

    # PATCH che tocca solo l'IP, non la password.
    patch_resp = client.patch(f"/api/device-wifi/{wifi_id}/", {"ip": "10.50.0.20"}, format="json")
    assert patch_resp.status_code == 200, patch_resp.data

    wifi = DeviceWifi.objects.get(pk=wifi_id)
    assert wifi.pass_certificato == original_encrypted  # invariato, non ri-cifrato
    assert decrypt(wifi.pass_certificato) == "OriginalPass"


def test_empty_password_is_not_encrypted():
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="emptypass")

    resp = client.post("/api/device-wifi/", {"device": device.id}, format="json")
    assert resp.status_code == 201, resp.data
    wifi = DeviceWifi.objects.get(pk=resp.data["id"])
    assert wifi.pass_certificato in (None, "")


# ─── Limiti di dimensione e content-type ──────────────────────────────────

def test_rejects_oversized_certificate():
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="oversize")

    oversized = _p12_file(content=b"x" * (WIFI_CERT_MAX_BYTES + 1))
    resp = client.post(
        "/api/device-wifi/", {"device": device.id, "certificato": oversized}, format="multipart",
    )
    assert resp.status_code == 400
    assert "certificato" in resp.data


def test_accepts_certificate_at_exact_size_limit():
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="exactsize")

    exact = _p12_file(content=b"x" * WIFI_CERT_MAX_BYTES)
    resp = client.post(
        "/api/device-wifi/", {"device": device.id, "certificato": exact}, format="multipart",
    )
    assert resp.status_code == 201, resp.data


def test_rejects_pfx_extension_with_disallowed_content_type():
    """.pfx è tra le estensioni ammesse, ma un content-type non whitelisted
    (es. inviato manualmente errato dal client) viene comunque respinto."""
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="badct")

    bad = _p12_file(name="cert.pfx", content_type="application/zip")
    resp = client.post(
        "/api/device-wifi/", {"device": device.id, "certificato": bad}, format="multipart",
    )
    assert resp.status_code == 400
    assert "certificato" in resp.data


def test_accepts_pfx_extension_with_allowed_content_type():
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="goodpfx")

    good = _p12_file(name="cert.pfx", content_type="application/pkcs12")
    resp = client.post(
        "/api/device-wifi/", {"device": device.id, "certificato": good}, format="multipart",
    )
    assert resp.status_code == 201, resp.data


# ─── Download ────────────────────────────────────────────────────────────────

def test_download_returns_uploaded_bytes_unmodified():
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="download")
    original_bytes = b"\x30\x82\x04\x8bfake-binary-p12-content"

    resp = client.post(
        "/api/device-wifi/",
        {"device": device.id, "certificato": _p12_file(content=original_bytes)},
        format="multipart",
    )
    wifi_id = resp.data["id"]

    download = client.get(f"/api/device-wifi/{wifi_id}/certificato/")
    assert download.status_code == 200
    assert download["X-Accel-Redirect"].startswith("/protected_media/device_wifi/")
    # Il redirect è delegato a Caddy/nginx in produzione: qui verifichiamo
    # che il file sorgente su disco contenga i byte originali intatti
    # (nessuna corruzione/encoding introdotta dal parser multipart).
    wifi = DeviceWifi.objects.get(pk=wifi_id)
    with wifi.certificato.open("rb") as fh:
        assert fh.read() == original_bytes


def test_certificato_url_is_none_without_upload():
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="nocert")

    resp = client.post("/api/device-wifi/", {"device": device.id}, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["certificato_url"] is None


def test_download_404_when_no_certificate():
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="nocertdownload")

    create_resp = client.post("/api/device-wifi/", {"device": device.id}, format="json")
    wifi_id = create_resp.data["id"]

    resp = client.get(f"/api/device-wifi/{wifi_id}/certificato/")
    assert resp.status_code == 404


# ─── Soft delete / restore ───────────────────────────────────────────────

def test_soft_delete_removes_from_default_list():
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="softdelete")

    create_resp = client.post(
        "/api/device-wifi/", {"device": device.id, "certificato": _p12_file()}, format="multipart",
    )
    wifi_id = create_resp.data["id"]

    del_resp = client.delete(f"/api/device-wifi/{wifi_id}/")
    assert del_resp.status_code in (200, 204)

    wifi = DeviceWifi.objects.get(pk=wifi_id)
    assert wifi.deleted_at is not None
    # Il file resta su disco (nessuna cancellazione fisica): solo soft-delete.
    assert wifi.certificato

    list_resp = client.get("/api/device-wifi/", {"device": device.id})
    ids = [w["id"] for w in list_resp.data["results"]]
    assert wifi_id not in ids


def test_no_restore_action_exposed_for_wifi_detail():
    """OSSERVAZIONE (vedi nota di consegna): a differenza di Issue e
    ServiceNowCase, DeviceWifiViewSet usa SoftDeleteAuditMixin ma NON
    RestoreActionMixin: il record va in soft-delete (deleted_at valorizzato,
    file conservato) ma non esiste un'action '/restore/' per farlo
    ricomparire via API. Se questo è intenzionale (WiFi va ricreato invece
    che ripristinato) va bene così; altrimenti è un candidato per
    RestoreActionMixin come per le altre entità soft-delete."""
    user = _superuser()
    client = _auth_client(user)
    device = _make_device(user, suffix="norestore")
    wifi = DeviceWifi.objects.create(device=device)

    resp = client.post(f"/api/device-wifi/{wifi.id}/restore/")
    assert resp.status_code == 404


# ─── Permessi ────────────────────────────────────────────────────────────────

def test_read_requires_view_permission():
    """FIX 2.5 (audit 2026-07): prima IsAuslBoEditor lasciava passare
    qualunque GET senza controllare device.view_devicewifi."""
    user = _superuser()
    device = _make_device(user, suffix="permread")
    wifi = DeviceWifi.objects.create(device=device)

    reader = _internal_user(can_edit=False)
    client = _auth_client(reader)
    resp = client.get(f"/api/device-wifi/{wifi.id}/")
    assert resp.status_code == 403

    reader.user_permissions.add(Permission.objects.get(codename="view_devicewifi"))
    resp = client.get(f"/api/device-wifi/{wifi.id}/")
    assert resp.status_code == 200


def test_write_requires_editor_permission():
    creator = _superuser()
    device = _make_device(creator, suffix="permwrite")

    editor_without_perm = _internal_user(can_edit=False)
    client = _auth_client(editor_without_perm)
    resp = client.post(
        "/api/device-wifi/", {"device": device.id, "certificato": _p12_file()}, format="multipart",
    )
    assert resp.status_code == 403


def test_anonymous_cannot_access_wifi_endpoint():
    client = APIClient()
    resp = client.get("/api/device-wifi/")
    assert resp.status_code in (401, 403)


# ─── Fix 2.4: password non piu' esposta in chiaro a chiunque ─────────────────

def test_password_hidden_without_secrets_permission():
    user = _superuser()
    device = _make_device(user, suffix="secrethidden")
    admin_client = _auth_client(user)
    create_resp = admin_client.post(
        "/api/device-wifi/",
        {"device": device.id, "pass_certificato": "TopSecretPass"},
        format="json",
    )
    wifi_id = create_resp.data["id"]

    reader = _internal_user(can_edit=True)  # view/add/change/delete_devicewifi, MA non view_wifi_secrets
    client = _auth_client(reader)

    detail = client.get(f"/api/device-wifi/{wifi_id}/")
    assert detail.status_code == 200
    assert "pass_certificato" not in detail.data

    listing = client.get("/api/device-wifi/", {"device": device.id})
    assert "pass_certificato" not in listing.data["results"][0]


def test_password_visible_with_secrets_permission():
    user = _superuser()
    device = _make_device(user, suffix="secretvisible")
    admin_client = _auth_client(user)
    create_resp = admin_client.post(
        "/api/device-wifi/",
        {"device": device.id, "pass_certificato": "TopSecretPass"},
        format="json",
    )
    wifi_id = create_resp.data["id"]

    reader = _internal_user(can_edit=True)
    reader.user_permissions.add(Permission.objects.get(codename="view_wifi_secrets"))
    client = _auth_client(reader)

    detail = client.get(f"/api/device-wifi/{wifi_id}/")
    assert detail.status_code == 200
    assert detail.data["pass_certificato"] == "TopSecretPass"


def test_password_hidden_in_nested_device_detail_without_permission():
    """La stessa protezione vale per il nested wifi_detail dentro il
    dettaglio Device, non solo per l'endpoint /api/device-wifi/ diretto."""
    user = _superuser()
    device = _make_device(user, suffix="secretnested")
    admin_client = _auth_client(user)
    admin_client.post(
        "/api/device-wifi/",
        {"device": device.id, "pass_certificato": "TopSecretPass"},
        format="json",
    )

    reader = _internal_user(can_edit=False)
    reader.user_permissions.add(Permission.objects.get(codename="view_device"))
    client = _auth_client(reader)

    detail = client.get(f"/api/devices/{device.id}/")
    assert detail.status_code == 200
    assert "pass_certificato" not in (detail.data.get("wifi_detail") or {})


def test_cannot_write_password_without_secrets_permission():
    user = _superuser()
    device = _make_device(user, suffix="secretwrite")

    editor = _internal_user(can_edit=True)  # niente view_wifi_secrets
    client = _auth_client(editor)
    resp = client.post(
        "/api/device-wifi/",
        {"device": device.id, "pass_certificato": "AttemptedPass"},
        format="json",
    )
    assert resp.status_code == 400
    assert "pass_certificato" in resp.data


def test_certificato_download_requires_secrets_permission():
    user = _superuser()
    device = _make_device(user, suffix="downloadperm")
    admin_client = _auth_client(user)
    create_resp = admin_client.post(
        "/api/device-wifi/", {"device": device.id, "certificato": _p12_file()}, format="multipart",
    )
    wifi_id = create_resp.data["id"]

    reader = _internal_user(can_edit=True)
    client = _auth_client(reader)
    resp = client.get(f"/api/device-wifi/{wifi_id}/certificato/")
    assert resp.status_code == 403

    reader.user_permissions.add(Permission.objects.get(codename="view_wifi_secrets"))
    resp = client.get(f"/api/device-wifi/{wifi_id}/certificato/")
    assert resp.status_code == 200


# ─── Fix 2.4: scope tenant (DeviceWifiViewSet non era scopato) ──────────────

def test_portal_user_cannot_see_wifi_of_another_customer():
    admin = _superuser()
    device_a = _make_device(admin, suffix="tenantwifia")
    device_b = _make_device(admin, suffix="tenantwifib")
    admin_client = _auth_client(admin)
    resp_a = admin_client.post(
        "/api/device-wifi/", {"device": device_a.id, "pass_certificato": "PassA"}, format="json",
    )
    resp_b = admin_client.post(
        "/api/device-wifi/", {"device": device_b.id, "pass_certificato": "PassB"}, format="json",
    )
    wifi_b_id = resp_b.data["id"]

    portal_a = _auslbo_user(device_a.customer, can_edit=True, can_view_secrets=True)
    client = _auth_client(portal_a)

    # Lista: deve vedere solo il proprio.
    listing = client.get("/api/device-wifi/")
    ids = {w["id"] for w in listing.data["results"]}
    assert resp_a.data["id"] in ids
    assert wifi_b_id not in ids

    # Accesso diretto al dettaglio/certificato di un altro customer: 404.
    detail = client.get(f"/api/device-wifi/{wifi_b_id}/")
    assert detail.status_code == 404

    download = client.get(f"/api/device-wifi/{wifi_b_id}/certificato/")
    assert download.status_code == 404


def test_portal_user_cannot_create_wifi_for_device_of_another_customer():
    admin = _superuser()
    device_b = _make_device(admin, suffix="tenantwifiwriteb")
    other_customer = Customer.objects.create(
        name="TenantWriteA",
        status=CustomerStatus.objects.get_or_create(
            key="wifi_e2e_cs_tenantwritea", defaults={"label": "Active"},
        )[0],
    )

    portal_user = _auslbo_user(other_customer, can_edit=True, can_view_secrets=True)
    client = _auth_client(portal_user)

    resp = client.post(
        "/api/device-wifi/",
        {"device": device_b.id, "pass_certificato": "Attempt"},
        format="json",
    )
    # device_b non è scopato nel queryset dell'utente portale (customer
    # diverso): il PrimaryKeyRelatedField "device" non lo trova -> 400.
    assert resp.status_code == 400
