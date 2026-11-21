/**
 * AddressMap — la mappa del riquadro «Dove» di clienti e siti (anteprima design-previews/map-base.html,
 * variante B scelta da Fede il 20/11): mappa vettoriale MapLibre con OpenFreeMap, ricolorata con i colori
 * dell'app e il segnaposto nel colore principale; segue il tema chiaro/scuro. Nessuna chiave né costo.
 * Nel riquadro è ferma; «Ingrandisci» apre la mappa grande, che si muove e si ingrandisce.
 * MapLibre (e il suo CSS) si carica solo quando serve una mappa.
 */
import * as React from 'react'
import { Box, CircularProgress, Dialog, IconButton, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded'
import type { Map as MlMap, StyleSpecification } from 'maplibre-gl'

import { CampoIcon } from './campo'
import { geocode } from './map/geocode'
import { MAP_COLORS, MAP_STYLE_URL, recolorStyle, type MapColors } from './map/mapStyle'

type Props = {
  address: string
  height?: number
  /** Mentre cerca l'indirizzo mostra solo il fondo, senza spinner. */
  quiet?: boolean
  zoom?: number
  /** Titolo della mappa grande (di solito il nome del cliente o del sito). */
  title?: string
}

type Coords = { lat: number; lon: number }

let libPromise: Promise<typeof import('maplibre-gl')> | null = null
const loadLib = () => {
  libPromise ??= Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([m]) => m)
    .catch((e) => { libPromise = null; throw e })
  return libPromise
}
let stylePromise: Promise<StyleSpecification> | null = null
const loadStyle = () => {
  stylePromise ??= fetch(MAP_STYLE_URL).then((r) => r.json() as Promise<StyleSpecification>).catch((e) => { stylePromise = null; throw e })
  return stylePromise
}

const pinElement = (c: MapColors) => {
  const el = document.createElement('div')
  el.innerHTML = `<svg width="26" height="34" viewBox="0 0 26 34" aria-hidden="true" style="display:block;filter:drop-shadow(0 2px 3px rgb(0 0 0 / .25))"><path fill="${c.pin}" d="M13 0C5.8 0 0 5.7 0 12.8 0 22.4 13 34 13 34s13-11.6 13-21.2C26 5.7 20.2 0 13 0z"/><circle fill="${c.pinInk}" cx="13" cy="12.8" r="4.6"/></svg>`
  return el
}

/** Disegna una mappa dentro `ref` quando ci sono coordinate; la toglie allo smontaggio o al cambio di tema. */
function useMlMap(ref: React.RefObject<HTMLDivElement | null>, coords: Coords | null, zoom: number, interactive: boolean, colors: MapColors, onFail: () => void) {
  React.useEffect(() => {
    if (!coords || !ref.current) return
    let map: MlMap | null = null
    let alive = true
    Promise.all([loadLib(), loadStyle()]).then(([lib, base]) => {
      if (!alive || !ref.current) return
      const ml = (lib as unknown as { default?: typeof lib }).default ?? lib
      map = new ml.Map({
        container: ref.current, style: recolorStyle(base, colors), center: [coords.lon, coords.lat], zoom: zoom - 0.6,
        interactive, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false,
      })
      new ml.Marker({ element: pinElement(colors), anchor: 'bottom' }).setLngLat([coords.lon, coords.lat]).addTo(map)
      if (interactive) map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-left')
      // L'attribuzione (obbligatoria) parte chiusa nel pulsante «i»: aperta coprirebbe il riquadro.
      map.on('load', () => ref.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'))
    }).catch(() => { if (alive) onFail() })
    return () => { alive = false; map?.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, zoom, interactive, colors])
}

export default function AddressMap({ address, height = 250, zoom = 15, quiet = false, title }: Props) {
  const theme = useTheme()
  const mode = theme.palette.mode
  const primary = theme.palette.primary.main
  const colors = React.useMemo(() => MAP_COLORS[mode === 'dark' ? 'dark' : 'light'](primary), [mode, primary])
  const [coords, setCoords] = React.useState<Coords | null>(null)
  const [state, setState] = React.useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [big, setBig] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const bigRef = React.useRef<HTMLDivElement>(null)
  const [bigReady, setBigReady] = React.useState(false)

  React.useEffect(() => {
    if (!address) return
    let alive = true
    setState('loading'); setCoords(null)
    // Piccolo ritardo: niente richieste mentre si scorre fra i record.
    const t = window.setTimeout(() => {
      void geocode(address).then((c) => {
        if (!alive) return
        if (c) { setCoords(c); setState('ok') } else setState('notfound')
      })
    }, 300)
    return () => { alive = false; window.clearTimeout(t) }
  }, [address])

  const fail = React.useCallback(() => setState('error'), [])
  useMlMap(ref, coords, zoom, false, colors, fail)
  useMlMap(bigRef, big && bigReady ? coords : null, zoom + 1, true, colors, fail)

  const attribSx = {
    '& .maplibregl-ctrl-attrib': { fontSize: 12, lineHeight: 1.4, bgcolor: alpha(theme.palette.background.paper, 0.85), color: 'text.secondary' },
    '& .maplibregl-ctrl-attrib a': { color: 'text.secondary' },
    ...(mode === 'dark' ? { '& .maplibregl-ctrl-attrib-button': { filter: 'invert(1)' } } : {}),
  } as const
  const overlay = (content: React.ReactNode) => (
    <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', p: 1.5, bgcolor: colors.land, color: 'text.secondary', fontSize: 12 }}>{content}</Box>
  )

  return (
    <>
      <Box sx={{ position: 'relative', height, width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: colors.land, ...attribSx }}>
        <div ref={ref} style={{ position: 'absolute', inset: 0 }} />
        {state === 'loading' ? overlay(quiet ? null : <CircularProgress size={20} />) : null}
        {state === 'notfound' ? overlay(<Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Indirizzo non trovato</Typography>) : null}
        {state === 'error' ? overlay(<Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Mappa non disponibile: serve la connessione a internet.</Typography>) : null}
        {state === 'ok' ? (
          <Tooltip title="Ingrandisci">
            <IconButton aria-label="Ingrandisci la mappa" size="small" onClick={() => setBig(true)} sx={{
              position: 'absolute', top: 6, right: 6, zIndex: 2, width: 28, height: 28, borderRadius: '6px', border: '1px solid', borderColor: 'divider',
              bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main', color: 'primary.main' },
            }}><OpenInFullRoundedIcon sx={{ fontSize: 14 }} /></IconButton>
          </Tooltip>
        ) : null}
      </Box>

      <Dialog open={big} onClose={() => { setBig(false); setBigReady(false) }} maxWidth="md" fullWidth
        slotProps={{ transition: { onEntered: () => setBigReady(true) } }} aria-label={`Mappa · ${title ?? address}`}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 600, minWidth: 0 }} noWrap>{title ? `${title} · ${address}` : address}</Typography>
          <IconButton aria-label="Chiudi la mappa" size="small" onClick={() => { setBig(false); setBigReady(false) }}><CampoIcon name="x" size={16} /></IconButton>
        </Box>
        <Box sx={{ position: 'relative', height: 'min(560px, 70vh)', bgcolor: colors.land, ...attribSx }}>
          <div ref={bigRef} style={{ position: 'absolute', inset: 0 }} />
        </Box>
      </Dialog>
    </>
  )
}
