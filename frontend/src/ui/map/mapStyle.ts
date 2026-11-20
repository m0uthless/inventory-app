import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

/**
 * Mappa nei colori dell'app (anteprima design-previews/map-base.html, variante B): lo stile vettoriale
 * Positron di OpenFreeMap ricolorato prima di disegnarlo, così non c'è il lampo dei colori originali.
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

export type MapColors = {
  land: string; water: string; park: string; road: string; roadMain: string; line: string
  building: string; label: string; halo: string; rail: string; pin: string; pinInk: string
}

const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Colori della mappa per tema; `primary` è il colore principale della palette attiva. */
export const MAP_COLORS = {
  light: (primary: string): MapColors => ({
    land: '#eef2f1', water: '#c9dbe0', park: hexA(primary, 0.12), road: '#ffffff', roadMain: hexA(primary, 0.22),
    line: '#d5dedb', building: '#e4eae8', label: '#5b6b67', halo: '#ffffff', rail: '#c9d3d0', pin: primary, pinInk: '#ffffff',
  }),
  dark: (primary: string): MapColors => ({
    land: '#151e1c', water: '#1a2d32', park: hexA(primary, 0.14), road: '#24302d', roadMain: hexA(primary, 0.28),
    line: '#2f3d3a', building: '#212c2a', label: '#93a4a0', halo: '#151e1c', rail: '#33423e', pin: primary, pinInk: '#0b1513',
  }),
}

const MAIN_ROAD = /motorway|trunk|primary|secondary/
const PARK = /park|wood|grass|landcover|landuse/

/** Copia dello stile con i colori dell'app; niente punti d'interesse (nelle schede conta la via). */
export function recolorStyle(style: StyleSpecification, c: MapColors): StyleSpecification {
  const layers = style.layers.map((orig): LayerSpecification => {
    const l = JSON.parse(JSON.stringify(orig)) as LayerSpecification & { paint?: Record<string, unknown>; layout?: Record<string, unknown> }
    const id = l.id
    const set = (k: string, v: unknown) => { l.paint = { ...(l.paint ?? {}), [k]: v } }
    if (/poi/.test(id)) { l.layout = { ...(l.layout ?? {}), visibility: 'none' }; return l }
    if (l.type === 'background') set('background-color', c.land)
    else if (l.type === 'fill') {
      if (/water/.test(id)) set('fill-color', c.water)
      else if (/building/.test(id)) { set('fill-color', c.building); set('fill-outline-color', c.line) }
      else if (PARK.test(id)) set('fill-color', c.park)
      else set('fill-color', c.land)
    } else if (l.type === 'line') {
      const col = /water|river|stream|canal/.test(id) ? c.water : /rail/.test(id) ? c.rail : /casing|outline|boundary/.test(id) ? c.line : MAIN_ROAD.test(id) ? c.roadMain : c.road
      set('line-color', col)
    } else if (l.type === 'symbol' && l.layout && 'text-field' in l.layout) {
      set('text-color', c.label)
      set('text-halo-color', c.halo)
    }
    return l
  })
  return { ...style, layers }
}
