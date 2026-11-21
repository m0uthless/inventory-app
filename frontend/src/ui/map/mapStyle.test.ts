import { describe, expect, it } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'

import { MAP_COLORS, recolorStyle } from './mapStyle'

const style = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#fff' } },
    { id: 'water', type: 'fill', source: 's', 'source-layer': 'water', paint: { 'fill-color': '#00f' } },
    { id: 'park', type: 'fill', source: 's', 'source-layer': 'park', paint: { 'fill-color': '#0f0' } },
    { id: 'building', type: 'fill', source: 's', 'source-layer': 'building', paint: { 'fill-color': '#999' } },
    { id: 'highway_primary', type: 'line', source: 's', 'source-layer': 'transportation', paint: { 'line-color': '#f00' } },
    { id: 'highway_minor', type: 'line', source: 's', 'source-layer': 'transportation', paint: { 'line-color': '#f00' } },
    { id: 'railway', type: 'line', source: 's', 'source-layer': 'transportation', paint: { 'line-color': '#000' } },
    { id: 'poi_label', type: 'symbol', source: 's', 'source-layer': 'poi', layout: { 'text-field': '{name}' }, paint: {} },
    { id: 'road_label', type: 'symbol', source: 's', 'source-layer': 'transportation_name', layout: { 'text-field': '{name}' }, paint: {} },
  ],
} as unknown as StyleSpecification

const byId = (s: StyleSpecification, id: string) => s.layers.find((l) => l.id === id) as unknown as { paint?: Record<string, unknown>; layout?: Record<string, unknown> }

describe('recolorStyle', () => {
  const c = MAP_COLORS.light('#1f6b5c')
  const out = recolorStyle(style, c)

  it('ricolora terra, acqua, parchi, edifici con i colori dell\'app', () => {
    expect(byId(out, 'background').paint?.['background-color']).toBe(c.land)
    expect(byId(out, 'water').paint?.['fill-color']).toBe(c.water)
    expect(byId(out, 'park').paint?.['fill-color']).toBe(c.park)
    expect(byId(out, 'building').paint?.['fill-color']).toBe(c.building)
  })

  it('strade principali nella tinta dell\'app, le altre bianche, i binari a parte', () => {
    expect(byId(out, 'highway_primary').paint?.['line-color']).toBe(c.roadMain)
    expect(byId(out, 'highway_minor').paint?.['line-color']).toBe(c.road)
    expect(byId(out, 'railway').paint?.['line-color']).toBe(c.rail)
  })

  it('nasconde i punti d\'interesse e colora le etichette', () => {
    expect(byId(out, 'poi_label').layout?.visibility).toBe('none')
    expect(byId(out, 'road_label').paint?.['text-color']).toBe(c.label)
    expect(byId(out, 'road_label').paint?.['text-halo-color']).toBe(c.halo)
  })

  it('non modifica lo stile di partenza', () => {
    expect(byId(style, 'water').paint?.['fill-color']).toBe('#00f')
  })

  it('il tema scuro ha colori propri', () => {
    expect(MAP_COLORS.dark('#5fb8a3').land).not.toBe(c.land)
  })
})
