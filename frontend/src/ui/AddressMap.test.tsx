import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AddressMap from './AddressMap'
import { THEME_REGISTRY } from '../theme/themeRegistry'

const ml = vi.hoisted(() => {
  const maps: { opts: Record<string, unknown>; removed: boolean }[] = []
  class FakeMap {
    opts: Record<string, unknown>; removed = false
    constructor(opts: Record<string, unknown>) { this.opts = opts; maps.push(this) }
    addControl() { return this }
    on() { return this }
    remove() { this.removed = true }
  }
  class FakeMarker { setLngLat() { return this } addTo() { return this } }
  class FakeNav {}
  return { maps, FakeMap, FakeMarker, FakeNav }
})
vi.mock('maplibre-gl', () => ({ default: { Map: ml.FakeMap, Marker: ml.FakeMarker, NavigationControl: ml.FakeNav }, Map: ml.FakeMap, Marker: ml.FakeMarker, NavigationControl: ml.FakeNav }))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

const theme = THEME_REGISTRY.default.build('light')
const style = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#fff' } }] }

function mockFetch(geo: unknown[]) {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve({ json: () => Promise.resolve(url.includes('nominatim') ? geo : style) })))
}
const show = (address = 'Via di Corticella 120, 40128 Bologna') =>
  render(<ThemeProvider theme={theme}><AddressMap address={address} height={150} /></ThemeProvider>)

describe('AddressMap', () => {
  beforeEach(() => { ml.maps.length = 0 })
  afterEach(() => { vi.unstubAllGlobals() })

  it('disegna la mappa nei colori dell\'app centrata sull\'indirizzo', async () => {
    mockFetch([{ lat: '44.5226', lon: '11.3478' }])
    show()
    await waitFor(() => expect(ml.maps).toHaveLength(1), { timeout: 2000 })
    const o = ml.maps[0].opts as { center: [number, number]; interactive: boolean; style: { layers: { paint: Record<string, string> }[] } }
    expect(o.center).toEqual([11.3478, 44.5226])
    expect(o.interactive).toBe(false)
    expect(o.style.layers[0].paint['background-color']).toBe('#eef2f1')
  })

  it('indirizzo non trovato: lo dice', async () => {
    mockFetch([])
    show('Via Inesistente 999, Nessunposto')
    expect(await screen.findByText('Indirizzo non trovato', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(ml.maps).toHaveLength(0)
  })

  it('«Ingrandisci» apre la mappa grande, che si può muovere', async () => {
    mockFetch([{ lat: '44.5', lon: '11.3' }])
    show('Via Ingrandisci 1, Bologna')
    await waitFor(() => expect(ml.maps).toHaveLength(1), { timeout: 2000 })
    fireEvent.click(screen.getByRole('button', { name: 'Ingrandisci la mappa' }))
    await waitFor(() => expect(ml.maps).toHaveLength(2), { timeout: 2000 })
    expect(ml.maps[1].opts.interactive).toBe(true)
  })
})
