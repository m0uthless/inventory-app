import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, ButtonBase, CircularProgress, IconButton, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { CampoIcon, PageHead } from '../ui/campo'
import { MONTHS_LONG, firstName, type CaseTypeOption, type Granularity, type StatsResponse } from '../features/servicenow/snModel'
import { TypeDonut, PeriodBars, TechHeatmap } from '../features/servicenow/SnStats'
import TodayPanel from '../features/servicenow/TodayPanel'
import { WeekAbsences } from '../features/servicenow/SnAbsences'
import type { AbsenceTechnician } from '../features/servicenow/absenceShared'
import { isServiceNowCategoryVisible, type ServiceNowCategory } from '../features/servicenow/visibleCategories'

const NOW = new Date()
const YEARS = [NOW.getFullYear(), NOW.getFullYear() - 1, NOW.getFullYear() - 2]

function Card({ title, end, children }: { title: string; end?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box component="section" aria-label={title} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: '14px 16px', minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography component="h2" sx={{ fontSize: 13.5, fontWeight: 650, flex: 1 }}>{title}</Typography>
        {end}
      </Box>
      {children}
    </Box>
  )
}

const segSx = (on: boolean) => ({ height: 26, px: 1.25, borderRadius: '5px', fontSize: 12.5, fontWeight: on ? 600 : 400, color: on ? 'primary.main' : 'text.secondary', bgcolor: on ? 'archie.field' : 'transparent', '&.Mui-focusVisible': { boxShadow: (t: import('@mui/material').Theme) => t.palette.archie.focusRing } })

/** Dashboard casi (anteprima sn-base, variante B): statistiche a sinistra, oggi e assenze a destra. */
export default function ServiceNowDashboard() {
  const toast = useToast()
  const navigate = useNavigate()
  const { hasPerm } = useAuth()
  const canManage = hasPerm(PERMS.servicenow.case.change)
  const category: ServiceNowCategory = isServiceNowCategoryVisible('biotron') ? 'biotron' : 'philips'

  const [gran, setGran] = React.useState<Granularity>('month')
  const [year, setYear] = React.useState(NOW.getFullYear())
  const [month, setMonth] = React.useState(NOW.getMonth() + 1)
  const [typeId, setTypeId] = React.useState<number | ''>('')
  const [types, setTypes] = React.useState<CaseTypeOption[]>([])
  const [data, setData] = React.useState<StatsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [pdf, setPdf] = React.useState(false)
  const [technicians, setTechnicians] = React.useState<AbsenceTechnician[]>([])
  const [tick, setTick] = React.useState(0)

  React.useEffect(() => {
    api.get<CaseTypeOption[]>('/servicenow-case-types/', { params: { category } }).then((r) => setTypes(r.data)).catch(() => {})
    api.get<AbsenceTechnician[]>('/servicenow-technician-absences/technicians/').then((r) => setTechnicians(r.data.filter((t) => isServiceNowCategoryVisible(t.category)))).catch((e) => toast.error(apiErrorToMessage(e)))
  }, [category, toast])

  const params = React.useMemo(() => {
    const p: Record<string, string | number | number[]> = { year, granularity: gran, category }
    if (gran === 'day') p.month = month
    if (typeId !== '') p.case_type = [typeId]
    return p
  }, [year, gran, month, typeId, category])
  React.useEffect(() => {
    let alive = true
    setLoading(true)
    api.get<StatsResponse>('/servicenow-cases/stats/', { params })
      .then((r) => { if (alive) setData(r.data) })
      .catch((e) => { if (alive) toast.error(apiErrorToMessage(e)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [params, toast, tick])

  const exportPdf = async () => {
    setPdf(true)
    try {
      const res = await api.get('/servicenow-cases/stats-export-pdf/', { params, responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `servicenow_stats_${category}_${year}.pdf`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setPdf(false) }
  }

  const typeNames = types.map((t) => t.name)
  // Periodo in corso, per schiarire la colonna non ancora finita.
  const currentKey = year !== NOW.getFullYear() ? undefined : gran === 'month' ? NOW.getMonth() + 1 : gran === 'day' && month === NOW.getMonth() + 1 ? NOW.getDate() : undefined
  const periodName = gran === 'day' ? `${MONTHS_LONG[month - 1].toLowerCase()} ${year}` : String(year)

  const filters = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Box role="radiogroup" aria-label="Raggruppa per" sx={{ display: 'inline-flex', gap: '2px', p: '2px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'background.paper' }}>
        {([['month', 'Mesi'], ['week', 'Settimane'], ['day', 'Giorni']] as [Granularity, string][]).map(([k, l]) => <ButtonBase key={k} role="radio" aria-checked={gran === k} onClick={() => setGran(k)} sx={segSx(gran === k)}>{l}</ButtonBase>)}
      </Box>
      <TextField select size="small" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ width: 96 }} slotProps={{ htmlInput: { 'aria-label': 'Anno' } }}>
        {YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
      </TextField>
      {gran === 'day' ? (
        <TextField select size="small" value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={{ width: 130 }} slotProps={{ htmlInput: { 'aria-label': 'Mese' } }}>
          {MONTHS_LONG.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
        </TextField>
      ) : null}
      <TextField select size="small" value={typeId} onChange={(e) => setTypeId(e.target.value === '' ? '' : Number(e.target.value))} sx={{ width: 140 }} slotProps={{ select: { displayEmpty: true }, htmlInput: { 'aria-label': 'Type' } }}>
        <MenuItem value="">Tutti i type</MenuItem>
        {types.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
      </TextField>
      <Tooltip title="Esporta in PDF con questi filtri">
        <span><IconButton aria-label="Esporta in PDF" disabled={pdf || loading} onClick={() => void exportPdf()} sx={{ width: 34, height: 34 }}>{pdf ? <CircularProgress size={15} /> : <CampoIcon name="download" />}</IconButton></span>
      </Tooltip>
    </Box>
  )

  const top = data?.kpi.top_technician
  return (
    <Box>
      <PageHead title="Dashboard casi" actions={filters} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.25fr) minmax(0, 1fr)' }, gap: 1.75, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 1.75, minWidth: 0 }}>
          <Card title="Andamento" end={loading ? <CircularProgress size={14} /> : undefined}>
            {data ? (
              <>
                <Box sx={{ display: 'flex', gap: 2.25, flexWrap: 'wrap', fontSize: 12.5, color: 'text.secondary', mb: 1.75, '& b': { color: 'text.primary', fontSize: 15, mr: 0.4, fontVariantNumeric: 'tabular-nums' } }}>
                  <span><b>{data.kpi.total.toLocaleString('it-IT')}</b>casi in {periodName}</span>
                  {top ? <span>più casi: <b style={{ fontSize: 13 }}>{firstName(top.name)}</b>({top.count})</span> : null}
                </Box>
                <Box sx={{ display: 'flex', gap: 2.25, alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TypeDonut data={data} typeNames={typeNames} />
                  <PeriodBars data={data} typeNames={typeNames} currentKey={currentKey} />
                </Box>
                {currentKey ? <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 1 }}>La colonna più chiara è il periodo in corso.</Typography> : null}
              </>
            ) : <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Caricamento…</Typography>}
          </Card>
          <Card title="Per tecnico">
            {data ? <TechHeatmap data={data} /> : <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Caricamento…</Typography>}
          </Card>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.75, minWidth: 0 }}>
          <Card title="Oggi" end={<ButtonBase onClick={() => navigate('/servicenow-cases')} sx={{ fontSize: 12.5, fontWeight: 550, color: 'primary.main', gap: 0.5 }}>Vai ai casi <CampoIcon name="arrowR" size={12} /></ButtonBase>}>
            <TodayPanel compact refreshKey={tick} canManage={canManage} onUnassigned={() => navigate('/servicenow-cases?vista=unassigned')} onChanged={() => setTick((x) => x + 1)} />
          </Card>
          <Card title="Assenze della settimana">
            <WeekAbsences technicians={technicians} canManage={canManage} refreshKey={tick} onChanged={() => setTick((x) => x + 1)} />
          </Card>
        </Box>
      </Box>
    </Box>
  )
}
