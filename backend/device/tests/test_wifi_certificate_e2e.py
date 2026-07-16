"""Test end-to-end per il flusso di upload del certificato WiFi (.p12):
- creazione completa via multipart (device + ip + mac + certificato + password + scadenza)
- cifratura at-rest della password (Fernet, prefisso enc::) e decifratura in lettura
- idempotenza della cifratura su update parziali (niente doppia cifratura)
- limiti di dimensione e content-type
- download del certificato via endpoint protetto
- soft-delete/restore
- permessi (lettura libera, scrittura riservata a IsAuslBoEditor)

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
        user.user_permissions.add(Permission.objects.get(codename="change_device"))
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

def test_read_allowed_without_edit_permission():
    user = _superuser()
    device = _make_device(user, suffix="permread")
    wifi = DeviceWifi.objects.create(device=device)

    reader = _internal_user(can_edit=False)
    client = _auth_client(reader)
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
