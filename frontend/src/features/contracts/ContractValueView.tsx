import * as React from 'react'
import { Box, ButtonBase, CircularProgress, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { api } from '@shared/api/client'
import { buildQuery } from '@shared/utils/nav'

import type { RegionId } from '../../data/italianRegions'
import { KpiStrip, KpiTile } from '../../ui/campo'
import { byRegion, eur0, regionName, share, sumValue, toCustomerValues, type CustomerValue, type CustomerValueRow } from './contractValue'

export type ValueScope = 'active' | 'all'
const TOP = 10
const card = { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: '16px 18px', minWidth: 0 } as const
const bar = (pct: number) => (
  <Box aria-hidden sx={{ height: 6, borderRadius: 3, bgcolor: 'archie.surface2', mt: 0.625, overflow: 'hidden' }}>
    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: 'primary.main', borderRadius: 3 }} />
  </Box>
)
const segBtn = (on: boolean) => ({
  height: 28, px: 1.375, borderRadius: '6px', fontSize: 13, color: on ? 'text.primary' : 'text.secondary', fontWeight: on ? 600 : 400,
  bgcolor: on ? 'background.paper' : 'transparent', boxShadow: on ? '0 1px 2px rgb(0 0 0 / .08)' : 'none',
  '&.Mui-focusVisible': { boxShadow: (t: { palette: { archie: { focusRing: string } } }) => t.palette.archie.focusRing },
})

/** Interruttore «Attivi oggi / Storico» (testata della pagina). */
export function ScopeSwitch({ value, onChange }: { value: ValueScope; onChange: (v: ValueScope) => void }) {
  return (
    <Box role="group" aria-label="Quali contratti" sx={{ display: 'inline-flex', p: '2px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'archie.surface2' }}>
      <ButtonBase aria-pressed={value === 'active'} onClick={() => onChange('active')} sx={segBtn(value === 'active')}>Attivi oggi</ButtonBase>
      <ButtonBase aria-pressed={value === 'all'} onClick={() => onChange('all')} sx={segBtn(value === 'all')}>Storico</ButtonBase>
    </Box>
  )
}

/**
 * Sezione «Valore» dei Contratti (variante A): clienti per valore e, a lato, le regioni
 * (dalla provincia del cliente) che filtrano la classifica.
 */
export default function ContractValueView({ scope }: { scope: ValueScope }) {
  const navigate = useNavigate()
  const [list, setList] = React.useState<CustomerValue[] | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [region, setRegion] = React.useState<RegionId | null | undefined>(undefined)
  const [showAll, setShowAll] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    setList(null); setFailed(false); setShowAll(false)
    api.get<{ results: CustomerValueRow[] }>('/contracts/value-by-customer/', { params: { scope } })
      .then((r) => { if (alive) setList(toCustomerValues(r.data.results)) })
      .catch(() => { if (alive) { setFailed(true); setList([]) } })
    return () => { alive = false }
  }, [scope])

  if (list === null) return <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}><CircularProgress size={22} /></Box>
  if (failed) return <Typography sx={{ color: 'text.secondary', py: 4 }}>Non è stato possibile leggere il valore dei contratti.</Typography>

  const total = sumValue(list)
  const regions = byRegion(list)
  const topRegion = regions.find((r) => r.region !== null) ?? regions[0]
  const top5 = sumValue(list.slice(0, 5))
  const shown = region === undefined ? list : list.filter((c) => c.region === region)
  const shownTotal = sumValue(shown)
  const maxV = shown[0]?.value || 1
  const maxR = Math.max(1, ...regions.map((r) => r.value))
  const scopeText = scope === 'active' ? 'Contratti in corso o da rinnovare' : 'Tutti i contratti, anche scaduti e chiusi (senza bozze)'

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <KpiStrip label="Valore dei contratti">
        <KpiTile label={scope === 'active' ? 'Valore dei contratti attivi' : 'Valore di tutti i contratti'} value={eur0(total)} sub={`${list.length} ${list.length === 1 ? 'cliente' : 'clienti'}`} />
        <KpiTile label="Primo cliente" value={<Box component="span" sx={{ fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis' }}>{list[0]?.name ?? '—'}</Box>} sub={list[0] ? `${eur0(list[0].value)} · ${share(list[0].value, total)}% del totale` : undefined} />
        <KpiTile label="Primi 5 clienti" value={`${share(top5, total)}%`} sub={`del valore, ${eur0(top5)}`} />
        <KpiTile label="Regione principale" value={<Box component="span" sx={{ fontSize: 16 }}>{topRegion?.name ?? '—'}</Box>} sub={topRegion ? `${eur0(topRegion.value)} · ${share(topRegion.value, total)}% del totale` : undefined} />
      </KpiStrip>

      {!list.length ? (
        <Box sx={card}><Typography sx={{ color: 'text.secondary' }}>{scope === 'active' ? 'Nessun contratto attivo con un valore.' : 'Nessun contratto con un valore.'}</Typography></Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1.6fr) minmax(0,1fr)' }, gap: 2, alignItems: 'start' }}>
          <Box component="section" aria-labelledby="cv-rank" sx={card}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography id="cv-rank" component="h2" sx={{ fontSize: 15, fontWeight: 650 }}>{region === undefined ? 'Clienti per valore' : `Clienti in ${regionName(region)}`}</Typography>
              {region !== undefined ? (
                <ButtonBase onClick={() => setRegion(undefined)} aria-label="Tutte le regioni" sx={{ height: 26, px: 1.25, borderRadius: 999, bgcolor: 'archie.field', fontSize: 12.5, fontWeight: 600, gap: 0.75 }}>
                  {regionName(region)} <Box component="span" aria-hidden sx={{ color: 'text.secondary' }}>✕</Box>
                </ButtonBase>
              ) : null}
            </Box>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1.25 }}>{scopeText}. Clic su un cliente per aprirlo.</Typography>
            <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {(showAll ? shown : shown.slice(0, TOP)).map((c, i) => (
                <Box component="li" key={c.id} sx={{ '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
                  <ButtonBase onClick={() => navigate(`/customers${buildQuery({ open: c.id })}`)} sx={{ width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: '26px minmax(0,1fr) auto', gap: 1.25, alignItems: 'center', py: 1, borderRadius: '6px', '&:hover': { bgcolor: 'archie.surface2' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing } }}>
                    <Box sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, fontWeight: 600, color: 'text.secondary', textAlign: 'right' }}>{i + 1}</Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</Typography>
                      <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{regionName(c.region)}{c.province ? ` · ${c.province.toUpperCase()}` : ''} · {c.contracts} {c.contracts === 1 ? 'contratto' : 'contratti'}</Typography>
                      {bar((c.value / maxV) * 100)}
                    </Box>
                    <Box sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{eur0(c.value)}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{share(c.value, region === undefined ? total : shownTotal)}%</Typography>
                    </Box>
                  </ButtonBase>
                </Box>
              ))}
            </Box>
            {shown.length > TOP ? (
              <ButtonBase onClick={() => setShowAll((v) => !v)} sx={{ mt: 1.25, fontSize: 12.5, fontWeight: 600, color: 'primary.main', borderRadius: '4px' }}>
                {showAll ? 'Mostra i primi 10' : `Mostra tutti i ${shown.length} clienti`}
              </ButtonBase>
            ) : null}
          </Box>

          <Box component="section" aria-labelledby="cv-reg" sx={card}>
            <Typography id="cv-reg" component="h2" sx={{ fontSize: 15, fontWeight: 650 }}>Per regione</Typography>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1.25 }}>Dalla provincia del cliente. Clic per filtrare la classifica.</Typography>
            <Box sx={{ display: 'grid', gap: 1 }}>
              {regions.map((g) => {
                const on = region === g.region
                return (
                  <ButtonBase key={g.region ?? 'none'} aria-pressed={on} onClick={() => { setRegion(on ? undefined : g.region); setShowAll(false) }}
                    sx={{ display: 'block', textAlign: 'left', p: '8px 10px', border: '1px solid', borderColor: on ? 'primary.main' : 'divider', borderRadius: '8px', bgcolor: on ? 'archie.field' : 'background.paper',
                      '&:hover': { borderColor: on ? 'primary.main' : 'archie.borderStrong' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.25, alignItems: 'baseline' }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: g.region ? 'text.primary' : 'text.secondary' }}>{g.name}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{eur0(g.value)} <Box component="span" sx={{ fontWeight: 400, fontSize: 12, color: 'text.secondary' }}>{share(g.value, total)}%</Box></Typography>
                    </Box>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{g.customers} {g.customers === 1 ? 'cliente' : 'clienti'}</Typography>
                    {bar((g.value / maxR) * 100)}
                  </ButtonBase>
                )
              })}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}
