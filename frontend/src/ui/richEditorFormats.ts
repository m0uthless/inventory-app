/**
 * 0.9.1 (mitigazione GHSA-v3m3-f69x-jf25 / CVE-2025-15056, npm audit —
 * 21/08/2026): Quill 2.0.3 ha una XSS nota nell'export HTML dei formati
 * "formula" e "video" (embed che concatenano input utente in stringhe
 * HTML senza escaping in packages/quill/src/formats/{formula,video}.ts).
 * Nessuna versione ufficialmente corretta esiste ancora (verificato:
 * GitHub Advisory "Patched versions: None" a giugno 2026; il downgrade a
 * 2.0.2 proposto da `npm audit fix --force` non è un vero fix, è solo la
 * versione più recente PRECEDENTE al codice vulnerabile).
 *
 * La TOOLBAR di RichEditor.tsx non espone pulsanti formula/video, ma
 * questo da solo NON basta: Quill riconosce comunque quei formati
 * durante il parsing di HTML incollato o caricato
 * (dangerouslyPasteHTML/getSemanticHTML), indipendentemente da cosa
 * mostri la toolbar — e il backend (wiki/models.py, content_markdown =
 * TextField()) non sanifica in alcun modo il contenuto salvato.
 * `formats:` è la barriera reale: limita esplicitamente cosa Quill
 * accetta di riconoscere/preservare, sia in scrittura che in lettura —
 * qualunque <video>/formula in un HTML incollato o caricato da API viene
 * silenziosamente scartato invece di essere interpretato. Verificato
 * empiricamente con Quill vero (vedi RichEditor.quillFormatsSecurity.test.ts):
 * senza questa restrizione insertEmbed('video', ...) crea il blot
 * normalmente; con questa restrizione Quill lancia un ParchmentError e
 * rifiuta di crearlo — un blocco strutturale a livello di registro
 * formati, non un filtro su un pattern di payload specifico.
 *
 * File separato da RichEditor.tsx (invece di una export const lì dentro)
 * perché un file .tsx con un export non-componente rompe il Fast Refresh
 * (regola react-refresh/only-export-components) — la stessa ragione per
 * cui il progetto tiene già dashboardTypes.tsx/style.tsx separati dai
 * rispettivi componenti.
 */
export const ALLOWED_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'align', 'list', 'indent',
  'blockquote', 'code-block', 'link', 'image',
]
