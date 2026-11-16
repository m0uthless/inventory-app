/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { Box, ButtonBase, CircularProgress, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { CampoIcon } from '../../ui/campo'
import { Empty, Group, GroupLink, Loading } from '../../ui/campo/ListRows'

export type MaintenancePlanInfo = {
  id: number
  title: string
  schedule_type: 'interval' | 'fixed_date'
  interval_value?: number | null
  interval_unit?: 'days' | 'weeks' | 'months' | 'years' | null
  fixed_month?: number | null
  fixed_day?: number | null
  due_date?: string | null
  alert_days_before?: number
}
export type MaintenanceEventInfo = {
  id: number
  plan_title?: string | null
  performed_at: string
  result: 'ok' | 'ko' | 'partial' | 'not_planned'
  tech_name?: string | null
  notes?: string | null
  pdf_url?: string | null
}
export type InventoryMaintenance = { plans: MaintenancePlanInfo[]; events: MaintenanceEventInfo[] }

/** Piani e interventi del sistema; null mentre carica, undefined se non disponibili (permesso). */
export function useInventoryMaintenance(inventoryId: number | null, enabled: boolean, reloadKey?: unknown) {
  const [data, setData] = React.useState<InventoryMaintenance | null | undefined>(undefined)
  React.useEffect(() => {
    if (!enabled || inventoryId == null) { setData(undefined); return }
    let alive = true
    setData(null)
    api.get<InventoryMaintenance>(`/inventories/${inventoryId}/maintenance/`)
      .then((r) => { if (alive) setData(r.data) })
      .catch(() => { if (alive) setData(undefined) })
    return () => { alive = false }
  }, [inventoryId, enabled, reloadKey])
  return data
}

const DAY = 864e5
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const parse = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }
export const daysUntil = (s?: string | null) => (s ? Math.round((parse(s).getTime() - today().getTime()) / DAY) : null)
const dIt = (s: string) => s.slice(0, 10).split('-').reverse().join('/')
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

/** Almeno un piano scaduto o in scadenza entro 30 giorni. */
export const maintenanceDue = (m?: InventoryMaintenance | null) => Boolean(m?.plans.some((p) => { const n = daysUntil(p.due_date); return n != null && n <= 30 }))

const UNIT: Record<string, [string, string]> = { days: ['giorno', 'giorni'], weeks: ['settimana', 'settimane'], months: ['mese', 'mesi'], years: ['anno', 'anni'] }
function scheduleLabel(p: MaintenancePlanInfo) {
  if (p.schedule_type === 'fixed_date') {
    return p.fixed_day && p.fixed_month ? `ogni anno il ${String(p.fixed_day).padStart(2, '0')}/${String(p.fixed_month).padStart(2, '0')}` : 'ogni anno'
  }
  const u = UNIT[p.interval_unit ?? ''] ?? ['', '']
  const v = p.interval_value ?? 0
  if (!v || !u[0]) return 'periodicità non indicata'
  return v === 1 ? `ogni ${u[0]}` : `ogni ${v} ${u[1]}`
}

const pill = { display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: '5px', fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap' } as const
function DueBadge({ date }: { date?: string | null }) {
  const n = daysUntil(date)
  if (n == null) return null
  if (n < 0) return <Box component="span" sx={{ ...pill, bgcolor: 'error.light', color: 'error.main' }}>{n === -1 ? 'scaduta ieri' : `scaduta da ${-n} giorni`}</Box>
  if (n <= 30) return <Box component="span" sx={{ ...pill, bgcolor: 'warning.light', color: 'warning.main' }}>{n === 0 ? 'oggi' : n === 1 ? 'domani' : `tra ${n} giorni`}</Box>
  const m = Math.round(n / 30)
  return <Box component="span" sx={{ ...pill, bgcolor: 'archie.neutralBg', color: 'text.secondary' }}>{n < 60 ? `tra ${n} giorni` : `tra ${m} mesi`}</Box>
}

const RESULT: Record<string, [string, string]> = {
  ok: ['Eseguita', 'success.main'], partial: ['Parziale', 'warning.main'], ko: ['Non riuscita', 'error.main'], not_planned: ['Non prevista', 'text.secondary'],
}

const fileBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 30, px: 1.125, borderRadius: '7px', border: '1px solid', borderColor: 'divider',
  bgcolor: 'background.paper', fontSize: 12, fontWeight: 600, color: 'text.primary',
  '&:hover': { borderColor: 'archie.borderStrong', bgcolor: 'archie.surface2' },
  '&.Mui-focusVisible': { boxShadow: (t: { palette: { archie: { focusRing: string } } }) => t.palette.archie.focusRing },
} as const

function UploadReport({ eventId, onDone }: { eventId: number; onDone: () => void }) {
  const toast = useToast()
  const input = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const upload = async (f: File) => {
    const fd = new FormData()
    fd.append('pdf_file', f)
    setBusy(true)
    try {
      await api.post(`/maintenance-events/${eventId}/upload-pdf/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Rapportino caricato')
      onDone()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f) }} />
      <ButtonBase onClick={() => input.current?.click()} disabled={busy} aria-label="Carica il rapportino PDF" sx={{ ...fileBtn, borderStyle: 'dashed', color: 'text.secondary', fontWeight: 500 }}>
        {busy ? <CircularProgress size={13} /> : <CampoIcon name="upload" size={14} />}Carica
      </ButtonBase>
    </>
  )
}

/** Scheda Manutenzioni del pannello inventario: piani che coprono il sistema e interventi con rapportino. */
export function InventoryMaintenancePanel({ data, canUpload, onChanged, onOpenModule }: {
  data: InventoryMaintenance | null | undefined
  canUpload: boolean
  onChanged: () => void
  onOpenModule: () => void
}) {
  if (data === null) return <Loading />
  if (!data) return <Empty text="Manutenzioni non disponibili." />
  return (
    <>
      <Group first title={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><CampoIcon name="calendar" size={13} />Piani di manutenzione</Box>}
        count={data.plans.length} action={<GroupLink label="Apri in Manutenzione" onClick={onOpenModule} />}>
        {data.plans.length ? (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
            {data.plans.map((p) => (
              <Box component="li" key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.375, '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 550 }} noWrap>{p.title}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{scheduleLabel(p)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                  {p.due_date ? <Box component="span" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12.5, fontWeight: 600 }}>{dIt(p.due_date)}</Box> : null}
                  <DueBadge date={p.due_date} />
                </Box>
              </Box>
            ))}
          </Box>
        ) : <Empty text="Nessun piano di manutenzione copre questo sistema." />}
      </Group>

      <Group title={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><CampoIcon name="file" size={13} />Interventi e rapportini</Box>} count={data.events.length}>
        {data.events.length ? (
          <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, borderTop: '1px solid', borderColor: 'divider' }}>
            {data.events.map((e) => {
              const d = parse(e.performed_at)
              const [rl, rc] = RESULT[e.result] ?? RESULT.not_planned
              return (
                <Box component="li" key={e.id} sx={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', gap: 1.5, alignItems: 'center', py: 1.125, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box aria-label={dIt(e.performed_at)} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, py: 0.625, borderRadius: '8px', bgcolor: 'archie.surface2' }}>
                    <Box component="b" sx={{ fontSize: 16, fontWeight: 650 }}>{d.getDate()}</Box>
                    <Box component="small" sx={{ fontSize: 10.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.04em' }}>{MESI[d.getMonth()]} {String(d.getFullYear()).slice(2)}</Box>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 550 }} noWrap>{e.plan_title || 'Intervento'}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap title={e.notes || undefined}>
                      {e.tech_name ? `${e.tech_name} · ` : ''}<Box component="span" sx={{ color: rc, fontWeight: 600 }}>{rl}</Box>
                    </Typography>
                  </Box>
                  {e.pdf_url ? (
                    <ButtonBase component="a" href={e.pdf_url} target="_blank" rel="noopener" aria-label={`Apri il rapportino del ${dIt(e.performed_at)}`} sx={fileBtn}>
                      <Box component="span" sx={{ color: 'error.main', display: 'inline-flex' }}><CampoIcon name="file" size={14} /></Box>PDF
                      <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}><CampoIcon name="download" size={14} /></Box>
                    </ButtonBase>
                  ) : canUpload ? <UploadReport eventId={e.id} onDone={onChanged} />
                    : <Typography component="span" sx={{ fontSize: 12, color: 'text.disabled' }}>Nessun rapportino</Typography>}
                </Box>
              )
            })}
          </Box>
        ) : <Empty text="Nessun intervento registrato su questo sistema." />}
      </Group>
    </>
  )
}
