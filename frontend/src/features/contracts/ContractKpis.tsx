import * as React from 'react'
import { Box, ButtonBase } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { api } from '@shared/api/client'
import { KpiStrip, KpiTile, SegmentBar } from '../../ui/campo'
import { formatEuro } from '../purchaseorders/types'
import { daysLabel, dShort } from './contractModel'
import type { ExpiryState } from './types'

export type ContractStats = {
  active: number
  by_status: { bozza: number; attivo: number; chiuso: number }
  by_expiry: { ok: number; renew: number; expired: number }
  next_deadlines: { id: number; code: string; title: string; customer_name: string; end_date: string; reminder_date: string; expiry_state: ExpiryState }[]
  /** Solo con contracts.view_contract_value. */
  active_value?: string
}

// eslint-disable-next-line react-refresh/only-export-components
export function useContractStats(reloadKey: unknown, filters: Record<string, unknown>) {
  const [data, setData] = React.useState<ContractStats | null>(null)
  const key = JSON.stringify(filters)
  React.useEffect(() => {
    let alive = true
    api.get<ContractStats>('/contracts/stats/', { params: JSON.parse(key) })
      .then((r) => { if (alive) setData(r.data) })
      .catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [reloadKey, key])
  return data
}

type Props = {
  stats: ContractStats | null
  view: string
  onView: (key: string) => void
  onOpen: (id: number) => void
}

/** Indicatori della pagina Contratti (DESIGN.md › KPI strip). */
export default function ContractKpis({ stats: s, view, onView, onOpen }: Props) {
  const theme = useTheme()
  const toggle = (k: string) => () => onView(view === k ? 'all' : k)
  const total = s ? s.by_status.bozza + s.by_status.attivo + s.by_status.chiuso : 0
  return (
    <KpiStrip label="Indicatori contratti">
      <KpiTile label="Attivi" value={s ? s.active : '—'} unit={s ? `di ${total}` : undefined}
        sub={s ? (s.active_value !== undefined
          ? <><b>{formatEuro(s.active_value)}</b>&nbsp;di valore in corso</>
          : <><b>{s.by_status.bozza}</b>&nbsp;bozze · <b>{s.by_status.chiuso}</b>&nbsp;chiusi</>) : null}>
        {s && s.active ? (
          <SegmentBar
            parts={[
              { key: 'ok', label: 'In corso', value: s.by_expiry.ok, color: theme.palette.success.main },
              { key: 'att', label: 'Da rinnovare', value: s.by_expiry.renew, color: theme.palette.warning.main },
              { key: 'expired', label: 'Scaduti', value: s.by_expiry.expired, color: theme.palette.error.main },
            ].filter((p) => p.value).map((p) => ({ ...p, display: String(p.value) }))}
            onPick={(k) => onView(k === 'expired' ? 'exp' : k === 'ok' ? 'run' : 'att')}
          />
        ) : null}
      </KpiTile>

      <KpiTile label="Da rinnovare" active={view === 'att'} onClick={toggle('att')}
        value={s ? s.by_expiry.renew : '—'}
        sub={s ? (s.by_expiry.renew ? 'avviso di rinnovo partito: prepara il nuovo contratto' : 'nessun avviso di rinnovo in corso') : null} />

      <KpiTile label="Scaduti" active={view === 'exp'} onClick={toggle('exp')}
        value={s ? s.by_expiry.expired : '—'}
        sub={s ? (s.by_expiry.expired ? 'ancora attivi: rinnova o segna chiuso' : 'nessun contratto da sistemare') : null} />

      <KpiTile label="Prossime scadenze" wide>
        {s && s.next_deadlines.length ? (
          <Box sx={{ display: 'grid', gap: '2px', mt: '2px' }}>
            {s.next_deadlines.slice(0, 4).map((d) => {
              const warn = d.expiry_state === 'renew'
              return (
                <ButtonBase key={d.id} onClick={() => onOpen(d.id)} title={`${d.code} · ${d.title}`} sx={{
                  display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 1, alignItems: 'baseline', justifyItems: 'start',
                  fontSize: 12, lineHeight: '19px', px: 0.5, mx: -0.5, borderRadius: '4px', textAlign: 'left',
                  '&:hover': { bgcolor: 'action.hover' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                }}>
                  <Box component="span" sx={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                    <Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>{d.customer_name}</Box> · {d.title}
                  </Box>
                  <Box component="span" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: warn ? 'warning.main' : 'text.secondary', fontWeight: warn ? 600 : 400 }}>
                    {dShort(d.end_date)} · {daysLabel(d.end_date)}
                  </Box>
                </ButtonBase>
              )
            })}
          </Box>
        ) : <Box sx={{ mt: 'auto', fontSize: 12, color: 'text.secondary' }}>{s ? 'Nessuna scadenza in arrivo.' : ''}</Box>}
      </KpiTile>
    </KpiStrip>
  )
}
