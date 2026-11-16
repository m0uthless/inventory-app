import * as React from 'react'
import { Box, ButtonBase, IconButton, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { CampoIcon } from '../../ui/campo'
import { initialsOf, firstName, type TriageResponse, type TriageTechnician } from './snModel'
import { isServiceNowCategoryVisible, type ServiceNowCategory } from './visibleCategories'
import { TechnicianAbsencesDialog } from './SnAbsences'

/**
 * "Oggi" (triage): per ogni tecnico quanti casi ha ricevuto oggi e chi è assente adesso.
 * `compact`: una colonna, senza testata (per la Dashboard casi).
 */
export default function TodayPanel({ refreshKey, canManage, compact, onUnassigned, onChanged }: {
  refreshKey: number; canManage: boolean; compact?: boolean; onUnassigned?: () => void; onChanged?: () => void
}) {
  const [data, setData] = React.useState<TriageResponse | null>(null)
  const [tick, setTick] = React.useState(0)
  const [absTarget, setAbsTarget] = React.useState<{ id: number; name: string } | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get<TriageResponse>('/servicenow-cases/triage/').then((r) => { if (alive) setData(r.data) }).catch(() => {})
    return () => { alive = false }
  }, [refreshKey, tick])

  const cats = (['philips', 'biotron'] as ServiceNowCategory[]).filter(isServiceNowCategoryVisible)
  const techs = cats.flatMap((c) => data?.categories[c]?.technicians ?? [])
  const people = techs.filter((t) => t.id !== null)
  const unassigned = techs.filter((t) => t.id === null).reduce((s, t) => s + t.count, 0)
  const total = cats.reduce((s, c) => s + (data?.categories[c]?.total ?? 0), 0)
  const max = Math.max(1, ...people.map((t) => t.count))
  const dateLabel = (data?.date ? new Date(`${data.date}T00:00:00`) : new Date()).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  const row = (t: TriageTechnician) => (
    <Box key={t.id ?? 'x'} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, py: 0.5, '&:hover .tp-manage': { opacity: 1 } }}>
      <Box component="span" aria-hidden sx={{ display: 'inline-grid', placeItems: 'center', flex: 'none', width: 28, height: 28, borderRadius: '50%', fontSize: 10.5, fontWeight: 700,
        bgcolor: (th) => (t.absent ? th.palette.archie.tints.peach.bg : th.palette.archie.tints.mint.bg), color: (th) => (t.absent ? th.palette.archie.tints.peach.ink : th.palette.archie.tints.mint.ink) }}>{initialsOf(t.name)}</Box>
      <Box sx={{ display: 'grid', lineHeight: 1.25, minWidth: 0, width: compact ? 150 : 140, flex: 'none' }}>
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{firstName(t.name)}</Typography>
        <Typography noWrap component="span" sx={{ fontSize: 11.5, color: t.absent ? (th) => th.palette.archie.tints.peach.ink : 'text.secondary', fontWeight: t.absent ? 600 : 400 }}>
          {t.absent ? (t.absence_reason || 'Assente') : t.count ? `${t.count} ${t.count === 1 ? 'caso' : 'casi'} oggi` : 'nessun caso oggi'}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'archie.neutralBg', overflow: 'hidden', opacity: t.absent ? 0.4 : 1 }}>
        <Box sx={{ height: '100%', width: `${(t.count / max) * 100}%`, borderRadius: 3, bgcolor: (th) => th.palette.archie.tints.sky.mid }} />
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700, width: 18, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.count}</Typography>
      {canManage && t.id !== null ? (
        <Tooltip title="Assenze del tecnico">
          <IconButton className="tp-manage" size="small" aria-label={`Assenze di ${t.name}`} onClick={() => setAbsTarget({ id: t.id!, name: t.name })}
            sx={{ width: 26, height: 26, opacity: { xs: 1, md: 0.35 }, transition: 'opacity .15s' }}><CampoIcon name="calendar" size={14} /></IconButton>
        </Tooltip>
      ) : null}
    </Box>
  )

  const unassignedChip = unassigned ? (
    <ButtonBase onClick={onUnassigned} sx={{ gap: 0.6, height: 26, px: 1.25, borderRadius: '13px', bgcolor: 'warning.light', color: 'warning.main', fontSize: 12.5 }}>
      <CampoIcon name="alert" size={14} /><b>{unassigned}</b>&nbsp;da assegnare
    </ButtonBase>
  ) : null

  return (
    <Box component="section" aria-label="Casi di oggi" sx={compact ? undefined : { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: '12px 14px 12px', mb: 1.75 }}>
      {compact ? (unassignedChip ? <Box sx={{ mb: 1 }}>{unassignedChip}</Box> : null) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, flexWrap: 'wrap' }}>
          <Typography component="h2" sx={{ fontSize: 14, fontWeight: 700 }}>Oggi</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{dateLabel} · {total} {total === 1 ? 'caso aperto' : 'casi aperti'}</Typography>
          {unassignedChip}
        </Box>
      )}
      {!data ? <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Caricamento…</Typography> : !people.length ? <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Nessun tecnico ServiceNow attivo.</Typography> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, columnGap: 2.5 }}>
          {people.map(row)}
        </Box>
      )}
      <TechnicianAbsencesDialog technician={absTarget} onClose={() => setAbsTarget(null)} onSaved={() => { setTick((x) => x + 1); onChanged?.() }} />
    </Box>
  )
}
