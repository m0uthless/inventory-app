"""expenses/ocr.py — Estrazione data/importo da scontrini/ricevute.

A differenza di servicenow/ocr.py (screenshot a layout FISSO, label→valore
sulla stessa riga), uno scontrino è testo libero stampato da registratori
di cassa diversissimi tra loro: niente coordinate stabili, niente label
sempre uguali. Qui si usa un OCR "a testo intero" + euristiche pragmatiche:

Importo:
  1. Cerca righe contenenti una parola-chiave di totale ("TOTALE", "TOTALE
     EURO", "IMPORTO", "TOTALE COMPLESSIVO", ecc.) e prende il numero
     presente su quella riga.
  2. Se non trova nessuna parola-chiave, ripiega sul valore numerico più
     alto tra quelli con formato "importo" (##,## o ##.##) trovati nel
     testo — su uno scontrino il totale è quasi sempre il numero più
     grande stampato.

Data: primo pattern data (gg/mm/aaaa, gg-mm-aaaa, gg.mm.aaaa, anche a 2
cifre per l'anno) trovato nel testo.

Non è pensato per essere infallibile: il risultato è sempre un
SUGGERIMENTO che l'utente conferma/corregge in UI (vedi expenses/api.py,
azione `extract`), mai un valore salvato in automatico.
"""
from __future__ import annotations

import datetime
import re
from dataclasses import dataclass, field
from typing import Optional

from PIL import Image

try:
    import pytesseract
except ImportError:  # pragma: no cover
    pytesseract = None


@dataclass
class ReceiptExtractResult:
    amount: Optional[str] = None   # stringa decimale "12.50", pronta per DecimalField
    date: Optional[str] = None     # ISO "YYYY-MM-DD"
    raw_text: str = ""
    warnings: list = field(default_factory=list)


def _require_tesseract() -> None:
    if pytesseract is None:
        raise RuntimeError(
            "pytesseract non è installato nell'immagine backend. "
            "Verificare requirements.txt e il pacchetto tesseract-ocr nel Dockerfile."
        )


TOTAL_KEYWORDS = re.compile(
    r"\b(totale\s*(?:complessivo|euro|eur|a\s*pagare|corrispettivo)?|importo\s*(?:totale)?|tot\.?)\b",
    re.IGNORECASE,
)

# Numero in stile italiano: 1.234,56 oppure 12,50 oppure 12.50 (fallback anglosassone)
AMOUNT_RE = re.compile(r"(\d{1,3}(?:[.\s]\d{3})*[.,]\d{2})\b")

DATE_RE = re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b")


def _normalize_amount(raw: str) -> Optional[str]:
    """'1.234,56' o '12,50' → '1234.56' / '12.50' (stringa, per DecimalField)."""
    s = raw.strip()
    if "," in s:
        # Stile italiano: '.' migliaia, ',' decimali
        s = s.replace(".", "").replace(" ", "").replace(",", ".")
    else:
        s = s.replace(" ", "")
    try:
        return f"{float(s):.2f}"
    except ValueError:
        return None


def _extract_amount(lines: list[str]) -> Optional[str]:
    # 1) riga con parola-chiave di totale
    for line in lines:
        if TOTAL_KEYWORDS.search(line):
            m = AMOUNT_RE.search(line)
            if m:
                normalized = _normalize_amount(m.group(1))
                if normalized:
                    return normalized

    # 2) fallback: il numero più alto in formato importo su tutto il testo
    all_amounts: list[float] = []
    for line in lines:
        for m in AMOUNT_RE.finditer(line):
            normalized = _normalize_amount(m.group(1))
            if normalized:
                all_amounts.append(float(normalized))
    if all_amounts:
        return f"{max(all_amounts):.2f}"
    return None


def _extract_date(text: str) -> Optional[str]:
    m = DATE_RE.search(text)
    if not m:
        return None
    day, month, year = m.groups()
    try:
        y = int(year)
        if y < 100:
            y += 2000
        d = datetime.date(y, int(month), int(day))
        # Uno scontrino non è mai nel futuro remoto né troppo vecchio: scarta
        # match plausibilmente sbagliati (es. un numero di telefono letto come data).
        today = datetime.date.today()
        if d.year < today.year - 3 or d > today + datetime.timedelta(days=1):
            return None
        return d.isoformat()
    except ValueError:
        return None


def extract_receipt_fields(pil_image: Image.Image) -> ReceiptExtractResult:
    result = ReceiptExtractResult()
    _require_tesseract()

    try:
        text = pytesseract.image_to_string(pil_image, lang="ita+eng")
    except Exception:
        # Language pack 'ita' potrebbe non essere installato nell'immagine Docker.
        text = pytesseract.image_to_string(pil_image)

    result.raw_text = text
    lines = [ln for ln in text.splitlines() if ln.strip()]

    result.amount = _extract_amount(lines)
    result.date = _extract_date(text)

    if not result.amount:
        result.warnings.append("Importo non riconosciuto, inseriscilo manualmente.")
    if not result.date:
        result.warnings.append("Data non riconosciuta, inseriscila manualmente.")

    return result
