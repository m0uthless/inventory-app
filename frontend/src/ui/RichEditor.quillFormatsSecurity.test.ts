import { describe, expect, it } from 'vitest'
import Quill from 'quill'
import { ALLOWED_FORMATS } from './richEditorFormats'

/**
 * Test di regressione per la mitigazione di GHSA-v3m3-f69x-jf25 /
 * CVE-2025-15056 (npm audit, 21/08/2026): Quill 2.0.3 ha una XSS nota
 * nell'export HTML dei formati "formula" e "video" — i metodi html() di
 * entrambi concatenano input utente in stringhe HTML senza escaping.
 * Nessuna versione ufficialmente corretta esiste ancora (GitHub Advisory
 * "Patched versions: None" al 17/06/2026); il downgrade a 2.0.2
 * suggerito da `npm audit fix --force` non è un vero fix — è solo
 * l'ultima versione pubblicata PRIMA del codice vulnerabile.
 *
 * Mitigazione: passare formats: ALLOWED_FORMATS (senza 'video'/'formula')
 * al costruttore Quill in RichEditor.tsx. Verificato empiricamente qui:
 * senza la restrizione, insertEmbed('video', ...) crea il blot
 * normalmente; CON la restrizione, Quill lancia un ParchmentError e
 * rifiuta di creare il blot — un blocco strutturale a livello di
 * registro formati, non un filtro su un pattern di payload specifico.
 */
describe('RichEditor — mitigazione GHSA-v3m3-f69x-jf25 (quill formula/video XSS)', () => {
  it('senza restrizione formats, un embed "video" viene creato normalmente', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const q = new Quill(el, { theme: 'snow' })
    q.insertEmbed(0, 'video', 'https://example.com/x')
    // DOM reale dell'editor, non getSemanticHTML() (che per i video
    // sembra "declassare" l'iframe a un semplice link nell'export —
    // comportamento separato, non rilevante per la mitigazione: quello
    // che conta è se il blot iframe.ql-video esiste nel documento).
    const rawHtml = el.querySelector('.ql-editor')!.innerHTML
    expect(rawHtml).toMatch(/<iframe/i)
  })

  it('con ALLOWED_FORMATS (usato da RichEditor), Quill rifiuta di creare un blot "video"', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const q = new Quill(el, { theme: 'snow', formats: ALLOWED_FORMATS })
    expect(() => q.insertEmbed(0, 'video', 'https://example.com/x')).toThrow(/video/i)
  })

  it('con ALLOWED_FORMATS, Quill rifiuta di creare un blot "formula"', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const q = new Quill(el, { theme: 'snow', formats: ALLOWED_FORMATS })
    expect(() => q.insertEmbed(0, 'formula', 'x^2')).toThrow(/formula/i)
  })

  it('con ALLOWED_FORMATS, i format usati davvero da RichEditor restano intatti dopo un round-trip HTML', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const q = new Quill(el, { theme: 'snow', formats: ALLOWED_FORMATS })
    q.clipboard.dangerouslyPasteHTML(
      '<h1>Titolo</h1><p><strong>grassetto</strong> <em>corsivo</em> <a href="https://example.com">link</a></p>' +
      '<ul><li>uno</li><li>due</li></ul><blockquote>citazione</blockquote><img src="https://example.com/a.png">'
    )
    const html = q.getSemanticHTML ? q.getSemanticHTML() : el.querySelector('.ql-editor')!.innerHTML
    expect(html).toMatch(/<h1/)
    expect(html).toMatch(/<strong>/)
    expect(html).toMatch(/<em>/)
    expect(html).toMatch(/<a\s/)
    expect(html).toMatch(/<li/)
    expect(html).toMatch(/<blockquote/)
    expect(html).toMatch(/<img/)
  })
})
