"""Impostazioni di Archie (spec 2026-11-20).

Registro tipizzato delle impostazioni applicative, salvate come righe chiave/valore
in `core.AppSetting`. Una riga mancante o nel cestino vale il predefinito.
Le modifica il superuser o chi ha `core.manage_app_settings` (vedi app_settings_api).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from core.models import AppSetting

MANAGE_PERM = "core.manage_app_settings"

_EMAIL_RE = re.compile(r"^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$")


@dataclass(frozen=True)
class SettingDef:
    key: str
    section: str
    label: str
    kind: str  # "emails" | "int"
    default: str | int
    min: int | None = None
    max: int | None = None


SECTIONS = {"contracts": "Contratti"}

SETTINGS: dict[str, SettingDef] = {
    d.key: d for d in (
        SettingDef("contracts.reminder_emails", "contracts", "Indirizzi dell'ufficio", "emails", ""),
        SettingDef("contracts.reminder_default_days", "contracts", "Avviso predefinito per i nuovi contratti", "int", 90, 1, 365),
        SettingDef("contracts.reminder_every_days", "contracts", "Ripeti il promemoria ogni", "int", 10, 1, 60),
    )
}


class SettingError(ValueError):
    pass


def parse_emails(raw: str) -> tuple[list[str], list[str]]:
    """(validi normalizzati e senza doppioni, non validi) da una lista separata da «;»."""
    valid: list[str] = []
    invalid: list[str] = []
    for part in (raw or "").split(";"):
        e = part.strip()
        if not e:
            continue
        if _EMAIL_RE.match(e):
            e = e.lower()
            if e not in valid:
                valid.append(e)
        else:
            invalid.append(e)
    return valid, invalid


def _coerce(d: SettingDef, raw):
    """Valore validato da salvare (stringa) e valore tipizzato; SettingError se non valido."""
    if d.kind == "emails":
        valid, invalid = parse_emails(str(raw if raw is not None else ""))
        if invalid:
            raise SettingError(f"Indirizzi non validi: {', '.join(invalid)}")
        text = "; ".join(valid)
        return text, text
    try:
        n = int(str(raw).strip())
    except (TypeError, ValueError):
        raise SettingError("Serve un numero intero.") from None
    if (d.min is not None and n < d.min) or (d.max is not None and n > d.max):
        raise SettingError(f"Serve un numero tra {d.min} e {d.max}.")
    return str(n), n


def _typed(d: SettingDef, stored: str | None):
    if stored is None:
        return d.default
    try:
        return _coerce(d, stored)[1]
    except SettingError:
        return d.default


def get_setting(key: str):
    d = SETTINGS[key]
    row = AppSetting.objects.filter(key=key, deleted_at__isnull=True).values_list("value", flat=True).first()
    return _typed(d, row)


def office_emails() -> list[str]:
    return parse_emails(get_setting("contracts.reminder_emails"))[0]


def all_settings() -> dict:
    """Le impostazioni del registro, per sezione (forma della GET)."""
    rows = dict(AppSetting.objects.filter(key__in=SETTINGS, deleted_at__isnull=True).values_list("key", "value"))
    sections = []
    for sec_key, sec_label in SECTIONS.items():
        items = [
            {"key": d.key, "label": d.label, "kind": d.kind, "value": _typed(d, rows.get(d.key)), "default": d.default,
             "min": d.min, "max": d.max}
            for d in SETTINGS.values() if d.section == sec_key
        ]
        sections.append({"key": sec_key, "label": sec_label, "settings": items})
    return {"sections": sections}


def set_settings(values: dict, actor=None, request=None) -> None:
    """Valida tutte le chiavi, poi salva quelle cambiate (tutto o niente) e le registra nell'Audit.
    Solleva SettingError con un dizionario {chiave: messaggio} negli args[0]."""
    from audit.utils import log_event

    errors: dict[str, str] = {}
    clean: dict[str, tuple[str, object]] = {}
    for key, raw in (values or {}).items():
        d = SETTINGS.get(key)
        if d is None:
            errors[key] = "Impostazione sconosciuta."
            continue
        try:
            clean[key] = _coerce(d, raw)
        except SettingError as e:
            errors[key] = str(e)
    if errors:
        raise SettingError(errors)
    for key, (text, typed) in clean.items():
        before = get_setting(key)
        if before == typed:
            continue
        row, _ = AppSetting.objects.update_or_create(key=key, defaults={"value": text, "deleted_at": None})
        log_event(actor=actor, action="update", instance=row, changes={key: {"from": before, "to": typed}}, request=request)
