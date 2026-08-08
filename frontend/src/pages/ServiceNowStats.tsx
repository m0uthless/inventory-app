/**
 * ServiceNowStats — pagina statistiche casi ServiceNow gestiti per tecnico.
 * Layout a due colonne verticali, una per categoria (Philips / Biotron):
 * ciascuna ha filtri (Anno, Tecnico, Type, granularità, vista) e numeri
 * completamente indipendenti dall'altra colonna.
 */
import * as React from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import { theme } from '../theme'
import {
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip as MuiTooltip,
  Typography,
} from '@mui/material'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import {
  Tooltip,
  ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { isRecord } from '@shared/utils/guards'

// ─── Tipi ────────────────────────────────────────────────────────────────────

type AbsenceReasonCode = 'ferie' | 'malattia' | 'trasferta' | 'altro'
type StatsPeriod = { key: number; label: string }
type StatsSeries = {
  user_id: number | null
  name: string
  counts: number[]
  absence_periods?: (AbsenceReasonCode | null)[]
  /** Breakdown per Type (es. {"L1": 12, "EBIT": 3}), aggregato su tutti i periodi. */
  type_totals?: Record<string, number>
  /** Come type_totals ma per singolo periodo (stesso ordine di counts/periods). */
  type_totals_by_period?: Record<string, number>[]
}
type TypeBreakdownRow = { id: number; name: string; count: number }
type StatsResponse = {
  granularity: 'day' | 'week' | 'month'
  year: number
  periods: StatsPeriod[]
  series: StatsSeries[]
  kpi: {
    total: number
    top_technician: { id: number | null; name: string; count: number } | null
    top_type: { value: number; label: string; count: number } | null
  }
  type_breakdown: TypeBreakdownRow[]
}

type UserOption = { id: number; username: string; full_name?: string; is_philips: boolean; is_servicenow_technician: boolean }
type CaseTypeOption = { id: number; name: string; category: string }

const CATEGORIES = [
  { value: 'philips', label: 'Philips' },
  { value: 'biotron', label: 'Biotron' },
] as const

const TYPE_COLORS = ['#185fa5', '#0f6e56', '#854f0b', '#993556', '#5f5e5a', '#4b5fa0']

function topTechnicianEmoji(count: number): string {
  if (count <= 0) return '😌'
  if (count <= 2) return '🙂'
  if (count <= 5) return '😅'
  if (count <= 9) return '🥵'
  return '😵‍💫'
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

const MONTH_OPTIONS = [
  { value: 1, label: 'Gennaio' }, { value: 2, label: 'Febbraio' }, { value: 3, label: 'Marzo' },
  { value: 4, label: 'Aprile' }, { value: 5, label: 'Maggio' }, { value: 6, label: 'Giugno' },
  { value: 7, label: 'Luglio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Settembre' },
  { value: 10, label: 'Ottobre' }, { value: 11, label: 'Novembre' }, { value: 12, label: 'Dicembre' },
]

const WEEK_OPTIONS = Array.from({ length: 53 }, (_, i) => i + 1)

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, helper, accent, valueFontSize = '1.75rem' }: {
  label: string; value: string; helper?: string; accent: string; valueFontSize?: string
}) {
  const theme = useTheme()
  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden', borderRadius: '8px', flex: 1, minWidth: 0,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      p: { xs: '12px', sm: '14px 16px' },
      backgroundImage: `linear-gradient(135deg, ${alpha(accent, 0.62)} 0%, ${alpha(accent, 0.86)} 100%)`,
      border: `1px solid ${alpha(accent, 0.18)}`,
      boxShadow: `0 10px 28px ${alpha(accent, 0.18)}`,
      '&::before': {
        content: '""', position: 'absolute',
        width: 80, height: 80, borderRadius: '50%',
        right: -20, top: -16,
        backgroundColor: alpha(theme.palette.common.white, 0.14),
      },
      '&::after': {
        content: '""', position: 'absolute',
        width: 100, height: 100, borderRadius: '50%',
        right: 16, bottom: -52,
        backgroundColor: alpha(theme.palette.common.white, 0.10),
      },
    }}>
      <Box sx={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: alpha(theme.palette.common.white, 0.85), mb: '6px', lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: valueFontSize, fontWeight: 800, color: theme.palette.common.white, lineHeight: 1.2, letterSpacing: -0.5,
            textShadow: `0 2px 10px ${alpha(theme.palette.common.black, 0.12)}`,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {value}
        </Typography>
        {helper && (
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: alpha(theme.palette.common.white, 0.75), mt: '4px' }} noWrap>
            {helper}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

// ─── Mini donut "Casi per Type" ─────────────────────────────────────────────

function TypeMiniDonut({ rows }: { rows: TypeBreakdownRow[] }) {
  const theme = useTheme()
  const total = rows.reduce((s, r) => s + r.count, 0)

  if (total === 0) {
    return (
      <Box sx={{ bgcolor: 'background.paper', border: '0.5px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, flex: 1, minWidth: 200 }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>
          Casi per Type
        </Typography>
        <Typography sx={{ color: 'text.disabled', fontSize: 13 }}>Nessun dato</Typography>
      </Box>
    )
  }

  // Massimo 3 righe di legenda SEMPRE (comprese in "Altri" le voci oltre le
  // prime 2 quando i Type sono più di 3): tiene la card della stessa altezza
  // a prescindere da quanti Type ha la categoria (Philips ne ha 4, Biotron 3),
  // evitando di dover forzare un'altezza fissa arbitraria sull'intera riga KPI.
  const sorted = [...rows].sort((a, b) => b.count - a.count)
  const maxTop = sorted.length > 3 ? 2 : 3
  const top = sorted.slice(0, maxTop)
  const restCount = sorted.slice(maxTop).reduce((s, r) => s + r.count, 0)
  const pieData: TypeBreakdownRow[] = restCount > 0 ? [...top, { id: -1, name: 'Altri', count: restCount }] : top

  return (
    <Box sx={{
      bgcolor: 'background.paper', border: '0.5px solid', borderColor: 'divider', borderRadius: 1,
      p: 1.5, flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 1.25,
    }}>
      <Box sx={{ width: 64, height: 64, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="count" nameKey="name" innerRadius={16} outerRadius={30} paddingAngle={1} stroke="none" isAnimationActive={false}>
              {pieData.map((r, i) => <Cell key={r.id} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${theme.palette.divider}` }} isAnimationActive={false} />
          </PieChart>
        </ResponsiveContainer>
      </Box>
      <Stack spacing={0.3} sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
          Casi per Type
        </Typography>
        {pieData.map((r, i) => (
          <Stack key={r.id} direction="row" alignItems="center" spacing={0.6}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: TYPE_COLORS[i % TYPE_COLORS.length], flexShrink: 0 }} />
            <Typography variant="caption" noWrap sx={{ flex: 1, minWidth: 0 }}>{r.name}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', flexShrink: 0 }}>
              {Math.round((r.count / total) * 100)}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}

// ─── Motivo assenza → lettera/colore cella heatmap ───────────────────────────

const ABSENCE_CELL_STYLE: Record<AbsenceReasonCode, { letter: string; bg: string; fg: string }> = {
  malattia:  { letter: 'I', bg: theme.palette.error.main, fg: theme.palette.common.white },  // rosso
  ferie:     { letter: 'H', bg: theme.palette.info.main, fg: theme.palette.common.white },  // azzurro
  trasferta: { letter: 'T', bg: '#9ca3af', fg: theme.palette.text.primary },  // grigio (come Altro)
  altro:     { letter: 'T', bg: '#9ca3af', fg: theme.palette.text.primary },  // grigio
}

// ─── Matrice heatmap ────────────────────────────────────────────────────────

export function StatsMatrix({ periods, series, showRowTotal, rowTotalTooltip, cellTooltip }: {
  periods: StatsPeriod[]
  series: StatsSeries[]
  /** Aggiunge una colonna "Totale" (somma dei periodi) per ogni tecnico. */
  showRowTotal?: boolean
  /** Testo del tooltip mostrato sul totale di una riga (es. "Di cui EBIT: 3"). null/undefined = nessun tooltip per quella riga. */
  rowTotalTooltip?: (s: StatsSeries) => string | null | undefined
  /** Testo del tooltip mostrato su una singola cella (tecnico × periodo), es. "Di cui EBIT: 1" per quel giorno. null/undefined = nessun tooltip per quella cella. */
  cellTooltip?: (s: StatsSeries, periodIndex: number) => string | null | undefined
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.counts))

  const colorFor = (v: number) => {
    if (v === 0) return { bg: 'transparent', fg: 'text.disabled' }
    const ratio = v / max
    const stops = [
      { t: 0.15, bg: '#E1F5EE', fg: '#04342C' },
      { t: 0.40, bg: '#9FE1CB', fg: '#04342C' },
      { t: 0.70, bg: '#5DCAA5', fg: '#04342C' },
      { t: 1.00, bg: '#0F6E56', fg: '#E1F5EE' },
    ]
    const stop = stops.find((s) => ratio <= s.t) ?? stops[stops.length - 1]
    return { bg: stop.bg, fg: stop.fg }
  }

  if (series.length === 0) {
    return <Typography sx={{ color: 'text.disabled', fontSize: 13, py: 4, textAlign: 'center' }}>Nessun dato per i filtri selezionati</Typography>
  }

  const rowTotal = (s: StatsSeries) => s.counts.reduce((a, b) => a + b, 0)
  const grandTotal = series.reduce((sum, s) => sum + rowTotal(s), 0)

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
        <Box component="thead">
          <Box component="tr">
            <Box component="th" sx={{ textAlign: 'left', p: 0.5, color: 'text.secondary', fontWeight: 600, position: 'sticky', left: 0, bgcolor: 'background.paper' }}>Tecnico</Box>
            {periods.map((p) => (
              <Box component="th" key={p.key} sx={{ textAlign: 'center', p: 0.5, color: 'text.secondary', fontWeight: 600, minWidth: 28 }}>{p.label}</Box>
            ))}
            {showRowTotal && (
              <Box component="th" sx={{
                textAlign: 'center', p: 0.5, color: 'text.secondary', fontWeight: 700, minWidth: 40,
                borderLeft: '1px solid', borderColor: 'divider',
                position: 'sticky', right: 0, bgcolor: 'background.paper',
              }}>
                Totale
              </Box>
            )}
          </Box>
        </Box>
        <Box component="tbody">
          {series.map((s) => (
            <Box component="tr" key={s.user_id ?? 'unassigned'}>
              <Box component="td" sx={{ p: 0.5, whiteSpace: 'nowrap', position: 'sticky', left: 0, bgcolor: 'background.paper' }}>{s.name}</Box>
              {s.counts.map((v, i) => {
                const reason = s.absence_periods?.[i]
                const style = reason ? ABSENCE_CELL_STYLE[reason] : null
                const c = style ? { bg: style.bg, fg: style.fg } : colorFor(v)
                const tooltip = cellTooltip?.(s, i)
                const inner = (
                  <Box component="td" sx={{ p: 0.4, ...(tooltip ? { cursor: 'help' } : {}) }}>
                    <Box sx={{
                      bgcolor: c.bg, color: c.fg, borderRadius: 0.5, textAlign: 'center', fontWeight: 700, py: 0.3,
                      ...(tooltip ? { textDecoration: 'underline dotted', textUnderlineOffset: '2px' } : {}),
                    }}>
                      {style ? style.letter : (v || '')}
                    </Box>
                  </Box>
                )
                // Stesso principio della cella Totale: il Tooltip avvolge
                // l'INTERA cella (hitbox grande) e la sottolineatura
                // tratteggiata segnala visivamente che c'è altro da vedere.
                return (
                  <React.Fragment key={periods[i].key}>
                    {tooltip ? <MuiTooltip title={tooltip} arrow>{inner}</MuiTooltip> : inner}
                  </React.Fragment>
                )
              })}
              {showRowTotal && (() => {
                const total = rowTotal(s)
                const tooltip = rowTotalTooltip?.(s)
                const cellBox = (
                  <Box
                    component="td"
                    sx={{
                      p: 0.4, borderLeft: '1px solid', borderColor: 'divider',
                      position: 'sticky', right: 0, bgcolor: 'background.paper',
                      ...(tooltip ? { cursor: 'help' } : {}),
                    }}
                  >
                    <Box sx={{
                      textAlign: 'center', fontWeight: 700, py: 0.3, borderRadius: 0.5,
                      color: total ? 'text.primary' : 'text.disabled',
                      ...(tooltip ? {
                        textDecoration: 'underline dotted',
                        textDecorationColor: 'text.disabled',
                        textUnderlineOffset: '3px',
                      } : {}),
                    }}>
                      {total || '—'}
                    </Box>
                  </Box>
                )
                // Il Tooltip avvolge l'INTERA cella (non solo il numero): un
                // hitbox più grande evita che sfiorare di un pixel il bordo
                // faccia sembrare l'hover "rotto". La sottolineatura
                // tratteggiata sopra è l'indizio visivo che c'è altro da
                // vedere, indipendente dal solo cambio di cursore.
                return tooltip ? <MuiTooltip title={tooltip} arrow>{cellBox}</MuiTooltip> : cellBox
              })()}
            </Box>
          ))}
        </Box>
        <Box component="tfoot">
          <Box component="tr">
            <Box component="td" sx={{ p: 0.5, whiteSpace: 'nowrap', position: 'sticky', left: 0, bgcolor: 'background.paper', fontWeight: 700, borderTop: '1px solid', borderColor: 'divider' }}>
              Totale
            </Box>
            {periods.map((p, i) => {
              const periodTotal = series.reduce((sum, s) => sum + s.counts[i], 0)
              return (
                <Box component="td" key={p.key} sx={{ p: 0.4, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ textAlign: 'center', fontWeight: 700, py: 0.3, color: periodTotal ? 'text.primary' : 'text.disabled' }}>
                    {periodTotal || '—'}
                  </Box>
                </Box>
              )
            })}
            {showRowTotal && (
              <Box component="td" sx={{
                p: 0.4, borderTop: '1px solid', borderLeft: '1px solid', borderColor: 'divider',
                position: 'sticky', right: 0, bgcolor: 'background.paper',
              }}>
                <Box sx={{ textAlign: 'center', fontWeight: 700, py: 0.3, color: grandTotal ? 'text.primary' : 'text.disabled' }}>
                  {grandTotal || '—'}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

// ─── Filtro Type client-side dentro una heatmap già caricata ────────────────
// Ricalcola i conteggi per periodo/riga sommando solo i Type selezionati,
// usando type_totals_by_period (già presente nella risposta per il tooltip
// "Di cui EBIT"): nessuna chiamata API aggiuntiva. Righe che si azzerano del
// tutto dopo il filtro vengono nascoste.
function filterSeriesByTypes(data: StatsResponse, typeNames: string[]): StatsResponse {
  if (typeNames.length === 0) return data
  const series = data.series
    .map((s) => {
      const counts = data.periods.map((_, i) => {
        const perPeriod = s.type_totals_by_period?.[i]
        if (!perPeriod) return 0
        return typeNames.reduce((sum, t) => sum + (perPeriod[t] ?? 0), 0)
      })
      return { ...s, counts }
    })
    .filter((s) => s.counts.some((c) => c > 0))
  return { ...data, series }
}

// ─── Blocco tabella heatmap + legenda assenze (riusato per ogni tabella) ────

function StatsTableBlock({ title, data, showRowTotal, rowTotalTooltip, cellTooltip, typeFilterOptions }: {
  title?: string
  data: StatsResponse
  showRowTotal?: boolean
  rowTotalTooltip?: (s: StatsSeries) => string | null | undefined
  cellTooltip?: (s: StatsSeries, periodIndex: number) => string | null | undefined
  /** Se presente, mostra un chip per Type elencato per filtrare la heatmap
   * (client-side, vedi filterSeriesByTypes). Nessun chip selezionato = vista
   * combinata (comportamento invariato). */
  typeFilterOptions?: string[]
}) {
  const [activeTypes, setActiveTypes] = React.useState<string[]>([])
  const toggleType = (name: string) => {
    setActiveTypes((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]))
  }
  const filterActive = activeTypes.length > 0
  const shown = filterActive ? filterSeriesByTypes(data, activeTypes) : data

  return (
    <Box sx={{ bgcolor: 'background.paper', border: '0.5px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
      {title && (
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
          {title}
        </Typography>
      )}
      {typeFilterOptions && typeFilterOptions.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
          {typeFilterOptions.map((name) => (
            <Chip
              key={name}
              size="small"
              label={name}
              clickable
              onClick={() => toggleType(name)}
              color={activeTypes.includes(name) ? 'primary' : 'default'}
              variant={activeTypes.includes(name) ? 'filled' : 'outlined'}
              sx={{ fontSize: '0.72rem' }}
            />
          ))}
        </Stack>
      )}
      <StatsMatrix
        periods={shown.periods}
        series={shown.series}
        showRowTotal={showRowTotal}
        // Il tooltip "Di cui EBIT" ha senso solo sulla vista combinata: con un
        // filtro attivo (es. solo L1) il sottoinsieme EBIT non è più pertinente.
        rowTotalTooltip={filterActive ? undefined : rowTotalTooltip}
        cellTooltip={filterActive ? undefined : cellTooltip}
      />
      {shown.series.some((s) => s.absence_periods?.some(Boolean)) && (
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
          {(['malattia', 'ferie', 'altro'] as const).map((r) => (
            <Stack key={r} direction="row" alignItems="center" spacing={0.5}>
              <Box sx={{
                width: 16, height: 16, borderRadius: 0.5,
                bgcolor: ABSENCE_CELL_STYLE[r].bg, color: ABSENCE_CELL_STYLE[r].fg,
                fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {ABSENCE_CELL_STYLE[r].letter}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {r === 'malattia' ? 'Malattia' : r === 'ferie' ? 'Ferie' : 'Trasferta / Altro'}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  )
}

// ─── Type Philips raggruppati per le due tabelle (vedi CategoryStatsPanel) ──
// "Casi L1 · EBIT": tabella principale, totale riga = L1+EBIT combinati,
// col tooltip che isola il sottoinsieme EBIT. "AC · GEMELLI · RIS": tabella
// separata, i tre Type sommati in un unico numero per cella. Biotron non ha
// questi Type (solo L1/PRIVATI/CDD) e non è toccato da questo split.
const PHILIPS_MAIN_TYPES = ['L1', 'EBIT']
const PHILIPS_SECONDARY_TYPES = ['AC', 'GEMELLI', 'RIS']
// Biotron: seconda heatmap dedicata ai soli casi CDD, affiancata a quella
// generale (vedi CategoryStatsPanel). BIOTRON_MAIN_TYPES alimenta i 2 chip
// filtro L1/PRIVATI dentro la heatmap "Tutti i casi".
const CDD_TYPE_NAME = 'CDD'
const BIOTRON_MAIN_TYPES = ['L1', 'PRIVATI']

// ─── Pannello statistiche per una singola categoria ──────────────────────────

function CategoryStatsPanel({ category, label, allUsers }: {
  category: 'philips' | 'biotron'
  label: string
  allUsers: UserOption[]
}) {
  const toast = useToast()

  const [year, setYear]             = React.useState(CURRENT_YEAR)
  const [granularity, setGranularity] = React.useState<'day' | 'week' | 'month'>('day')
  const [month, setMonth]           = React.useState(new Date().getMonth() + 1)
  const [week, setWeek]             = React.useState<number | ''>('')
  const [assignedTo, setAssignedTo] = React.useState<number[]>([])

  const [typeRows, setTypeRows] = React.useState<CaseTypeOption[]>([])
  // Tipo Biotron "CDD": non più selezionabile via chip, ha sempre una
  // seconda heatmap dedicata affiancata a quella generale (vedi CDD_TYPE_NAME).
  const [data, setData] = React.useState<StatsResponse | null>(null)
  // Solo per Philips: dataset della tabella "L1 · EBIT" e "AC · GEMELLI · RIS".
  const [mainData, setMainData] = React.useState<StatsResponse | null>(null)
  const [secondaryData, setSecondaryData] = React.useState<StatsResponse | null>(null)
  // Solo per Biotron: dataset della seconda heatmap, filtrata sul solo Type CDD.
  const [cddData, setCddData] = React.useState<StatsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)

  // Tecnici assegnabili a questa categoria (stesso criterio del drawer di inserimento)
  const technicians = allUsers.filter((u) => u.is_servicenow_technician && (category === 'philips' ? u.is_philips : !u.is_philips))

  React.useEffect(() => {
    api.get<CaseTypeOption[]>('/servicenow-case-types/', { params: { category } })
      .then((r) => setTypeRows(r.data))
      .catch(() => {})
  }, [category])

  const mainTypeIds = React.useMemo(
    () => typeRows.filter((t) => PHILIPS_MAIN_TYPES.includes(t.name)).map((t) => t.id),
    [typeRows],
  )
  const secondaryTypeIds = React.useMemo(
    () => typeRows.filter((t) => PHILIPS_SECONDARY_TYPES.includes(t.name)).map((t) => t.id),
    [typeRows],
  )
  const cddTypeIds = React.useMemo(
    () => typeRows.filter((t) => t.name === CDD_TYPE_NAME).map((t) => t.id),
    [typeRows],
  )

  const buildStatsParams = React.useCallback((overrideCaseTypeIds?: number[]): Record<string, string | number | number[]> => {
    const params: Record<string, string | number | number[]> = { year, granularity, category }
    if (granularity === 'day') params.month = month
    if (granularity === 'week' && week !== '') params.week = week
    // Ogni chiamata passa esplicitamente il set di Type che le serve
    // (o nessuno, per il dataset "tutti i Type").
    const caseTypeIds = overrideCaseTypeIds ?? []
    if (caseTypeIds.length > 0) params.case_type = caseTypeIds
    if (assignedTo.length > 0) params.assigned_to = assignedTo
    return params
  }, [category, year, granularity, month, week, assignedTo])

  // Per Philips servono i type_id di L1/EBIT/AC/GEMELLI/RIS (da typeRows)
  // prima di poter interrogare le due tabelle: senza aspettarli si
  // vedrebbe per un istante il dataset "tutti i Type" al posto di quello
  // corretto, finché typeRows non arriva.
  const philipsTypesReady = category !== 'philips' || (mainTypeIds.length > 0 && secondaryTypeIds.length > 0)

  React.useEffect(() => {
    if (!philipsTypesReady) return
    setLoading(true)
    if (category === 'philips') {
      Promise.all([
        api.get<StatsResponse>('/servicenow-cases/stats/', { params: buildStatsParams([]) }),        // KPI: tutti i Type
        api.get<StatsResponse>('/servicenow-cases/stats/', { params: buildStatsParams(mainTypeIds) }),
        api.get<StatsResponse>('/servicenow-cases/stats/', { params: buildStatsParams(secondaryTypeIds) }),
      ])
        .then(([kpiRes, mainRes, secRes]) => {
          setData(kpiRes.data)
          setMainData(mainRes.data)
          setSecondaryData(secRes.data)
        })
        .catch((e) => toast.error(apiErrorToMessage(e)))
        .finally(() => setLoading(false))
    } else {
      api.get<StatsResponse>('/servicenow-cases/stats/', { params: buildStatsParams() })
        .then((r) => setData(r.data))
        .catch((e) => toast.error(apiErrorToMessage(e)))
        .finally(() => setLoading(false))
    }
  }, [philipsTypesReady, category, buildStatsParams, mainTypeIds, secondaryTypeIds, toast])

  // Seconda heatmap Biotron, filtrata sul solo Type CDD: fetch indipendente,
  // non blocca né è bloccata dal caricamento del dataset generale sopra.
  React.useEffect(() => {
    if (category !== 'biotron' || cddTypeIds.length === 0) {
      setCddData(null)
      return
    }
    api.get<StatsResponse>('/servicenow-cases/stats/', { params: buildStatsParams(cddTypeIds) })
      .then((r) => setCddData(r.data))
      .catch((e) => toast.error(apiErrorToMessage(e)))
  }, [category, cddTypeIds, buildStatsParams, toast])

  const [exportingPdf, setExportingPdf] = React.useState(false)

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      const res = await api.get('/servicenow-cases/stats-export-pdf/', {
        params: buildStatsParams(),
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `servicenow_stats_${category}_${year}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setExportingPdf(false)
    }
  }

  const isSm = { size: 'small' as const }

  // Totale riga L1+EBIT combinati: il tooltip isola il sottoinsieme EBIT.
  // Sempre visibile quando la riga ha almeno un caso (anche "Di cui EBIT: 0"),
  // altrimenti il mouseover su una persona con soli case L1 non mostrava
  // nulla e sembrava "rotto".
  const ebitTooltip = (s: StatsSeries) => {
    const total = s.counts.reduce((a, b) => a + b, 0)
    if (total === 0) return null
    const ebit = s.type_totals?.EBIT ?? 0
    return `Di cui EBIT: ${ebit}`
  }

  // Stesso principio ma per singola cella (tecnico × giorno/periodo), non
  // solo sul totale riga.
  const ebitCellTooltip = (s: StatsSeries, i: number) => {
    if (s.counts[i] === 0) return null
    const ebit = s.type_totals_by_period?.[i]?.EBIT ?? 0
    return `Di cui EBIT: ${ebit}`
  }

  const dataReady = category === 'philips' ? Boolean(data && mainData && secondaryData) : Boolean(data)

  return (
    <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{label}</Typography>

      {/* Filtri dedicati alla categoria: card bianca per staccarli dallo
          sfondo della pagina (altrimenti risultavano grigio su grigio). */}
      <Box sx={{ bgcolor: 'background.paper', border: '0.5px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField {...isSm} select label="Anno" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ width: 100 }}>
            {YEAR_OPTIONS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>

          <TextField
            {...isSm} select label="Tecnico" value={assignedTo}
            InputLabelProps={{ shrink: true }}
            onChange={(e) => {
              const raw = e.target.value
              const ids = typeof raw === 'string'
                ? (raw === '' ? [] : raw.split(',').map(Number))
                : (raw as number[])
              setAssignedTo(ids)
            }}
            slotProps={{
              select: {
                multiple: true,
                displayEmpty: true,
                renderValue: (v) => {
                  const ids = v as number[]
                  if (ids.length === 0) return 'Tutti'
                  if (ids.length === 1) {
                    const u = technicians.find((t) => t.id === ids[0])
                    return u ? (u.full_name || u.username).trim() : String(ids[0])
                  }
                  return `${ids.length} tecnici`
                },
              },
            }}
            sx={{ width: 190 }}
          >
            {technicians.map((u) => (
              <MenuItem key={u.id} value={u.id} dense>
                <Checkbox size="small" checked={assignedTo.includes(u.id)} sx={{ p: 0.4, mr: 0.5 }} />
                {(u.full_name || u.username).trim()}
              </MenuItem>
            ))}
          </TextField>

          <ToggleButtonGroup size="small" exclusive value={granularity} onChange={(_e, v) => v && setGranularity(v)}>
            <ToggleButton value="month">Mensile</ToggleButton>
            <ToggleButton value="week">Settimanale</ToggleButton>
            <ToggleButton value="day">Giornaliera</ToggleButton>
          </ToggleButtonGroup>

          {/* Filtro contestuale: Mese (vista giornaliera) o Settimana (vista settimanale) */}
          {granularity === 'day' && (
            <TextField {...isSm} select label="Mese" value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={{ width: 130 }}>
              {MONTH_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
            </TextField>
          )}
          {granularity === 'week' && (
            <TextField
              {...isSm} select label="Settimana" value={week}
              onChange={(e) => setWeek(e.target.value === '' ? '' : Number(e.target.value))}
              sx={{ width: 130 }}
            >
              <MenuItem value=""><em>Tutte</em></MenuItem>
              {WEEK_OPTIONS.map((w) => <MenuItem key={w} value={w}>{`W${w}`}</MenuItem>)}
            </TextField>
          )}

          <MuiTooltip title="Esporta PDF (riepilogo con i filtri correnti)">
            <span>
              <IconButton size="small" onClick={handleExportPdf} disabled={exportingPdf || loading}>
                {exportingPdf ? <CircularProgress size={18} /> : <PictureAsPdfOutlinedIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </span>
          </MuiTooltip>
        </Stack>
      </Box>

      {loading || !dataReady || !data ? (
        <Stack alignItems="center" justifyContent="center" minHeight={160}>
          <CircularProgress size={24} />
        </Stack>
      ) : (
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <KpiCard label="Casi totali" value={String(data.kpi.total)} accent={category === 'philips' ? theme.palette.primary.main : theme.palette.secondary.main} />
            <TypeMiniDonut rows={data.type_breakdown} />
            <KpiCard
              label="Tecnico top"
              value={data.kpi.top_technician ? `${data.kpi.top_technician.name} ${topTechnicianEmoji(data.kpi.top_technician.count)}` : '—'}
              helper={data.kpi.top_technician ? `${data.kpi.top_technician.count} casi` : 'Nessun dato'}
              accent={category === 'philips' ? '#6366f1' : theme.palette.warning.main}
              valueFontSize="0.9rem"
            />
          </Stack>

          {category === 'philips' && mainData && secondaryData ? (
            <>
              <StatsTableBlock
                title="Casi L1 · EBIT" data={mainData} showRowTotal
                rowTotalTooltip={ebitTooltip} cellTooltip={ebitCellTooltip}
                typeFilterOptions={PHILIPS_MAIN_TYPES}
              />
              <StatsTableBlock title="Casi AC · GEMELLI · RIS" data={secondaryData} showRowTotal />
            </>
          ) : category === 'biotron' ? (
            <>
              <StatsTableBlock title="Tutti i casi" data={data} typeFilterOptions={BIOTRON_MAIN_TYPES} />
              {cddData && <StatsTableBlock title="Solo casi CDD" data={cddData} />}
            </>
          ) : (
            <StatsTableBlock data={data} />
          )}
        </>
      )}
    </Stack>
  )
}

// ─── Pagina ────────────────────────────────────────────────────────────────

export default function ServiceNowStats() {
  const [userRows, setUserRows] = React.useState<UserOption[]>([])

  React.useEffect(() => {
    const toUserOption = (v: unknown): UserOption | null => {
      if (!isRecord(v)) return null
      const id = Number(v['id'])
      if (!Number.isFinite(id)) return null
      const username = typeof v['username'] === 'string' ? v['username'] : ''
      const full_name = typeof v['full_name'] === 'string' ? v['full_name'] : ''
      const is_philips = v['is_philips'] === true
      const is_servicenow_technician = v['is_servicenow_technician'] !== false
      return { id, username, full_name, is_philips, is_servicenow_technician }
    }
    api.get('/users/', { params: { page_size: 200 } })
      .then((r) => {
        const payload: unknown = r.data
        const list: unknown[] = Array.isArray(payload)
          ? payload
          : isRecord(payload) && Array.isArray(payload['results'])
            ? (payload['results'] as unknown[])
            : []
        setUserRows(list.map(toUserOption).filter((x): x is UserOption => Boolean(x)))
      })
      .catch(() => {})
  }, [])

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} divider={
      <Box sx={{ width: { xs: '100%', md: '1px' }, height: { xs: '1px', md: 'auto' }, bgcolor: 'divider' }} />
    }>
      {CATEGORIES.map((c) => (
        <CategoryStatsPanel key={c.value} category={c.value} label={c.label} allUsers={userRows} />
      ))}
    </Stack>
  )
}
