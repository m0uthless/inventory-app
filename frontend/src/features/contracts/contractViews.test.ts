import { describe, expect, it } from 'vitest'

import { CONTRACT_VIEWS, VIEW_PARAMS } from './contractViews'

describe('viste della pagina Contratti', () => {
  it('«Da rinnovare» filtra per expiry=renew e «Chiusi» per status=chiuso', () => {
    expect(VIEW_PARAMS.att).toEqual({ expiry: 'renew' })
    expect(VIEW_PARAMS.canc).toEqual({ status: 'chiuso' })
    expect(VIEW_PARAMS.exp).toEqual({ expiry: 'expired' })
  })
  it('etichette senza disdetta', () => {
    expect(CONTRACT_VIEWS.map((v) => v.label)).toEqual(['Tutti', 'Da rinnovare', 'Scaduti', 'In corso', 'Bozze', 'Chiusi'])
  })
})
