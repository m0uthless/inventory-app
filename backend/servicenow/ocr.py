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
# davvero (testo nativo sotto soglia).
#
# Verificato empiricamente: NESSUNA singola scala fissa è affidabile — su
# uno stesso screenshot, scale 2.4 può perdere "Short" mentre scale 2.44 lo
# trova, scale 2.8 può perdere "Account" mentre scale 2.5 lo trova. Piccole
# variazioni di scala (o di versione di Tesseract tra ambienti diversi)
# spostano in modo imprevedibile quali parole isolate vengono lette — anche
# provare 3-4 scale attorno a un'unica stima "di comfort" può cadere per
# sfortuna proprio in una di queste "zone morte" (verificato: un pass basato
# su multipli relativi di una singola scala target ha comunque perso "Short"
# su un caso reale). Per questo si ingrandisce a un ventaglio più fitto di
# altezze-target ASSOLUTE (non relative a una singola stima) e si uniscono le
# parole trovate in un unico pool (proiettate nello spazio pixel
# dell'immagine nativa, con deduplica geometrica): basta che una label venga
# letta correttamente in UNA delle scale perché l'estrazione la trovi.
LOW_RES_CHAR_HEIGHT_TRIGGER_PX = 14.0  # sotto questa altezza, il pass nativo è a rischio
LOW_RES_TARGET_CHAR_HEIGHTS_PX = (15.0, 19.0, 23.0, 27.0, 31.0)  # ventaglio di altezze "di comfort"
LOW_RES_MIN_SCALE              = 1.3
LOW_RES_MAX_SCALE              = 3.5

# L'ancora "Short" del fallback (vedi LABEL_SHORTDESC_FALLBACK) proviene
# spesso da un pass ingrandito dove si fonde con l'icona a tooltip adiacente:
# la sua bounding-box verticale risulta più alta del testo reale, e il suo
# centro può scivolare fuori dalla tolleranza verticale standard rispetto
# al vero valore sulla stessa riga. Qui si usa una tolleranza più larga,
# solo per questo fallback già "degradato".
SHORTDESC_FALLBACK_Y_TOLERANCE_CHARS = 2.5
LOW_RES_OVERLAP_DEDUP_RATIO    = 0.4  # quota minima di area sovrapposta per considerare
                                       # due rilevazioni la stessa parola fisica

# Glifi "icona" ricorrenti (lente di ricerca, freccine, ecc.) che Tesseract a
# volte legge come parole isolate a sé stanti, tipicamente accanto ai campi
# con lookup. Vengono scartati come CANDIDATI valore fin dalla ricostruzione
# geometrica (non solo ripuliti in coda), perché possono comparire anche
# all'inizio del valore (es. dopo un upscale che li rende visibili come
# parola separata) — non solo alla fine.
ICON_ARTIFACT_RE = re.compile(r"^[|Q©~»«•×✓✔›‹°®\[\]]+\.?$")

# Segnale geometrico complementare al testo: le icone lette male hanno quasi
# sempre un'altezza molto maggiore del testo reale del form (osservato
# ripetutamente in questo modulo: icone a 24-43px contro testo a 8-11px).
MAX_ARTIFACT_HEIGHT_RATIO = 2.2


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


def _project_to_native(word: _Word, scale: float) -> _Word:
    """Riproietta una parola letta su un'immagine ingrandita di `scale`
    nello spazio pixel dell'immagine nativa, così parole trovate a scale
    diverse possono convivere nello stesso pool geometrico."""
    return _Word(
        text=word.text,
        left=round(word.left / scale),
        top=round(word.top / scale),
        right=round(word.right / scale),
        bottom=round(word.bottom / scale),
    )


# Caratteri "puliti" attesi in un valore di campo reale (lettere anche
# accentate, cifre, spazio, punteggiatura tipica di date/numeri). Tutto il
# resto (~, (, ), €, backtick, ecc.) è quasi sempre rumore da icona/fusione
# a bassa risoluzione, usato per scegliere la lettura migliore tra due
# rilevazioni sovrapposte in _merge_low_res_words.
_SUSPICIOUS_CHAR_RE = re.compile(r"[^0-9A-Za-zÀ-ÖØ-öø-ÿ\-/:.,]")


def _is_better_reading(candidate_text: str, existing_text: str) -> bool:
    """Confronta due letture OCR della stessa area fisica (stesso token,
    riproiettato da scale diverse) e decide se `candidate_text` è
    preferibile a `existing_text` già nel pool:
    1. prima per MENO caratteri sospetti (rumore/simboli non tipici di un
       valore di campo — es. '3~-' ha un carattere sospetto, '3' zero);
    2. a parità di 'pulizia', per lunghezza MAGGIORE (più probabile sia una
       lettura completa — es. 'Short' batte 'sr', entrambi puliti).
    Puro confronto per lunghezza da solo sceglierebbe letture sporche più
    lunghe invece di quelle corte ma corrette; puro 'tieni il primo trovato'
    scarterebbe correzioni migliori arrivate da un pass successivo.
    """
    candidate_suspicious = len(_SUSPICIOUS_CHAR_RE.findall(candidate_text))
    existing_suspicious  = len(_SUSPICIOUS_CHAR_RE.findall(existing_text))
    if candidate_suspicious != existing_suspicious:
        return candidate_suspicious < existing_suspicious
    return len(candidate_text) > len(existing_text)


def _find_overlap_index(candidate: _Word, existing: list[_Word]) -> Optional[int]:
    """Ritorna l'indice della parola in `existing` che si sovrappone in modo
    significativo a `candidate` (o None). Il dedup NON può basarsi sul
    testo: la stessa area fisica letta a scale diverse può produrre testo
    diverso (es. '50649645' vs 'CS0649645' vs '(€S0649645' per lo stesso
    'Number', o 'sr' vs 'Short' per la stessa label) — è la posizione, non
    il contenuto, a dire che è la stessa parola fisica rilevata due volte.

    Il rapporto di sovrapposizione usa l'area PIÙ PICCOLA tra le due (non
    quella del candidato): se il candidato è "gonfiato" da rumore fuso
    (es. un'icona attaccata alla cifra vera, bounding-box più larga), usare
    la sua area come denominatore diluirebbe il rapporto e la duplicazione
    sfuggirebbe al filtro.
    """
    for i, w in enumerate(existing):
        if candidate.left >= w.right or w.left >= candidate.right:
            continue  # nessuna sovrapposizione orizzontale
        vertical_overlap = min(candidate.bottom, w.bottom) - max(candidate.top, w.top)
        if vertical_overlap <= 0:
            continue
        horizontal_overlap = min(candidate.right, w.right) - max(candidate.left, w.left)
        candidate_area = max(1, (candidate.right - candidate.left) * (candidate.bottom - candidate.top))
        existing_area  = max(1, (w.right - w.left) * (w.bottom - w.top))
        overlap_area = horizontal_overlap * vertical_overlap
        if overlap_area / min(candidate_area, existing_area) > LOW_RES_OVERLAP_DEDUP_RATIO:
            return i
    return None


def _overlaps_existing(candidate: _Word, existing: list[_Word]) -> bool:
    """Wrapper booleano su `_find_overlap_index`, usato dove serve solo
    sapere SE c'è sovrapposizione (non l'indice)."""
    return _find_overlap_index(candidate, existing) is not None


def _merge_low_res_words(
    pil_image: Image.Image, native_words: list[_Word], native_char_height: float,
) -> list[_Word]:
    """Ripete l'OCR su più copie ingrandite dell'immagine (un ventaglio di
    altezze-target assolute — vedi LOW_RES_TARGET_CHAR_HEIGHTS_PX) e unisce
    le parole trovate in un unico pool, proiettate nello spazio pixel
    dell'immagine nativa e deduplicate per sovrapposizione geometrica (vedi
    `_find_overlap_index`).

    Nessuna scala fissa singola è affidabile (vedi note sulla costante più
    sopra): basta che una label venga letta correttamente in UNA delle scale
    perché l'estrazione la trovi. Quando due letture si sovrappongono si
    tiene quella "migliore" secondo `_is_better_reading` (non semplicemente
    la prima trovata): il pass nativo a volte legge una label come un
    frammento troncato (es. 'sr' invece di 'Short'), e un pass successivo
    più a fuoco la legge per intero — tenere sempre la prima getterebbe via
    la lettura migliore; tenere sempre la più lunga sceglierebbe invece
    letture sporche più lunghe (es. '3~-' invece di '3').
    """
    merged = list(native_words)

    tried_scales: set = set()
    for target in LOW_RES_TARGET_CHAR_HEIGHTS_PX:
        scale = min(max(target / native_char_height, LOW_RES_MIN_SCALE), LOW_RES_MAX_SCALE)
        rounded_scale = round(scale, 2)
        if rounded_scale in tried_scales:
            continue
        tried_scales.add(rounded_scale)

        upscaled_image = pil_image.resize(
            (int(pil_image.width * scale), int(pil_image.height * scale)), Image.LANCZOS,
        )
        for w in _ocr_words(upscaled_image):
            projected = _project_to_native(w, scale)
            idx = _find_overlap_index(projected, merged)
            if idx is None:
                merged.append(projected)
            elif _is_better_reading(projected.text, merged[idx].text):
                merged[idx] = projected

    return merged


def _is_icon_artifact(word_text: str) -> bool:
    """True se la parola è verosimilmente un glifo-icona (lente di ricerca,
    freccina, ecc.) letto da Tesseract come testo isolato, non un token di
    valore reale."""
    return bool(ICON_ARTIFACT_RE.match(word_text))


def _is_geometric_artifact(word: _Word, char_height: float) -> bool:
    """Un'icona può anche essere letta con un testo qualsiasi (non
    riconducibile a ICON_ARTIFACT_RE) ma con un bounding-box ANOMALO:
    osservato empiricamente più volte in questo modulo, le icone lette
    male hanno quasi sempre un'altezza 2-4 volte quella del testo reale
    del form (che è pressoché costante). È un segnale più affidabile del
    contenuto testuale, che a bassa risoluzione può essere qualunque cosa.
    """
    if char_height <= 0:
        return False
    return word.height > char_height * MAX_ARTIFACT_HEIGHT_RATIO


def _is_word_artifact(word: _Word, char_height: float) -> bool:
    return _is_icon_artifact(word.text) or _is_geometric_artifact(word, char_height)


def _is_probable_label_or_icon_fragment(word: _Word, char_height: float) -> bool:
    """Usato solo nel fallback 'Short' → valore (vedi
    LABEL_SHORTDESC_FALLBACK): a bassa risoluzione, tra l'ancora 'Short' e
    il vero valore del campo possono comparire frammenti residui della
    label composta 'Short Description' letta male (es. 'Descrption|',
    'bette', '7]' — il pass nativo spesso legge l'intera label+icona come
    una sequenza di parole garbled) o icone isolate. Vanno scartati prima
    di iniziare a ricostruire il valore vero e proprio."""
    if _is_word_artifact(word, char_height):
        return True
    if LABEL_FRAGMENT_RE.match(word.text):
        return True
    if len(word.text) <= 2 and not word.text.isalpha():
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

    I glifi-icona riconoscibili dal testo (vedi `_is_icon_artifact`)
    restano nel cammino come "punti di appoggio" per il calcolo dei gap
    (altrimenti un'icona in mezzo a due parole del valore spezzerebbe il
    valore a metà), ma vengono esclusi dall'elenco restituito.

    NOTA: qui si filtra solo per testo, non per l'anomalia di altezza
    (`_is_geometric_artifact`) — quel controllo aggiuntivo è confinato al
    solo fallback di Short Description (`_is_probable_label_or_icon_fragment`)
    perché si è rivelato troppo aggressivo su questo percorso generale:
    token legittimi ma corti (es. 'DI' in 'CITTA DI UDINE') possono avere
    bounding-box altrettanto anomale per un artefatto di Tesseract, pur
    essendo testo di valore reale.
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
    # intera può "perdere" label isolate in modo imprevedibile e sensibile
    # alla scala esatta (vedi note sulle costanti più sopra). Si arricchisce
    # il pool di parole con più pass a scale diverse invece di scommettere
    # su un singolo pass sostitutivo — non è mai un downgrade: il pass
    # nativo resta sempre incluso nel pool.
    if words and char_height < LOW_RES_CHAR_HEIGHT_TRIGGER_PX:
        words = _merge_low_res_words(pil_image, words, char_height)
        # NON si ricalcola char_height dal pool unito: i pass di recupero
        # aggiungono spesso artefatti con bounding-box enormi (icone, testo
        # fuso — vedi MAX_ARTIFACT_HEIGHT_RATIO) che sposterebbero la
        # mediana verso l'alto e indebolirebbero a cascata tutte le soglie
        # geometriche a valle. Si resta ancorati alla dimensione del testo
        # REALE misurata nel pass nativo.

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
                y_tolerance=char_height * SHORTDESC_FALLBACK_Y_TOLERANCE_CHARS,
                max_label_gap=max_label_gap, max_word_gap=max_word_gap,
            )
            while candidate_words and _is_probable_label_or_icon_fragment(candidate_words[0], char_height):
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
