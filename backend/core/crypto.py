"""Small helper utilities for encrypting/decrypting sensitive fields at rest.

- Uses Fernet (symmetric authenticated encryption) from `cryptography`.
- Encrypted payloads are stored with an `enc::` prefix so we can detect
  whether a value is encrypted or still plaintext (legacy).
"""

from __future__ import annotations

import base64
import hashlib
from typing import Optional

from django.conf import settings

try:
    from cryptography.fernet import Fernet, InvalidToken  # type: ignore
except Exception as exc:  # pragma: no cover
    # Import errors will surface early during app boot; keep message clear.
    raise

PREFIX = "enc::"


def _derive_dev_key(secret: str) -> bytes:
    """Derive a deterministic Fernet key from SECRET_KEY for dev fallback.

    Fernet keys are 32 urlsafe-base64-encoded bytes.
    """
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def get_fernet() -> Fernet:
    key = getattr(settings, "FIELD_ENCRYPTION_KEY", None)
    if key:
        if isinstance(key, str):
            key_b = key.encode("utf-8")
        else:
            key_b = key
        return Fernet(key_b)

    # No key configured
    if getattr(settings, "DEBUG", False):
        # Dev-only fallback: derive from SECRET_KEY so local dev works
        return Fernet(_derive_dev_key(settings.SECRET_KEY))

    raise RuntimeError(
        "FIELD_ENCRYPTION_KEY is required when DEBUG=False to encrypt/decrypt secrets."
    )


def is_encrypted(value: Optional[str]) -> bool:
    return bool(value) and value.startswith(PREFIX)


def encrypt(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    if is_encrypted(value):
        return value
    f = get_fernet()
    token = f.encrypt(value.encode("utf-8")).decode("utf-8")
    return f"{PREFIX}{token}"


def decrypt(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    if not is_encrypted(value):
        # legacy plaintext
        return value
    token = value[len(PREFIX) :]
    f = get_fernet()
    try:
        return f.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # Wrong key or corrupted token: fail loudly (better than silent garbage)
        raise
