"""servicenow/ocr.py — Estrazione campi da screenshot ServiceNow via OCR.

Il form ServiceNow è renderizzato come coppie label→valore affiancate
orizzontalmente (stessa riga visuale). Screenshot diversi (fatti con
"cattura schermo" da persone/monitor/browser diversi) non hanno risoluzione,
DPI, proporzioni o margini fissi: l'unica cosa che resta stabile è la
dimensione del TESTO rispetto al layout del form stesso.

Un'insidia emersa in pratica: il raggruppamento di Tesseract in "righe"
(block/par/line) non è affidabile come riferimento geometrico. A seconda
di risoluzione, DPI o anche solo di un margine bianco extra attorno allo
screenshot, Tesseract può "fondere" per errore testo di colonne diverse
nella stessa riga logica, allargando a dismisura la bounding-box aggregata
di quella riga. Per questo le label vengono individuate a livello di
SINGOLA PAROLA (bounding-box stretta, sempre affidabile) e non a livello di
riga aggregata: è l'unico riferimento geometrico che si è dimostrato stabile
su risoluzioni/margini diversi.

Strategia:

1. OCR dell'intera immagine ALLA RISOLUZIONE NATIVA, con bounding-box a
   livello di parola (pytesseract.image_to_data). Ingrandire l'intera
   immagine peggiora le cose: altera l'analisi automatica del layout e fa
   fondere colonne diverse (verificato empiricamente).
2. Le label (Number, Account, Priority, Opened, Short/Description) si
   individuano cercando la singola PAROLA il cui testo corrisponde alla
   label, non l'intera riga aggregata da Tesseract.
3. Il VALORE associato si ricostruisce camminando parola per parola verso
   destra a partire dalla label, fermandosi al primo "salto" (gap
   orizzontale) troppo ampio — evita di fondere il valore con testo molto
   più a destra (un'altra colonna del form). Le soglie geometriche (gap
   massimo, tolleranza verticale) sono calcolate come multipli dell'altezza
   mediana delle parole rilevate in quello specifico screenshot — non come
   frazioni fisse dell'immagine — per restare valide a prescindere da
   risoluzione, DPI o margini del ritaglio.
4. Il valore trovato, se breve (1-2 token: Number, Priority, Opened), viene
   RIFINITO: si ritaglia la sua bounding-box dall'immagine originale, la si
   ingrandisce e la si ri-analizza in isolamento. Su screenshot a bassa
   risoluzione/DPI questo corregge confusioni tra caratteri simili (es.
   "CS" letto come "30"). Sui valori lunghi e multi-parola (Account, Short
   Description) la rifinitura viene invece saltata: un crop largo
   ingrandito peggiora la lettura rispetto al pass nativo.

Non è un OCR "intelligente": è un parser pragmatico pensato per il layout
sempre identico dello screenshot che viene incollato. Se Tesseract non è
installato nell'immagine Docker, viene sollevata RuntimeError esplicita.
"""
from __future__ import annotations

import re
import datetime
import statistics
from dataclasses import dataclass, field
from typing import Optional

from PIL import Image

try:
    import pytesseract
    from pytesseract import Output
except ImportError:  # pragma: no cover
    pytesseract = None
    Output = None


@dataclass
class ServiceNowExtractResult:
    number: Optional[str] = None
    account: Optional[str] = None
    priority: Optional[str] = None          # choice value: "1".."4"
    priority_raw: Optional[str] = None      # testo grezzo, es. "3 - Moderate"
    opened_date: Optional[str] = None       # ISO "YYYY-MM-DD"
    short_description: Optional[str] = None
    warnings: list = field(default_factory=list)


LABEL_NUMBER    = re.compile(r"\bnumber\b", re.IGNORECASE)
LABEL_ACCOUNT   = re.compile(r"\baccount\b", re.IGNORECASE)
LABEL_PRIORITY  = re.compile(r"\bpriority\b", re.IGNORECASE)
LABEL_OPENED    = re.compile(r"\bopened\b", re.IGNORECASE)
LABEL_SHORTDESC          = re.compile(r"description", re.IGNORECASE)
# A bassissima risoluzione "Description" a volte non viene letta affatto
# mentre "Short" sì: usato come ancora di riserva (vedi extract_servicenow_fields).
LABEL_SHORTDESC_FALLBACK = re.compile(r"\bshort\b", re.IGNORECASE)
LABEL_FRAGMENT_RE        = re.compile(r"^descr", re.IGNORECASE)

DATE_RE = re.compile(r"(\d{2})[-/](\d{2})[-/](\d{4})")

# Soglie geometriche espresse come MULTIPLI dell'altezza mediana delle
# parole rilevate — non frazioni fisse dell'immagine — per restare valide
# indipendentemente da risoluzione, DPI o margini del ritaglio.
Y_TOLERANCE_CHARS         = 0.6   # stessa "riga visuale" (label e valore allineati)
MAX_LABEL_TO_VALUE_CHARS  = 14.0  # gap max tra fine label e inizio valore (salta il padding del box)
MAX_WORD_GAP_CHARS        = 3.5   # gap max tra due parole dello stesso valore
FALLBACK_CHAR_HEIGHT_PX   = 16.0  # usato solo se non si riesce a stimare l'altezza mediana

# Rifinitura mirata del singolo valore trovato (crop + upscale + re-OCR isolato)
REFINE_PADDING_X_PX  = 4
REFINE_SCALE          = 3.0
REFINE_MIN_HEIGHT_PX  = 5   # sotto questa altezza, il testo non è leggibile in alcun modo
REFINE_MAX_WORDS      = 2   # oltre, il crop largo peggiora la lettura: si salta la rifinitura

# ─── Pass di recupero per screenshot a bassa risoluzione ─────────────────────
# Screenshot molto compressi/piccoli (testo <~12-14px di altezza) mandano in
# crisi la segmentazione automatica "a pagina intera" di Tesseract: alcune
# label isolate (es. "Priority", "Opened") vengono scartate anche se, isolando
# quella riga in un crop, Tesseract le legge correttamente. Ingrandire SEMPRE
# l'immagine peggiora invece i casi normali (fonde colonne diverse — vedi
# note in cima al file), quindi l'upscale si applica solo quando serve
# davvero: se il primo pass nativo rileva un'altezza mediana del testo sotto
# la soglia, si rifà un secondo pass su un'immagine ingrandita fino a portare
# il testo alla dimensione "di comfort" per Tesseract, e si usa quel pass
# solo se ha trovato *più* parole del pass nativo (mai un downgrade silenzioso).
LOW_RES_CHAR_HEIGHT_TRIGGER_PX = 14.0  # sotto questa altezza, il pass nativo è a rischio
LOW_RES_TARGET_CHAR_HEIGHT_PX  = 22.0  # altezza di testo "di comfort" per Tesseract
LOW_RES_MIN_SCALE              = 1.3
LOW_RES_MAX_SCALE              = 3.0

# Glifi "icona" ricorrenti (lente di ricerca, freccine, ecc.) che Tesseract a
# volte legge come parole isolate a sé stanti, tipicamente accanto ai campi
# con lookup. Vengono scartati come CANDIDATI valore fin dalla ricostruzione
# geometrica (non solo ripuliti in coda), perché possono comparire anche
# all'inizio del valore (es. dopo un upscale che li rende visibili come
# parola separata) — non solo alla fine.
ICON_ARTIFACT_RE = re.compile(r"^[|Q©~»«•×✓✔›‹°®]+\.?$")


@dataclass
class _Word:
    text: str
    left: int
    top: int
    right: int
    bottom: int

    @property
    def center_y(self) -> float:
        return (self.top + self.bottom) / 2

    @property
    def height(self) -> float:
        return self.bottom - self.top


def _require_tesseract() -> None:
    if pytesseract is None:
        raise RuntimeError(
            "pytesseract non è installato nell'immagine backend. "
            "Verificare requirements.txt e il pacchetto tesseract-ocr nel Dockerfile."
        )


def _ocr_words(pil_image: Image.Image) -> list[_Word]:
    _require_tesseract()

    data = pytesseract.image_to_data(pil_image, output_type=Output.DICT)
    n = len(data["text"])

    words: list[_Word] = []
    for i in range(n):
        raw = data["text"][i]
        txt = raw.strip() if raw else ""
        if not txt:
            continue
        l, t, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
        words.append(_Word(text=txt, left=l, top=t, right=l + w, bottom=t + h))

    return words


def _estimate_char_height(words: list[_Word]) -> float:
    """Altezza mediana delle parole: è la 'unità di misura' naturale del
    form, stabile a prescindere da risoluzione/DPI/margini del crop.
    """
    heights = [w.height for w in words if w.height > 0]
    if not heights:
        return FALLBACK_CHAR_HEIGHT_PX
    return statistics.median(heights)


def _is_icon_artifact(word_text: str) -> bool:
    """True se la parola è verosimilmente un glifo-icona (lente di ricerca,
    freccina, ecc.) letto da Tesseract come testo isolato, non un token di
    valore reale."""
    return bool(ICON_ARTIFACT_RE.match(word_text))


def _is_probable_label_or_icon_fragment(word_text: str) -> bool:
    """Usato solo nel fallback 'Short' → valore (vedi
    LABEL_SHORTDESC_FALLBACK): a bassa risoluzione, tra l'ancora 'Short' e
    il vero valore del campo possono comparire frammenti residui della
    label composta 'Short Description' letta male (es. 'Descrption|') o
    icone corte non alfabetiche (es. un '2' o un '|' isolati, tipicamente
    dall'icona a tooltip accanto alla label). Vanno scartati prima di
    iniziare a ricostruire il valore vero e proprio."""
    if _is_icon_artifact(word_text):
        return True
    if LABEL_FRAGMENT_RE.match(word_text):
        return True
    if len(word_text) <= 2 and not word_text.isalpha():
        return True
    return False


def _find_label_word(words: list[_Word], label_re: re.Pattern) -> Optional[_Word]:
    """Ritorna, tra tutte le parole il cui testo corrisponde alla label,
    quella più in alto (top minore). Il match è a livello di SINGOLA parola
    (non di riga aggregata da Tesseract, che può fondere colonne diverse
    in modo imprevedibile a seconda di risoluzione/margini).

    Per label ambigue come 'Description' (che compare sia per 'Short
    Description', eventualmente troncata da un crop, sia per la Description
    estesa sottostante) si sceglie la più in alto: la Short Description è
    sempre sopra.
    """
    candidates = [w for w in words if label_re.search(w.text)]
    if not candidates:
        return None
    return min(candidates, key=lambda w: w.top)


def _find_value_words_for_label(
    words: list[_Word],
    label_word: _Word,
    *,
    y_tolerance: float,
    max_label_gap: float,
    max_word_gap: float,
) -> list[_Word]:
    """Ricostruisce le parole del valore associato a una label camminando
    verso destra a partire dalla label, fermandosi al primo gap orizzontale
    troppo ampio (passaggio a un altro campo/un'altra colonna del form).

    I glifi-icona (lente di ricerca, ecc. — vedi `_is_icon_artifact`) restano
    nel cammino come "punti di appoggio" per il calcolo dei gap (altrimenti
    un'icona in mezzo a due parole del valore spezzerebbe il valore a metà),
    ma vengono esclusi dall'elenco restituito: non sono mai testo di valore.
    """
    candidates = [
        w for w in words
        if w is not label_word
        and w.left > label_word.right
        and abs(w.center_y - label_word.center_y) <= y_tolerance
    ]
    if not candidates:
        return []
    candidates.sort(key=lambda w: w.left)

    first = candidates[0]
    if first.left - label_word.right > max_label_gap:
        return []

    value_words = [] if _is_icon_artifact(first.text) else [first]
    prev = first
    for w in candidates[1:]:
        if w.left - prev.right > max_word_gap:
            break
        if not _is_icon_artifact(w.text):
            value_words.append(w)
        prev = w
    return value_words


def _refine_value(pil_image: Image.Image, value_words: list[_Word]) -> Optional[str]:
    """Ritaglia la bounding-box del valore trovato, la ingrandisce e la
    ri-analizza in isolamento: su screenshot a bassa risoluzione/DPI
    corregge confusioni tra caratteri simili (es. 'CS' letto come '30').
    Se la rifinitura fallisce o produce testo vuoto, ritorna None e il
    chiamante può ricadere sul testo già individuato in fase strutturale.
    """
    if not value_words:
        return None

    left   = min(w.left for w in value_words)
    top    = min(w.top for w in value_words)
    right  = max(w.right for w in value_words)
    bottom = max(w.bottom for w in value_words)

    height = bottom - top
    if height < REFINE_MIN_HEIGHT_PX:
        return None

    # Padding verticale proporzionale: per testo molto piccolo (poche decine
    # di px) un padding fisso di pochi pixel non basta a dare a Tesseract
    # abbastanza contesto sopra/sotto il glifo dopo l'upscale.
    pad_y = max(REFINE_PADDING_X_PX, int(height * 0.6))

    img_w, img_h = pil_image.size
    crop_box = (
        max(0, left - REFINE_PADDING_X_PX),
        max(0, top - pad_y),
        min(img_w, right + REFINE_PADDING_X_PX),
        min(img_h, bottom + pad_y),
    )
    crop = pil_image.crop(crop_box)
    crop = crop.resize((int(crop.width * REFINE_SCALE), int(crop.height * REFINE_SCALE)), Image.LANCZOS)

    try:
        refined = pytesseract.image_to_string(crop, config="--psm 7").strip()
    except Exception:
        return None

    return refined or None


def _parse_priority(raw: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not raw:
        return None, None
    m = re.match(r"\s*([1-4])", raw)
    if m:
        return m.group(1), raw.strip()
    return None, raw.strip()


def _parse_date(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    m = DATE_RE.search(raw)
    if not m:
        return None
    day, month, year = m.groups()
    try:
        d = datetime.date(int(year), int(month), int(day))
        return d.isoformat()
    except ValueError:
        return None


def _strip_icon_artifacts(raw: Optional[str]) -> Optional[str]:
    """Rimuove artefatti OCR ricorrenti (icona lente di ricerca letta come
    'Q' o '|' isolata) alla fine dei valori dei campi con lookup (Account, ecc.).
    """
    if not raw:
        return raw
    cleaned = re.sub(r"(\s+[|Q]\.?)+$", "", raw).strip()
    return cleaned or raw


def extract_servicenow_fields(pil_image: Image.Image) -> ServiceNowExtractResult:
    result = ServiceNowExtractResult()
    _require_tesseract()

    words = _ocr_words(pil_image)
    char_height = _estimate_char_height(words)

    # Pass di recupero per screenshot a bassa risoluzione: se il testo è
    # troppo piccolo, la segmentazione automatica di Tesseract sull'immagine
    # intera può "perdere" label isolate (vedi note sulla costante più sopra).
    # Si riprova su una copia ingrandita e si usa quel pass SOLO se ha
    # effettivamente trovato più parole di quello nativo — mai un downgrade
    # silenzioso se l'upscale non aiuta.
    if words and char_height < LOW_RES_CHAR_HEIGHT_TRIGGER_PX:
        scale = LOW_RES_TARGET_CHAR_HEIGHT_PX / char_height
        scale = min(max(scale, LOW_RES_MIN_SCALE), LOW_RES_MAX_SCALE)
        upscaled_image = pil_image.resize(
            (int(pil_image.width * scale), int(pil_image.height * scale)), Image.LANCZOS,
        )
        upscaled_words = _ocr_words(upscaled_image)
        if len(upscaled_words) > len(words):
            pil_image = upscaled_image
            words = upscaled_words
            char_height = _estimate_char_height(words)

    # Calibrazione elastica: le soglie si adattano alla dimensione del testo
    # rilevato in QUESTO screenshot, non a una frazione fissa dell'immagine.
    y_tolerance   = char_height * Y_TOLERANCE_CHARS
    max_label_gap = char_height * MAX_LABEL_TO_VALUE_CHARS
    max_word_gap  = char_height * MAX_WORD_GAP_CHARS

    def value_for(label_word: Optional[_Word], *, allow_refine: bool = True) -> Optional[str]:
        if not label_word:
            return None
        value_words = _find_value_words_for_label(
            words, label_word,
            y_tolerance=y_tolerance, max_label_gap=max_label_gap, max_word_gap=max_word_gap,
        )
        if not value_words:
            return None
        fallback_text = " ".join(w.text for w in value_words).strip()
        # La rifinitura (crop + upscale + re-OCR isolato) è affidabile solo
        # su valori brevi (1-2 token, es. il Number). Su valori lunghi e
        # multi-parola (Account, Short Description) il crop largo peggiora
        # la lettura rispetto al pass strutturale nativo: si salta.
        if allow_refine and len(value_words) <= REFINE_MAX_WORDS:
            refined = _refine_value(pil_image, value_words)
            return refined or fallback_text
        return fallback_text

    result.number = value_for(_find_label_word(words, LABEL_NUMBER))

    account_raw = value_for(_find_label_word(words, LABEL_ACCOUNT), allow_refine=False)
    result.account = _strip_icon_artifacts(account_raw)

    priority_raw = value_for(_find_label_word(words, LABEL_PRIORITY))
    result.priority, result.priority_raw = _parse_priority(priority_raw)

    opened_raw = value_for(_find_label_word(words, LABEL_OPENED))
    result.opened_date = _parse_date(opened_raw)

    shortdesc_label = _find_label_word(words, LABEL_SHORTDESC)
    if shortdesc_label is not None:
        result.short_description = value_for(shortdesc_label, allow_refine=False)
    else:
        # Fallback per screenshot a bassa risoluzione dove "Description" non
        # viene rilevata affatto ma "Short" sì: si riparte da "Short"
        # scartando gli eventuali frammenti di label/icona residui prima del
        # vero valore (vedi _is_probable_label_or_icon_fragment).
        short_label = _find_label_word(words, LABEL_SHORTDESC_FALLBACK)
        if short_label is not None:
            candidate_words = _find_value_words_for_label(
                words, short_label,
                y_tolerance=y_tolerance, max_label_gap=max_label_gap, max_word_gap=max_word_gap,
            )
            while candidate_words and _is_probable_label_or_icon_fragment(candidate_words[0].text):
                candidate_words = candidate_words[1:]
            result.short_description = " ".join(w.text for w in candidate_words).strip() or None

    if not result.number:
        result.warnings.append("Campo 'Number' non riconosciuto, verificare manualmente.")
    if not result.account:
        result.warnings.append("Campo 'Account' non riconosciuto, verificare manualmente.")
    if not result.priority:
        result.warnings.append("Campo 'Priority' non riconosciuto, verificare manualmente.")
    if not result.opened_date:
        result.warnings.append("Campo 'Opened' non riconosciuto o data non parsabile, verificare manualmente.")
    if not result.short_description:
        result.warnings.append("Campo 'Short Description' non riconosciuto, verificare manualmente.")

    return result
