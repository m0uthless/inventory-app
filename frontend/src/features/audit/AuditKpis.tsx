import { Box, ButtonBase } from '@mui/material'
import { KpiFlag, KpiStrip, KpiTile } from '../../ui/campo'
import type { AuditStats, AuditView } from './auditModel'

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })

export default function AuditKpis({ stats, view, onView, onActor }: {
  stats: AuditStats | null
  view: AuditView
  onView: (v: AuditView) => void
  onActor: (id: number) => void
}) {
  const f = stats?.failed_24h
  const max = Math.max(1, ...(stats?.top_modifiers_7d ?? []).map((t) => t.count))
  return (
    <KpiStrip>
      <KpiTile label="Eventi oggi" value={stats?.today.total ?? '—'}
        spark={stats ? { values: stats.days.map((d) => d.count), labels: stats.days.map((d) => dayLabel(d.date)), format: (v) => `${v} eventi` } : undefined}
        sub={stats ? <><b>{stats.today.changes}</b> modifiche · <b>{stats.today.total - stats.today.changes}</b> accessi e sistema</> : undefined} />
      <KpiTile label="Accessi falliti · 24 ore" value={f?.count ?? '—'} onClick={() => onView(view === 'failed' ? 'all' : 'failed')} active={view === 'failed'}
        unit={f && f.count >= 3 ? <KpiFlag tone="error">da guardare</KpiFlag> : undefined}
        sub={f?.top ? <><b>{f.top.count}</b> per «{f.top.username}»{f.top.ip ? ` da ${f.top.ip}` : ''}</> : 'Nessun tentativo fallito'} />
      <KpiTile label="Eliminazioni · 7 giorni" value={stats?.deleted_7d ?? '—'} onClick={() => onView(view === 'delete' ? 'all' : 'delete')} active={view === 'delete'}
        sub={<>si ripristinano dal <b>Cestino</b></>} />
      <KpiTile wide label="Chi ha modificato di più · 7 giorni" sub={stats ? <>più <b>{stats.system_7d}</b> eventi del sistema</> : undefined}>
        <Box sx={{ display: 'grid', gap: '2px', mt: 0.5 }}>
          {(stats?.top_modifiers_7d ?? []).map((t) => (
            <ButtonBase key={t.id} onClick={() => onActor(t.id)} sx={{
              display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 46px 22px', gap: 1, alignItems: 'center', px: 0.5, mx: -0.5, borderRadius: '4px',
              fontSize: 12, lineHeight: '19px', color: 'text.secondary', textAlign: 'left', '&:hover': { bgcolor: 'archie.surface2', color: 'text.primary' },
            }}>
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</Box>
              <Box component="span" sx={{ height: 6, borderRadius: 3, bgcolor: 'archie.neutralBg', overflow: 'hidden' }}>
                <Box component="span" sx={{ display: 'block', height: '100%', width: `${(t.count / max) * 100}%`, borderRadius: 3, bgcolor: (th) => th.palette.archie.seq[2] }} />
              </Box>
              <Box component="b" sx={{ color: 'text.primary', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.count}</Box>
            </ButtonBase>
          ))}
          {stats && !stats.top_modifiers_7d.length ? <Box component="span" sx={{ fontSize: 12, color: 'text.disabled' }}>Nessuna modifica negli ultimi 7 giorni.</Box> : null}
        </Box>
      </KpiTile>
    </KpiStrip>
  )
}
