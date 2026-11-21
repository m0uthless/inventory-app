import { describe, expect, it } from 'vitest'
import { buildSections, PALETTE_ACTIONS } from './paletteModel'

const R = (kind: string, id: number, title: string) => ({ kind, id, title, subtitle: 'sub' })

describe('buildSections', () => {
  it('a ricerca vuota: recenti e azioni', () => {
    const s = buildSections({ q: '', results: [], pages: [], actions: PALETTE_ACTIONS.slice(0, 2), recent: ['imola'] })
    expect(s.map((x) => x.label)).toEqual(['Ricerche recenti', 'Azioni'])
    expect(s[0].items[0]).toMatchObject({ title: 'imola', path: '/search?search=imola' })
    expect(s[1].items[0]).toMatchObject({ title: 'Nuova issue', path: '/issues', state: { openCreate: true } })
  })

  it('risultati raggruppati nell\'ordine della Ricerca, al massimo 5 per gruppo; poi pagine e azioni', () => {
    const results = [R('issue', 9, '#9 Worklist'), ...Array.from({ length: 7 }, (_, i) => R('customer', i + 1, `Cliente ${i}`)), R('drive_file', 3, 'verbale.pdf')]
    const s = buildSections({ q: 'nuova', results, pages: [{ label: 'Issue', path: '/issues' }], actions: PALETTE_ACTIONS, recent: [] })
    expect(s.map((x) => x.label)).toEqual(['Clienti', 'Issue', 'Drive', 'Azioni'])
    expect(s[0].items).toHaveLength(5)
    expect(s[1].items[0]).toMatchObject({ title: '#9 Worklist', path: '/issues?open=9', icon: 'alert' })
    expect(s[3].items.map((i) => i.title)).toEqual(['Nuova issue'])
  })

  it('le pagine corrispondono anche con il nome del modulo e senza accenti', () => {
    const pages = [{ label: 'Piani', path: '/maintenance/plans', parent: 'Manutenzione' }, { label: 'Attività', path: '/x' }]
    expect(buildSections({ q: 'manutenzione piani', results: [], pages, actions: [], recent: [] })[0].items[0]).toMatchObject({ title: 'Manutenzione › Piani', path: '/maintenance/plans' })
    expect(buildSections({ q: 'attivita', results: [], pages, actions: [], recent: [] })[0].items[0].title).toBe('Attività')
  })
})
