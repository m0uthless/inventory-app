import * as React from 'react'
import { Box } from '@mui/material'
import { CampoIcon, type CampoIconName } from '../../ui/campo'
import { Empty, useList } from '../../ui/campo/ListRows'

/*
 * Registro attività dei record (clienti, siti, contatti, inventari…) dal log di audit,
 * in frasi leggibili. I pannelli a schede del vecchio dettaglio cliente sono stati sostituiti
 * dalla finestra del cliente (CustomerDetailModal).
 */

// ─── Attività ────────────────────────────────────────────────────────────────

type AuditEvent = { id: number; created_at: string; action: string; actor_username?: string | null; changes?: Record<string, { from?: unknown; to?: unknown } | [unknown, unknown]> | null }

const val = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))
function describe(e: AuditEvent, fields: Record<string, string>, noun: string): React.ReactNode {
  if (e.action === 'create') return `ha creato ${noun}`
  if (e.action === 'delete') return 'lo ha spostato nel cestino'
  if (e.action === 'restore') return 'lo ha ripristinato'
  const ch = Object.entries(e.changes ?? {}).filter(([k]) => k !== 'updated_at' && k !== 'updated_by')
  if (!ch.length) return `ha modificato ${noun}`
  return ch.map(([k, v], i) => {
    const [from, to] = Array.isArray(v) ? v : [v?.from, v?.to]
    const txt = k === 'notes' || k === 'custom_fields' ? <>ha modificato {fields[k] ?? k}</> : <>ha cambiato {fields[k] ?? k} da <b>{val(from)}</b> a <b>{val(to)}</b></>
    return <React.Fragment key={k}>{i ? '; ' : ''}{txt}</React.Fragment>
  })
}
const evIcon = (a: string): CampoIconName => (a === 'create' ? 'plus' : a === 'delete' ? 'trash' : a === 'restore' ? 'restore' : 'wrench')

/** Registro modifiche dal log di audit, in frasi leggibili. */
export function AuditFeedPanel({ appLabel, model, objectId, fields, noun, limit, reloadKey }: { appLabel: string; model: string; objectId: number; fields: Record<string, string>; noun: string; limit?: number; reloadKey?: unknown }) {
  const events = useList<AuditEvent>('/audit-events/', { app_label: appLabel, model, object_id: String(objectId), ordering: '-created_at', page_size: 100 }, reloadKey)
  const [all, setAll] = React.useState(false)
  // In arrivo: spazio fermo, niente spinner (è il riquadro più in basso, non serve richiamare l'occhio).
  if (!events) return <Box aria-busy="true" sx={{ minHeight: 48 }} />
  if (!events.length) return <Empty text="Nessuna attività registrata." />
  const shown = limit && !all ? events.slice(0, limit) : events
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {shown.map((e) => (
        <Box key={e.id} sx={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 1, alignItems: 'center', fontSize: 12, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
          <Box sx={{ width: 22, height: 22, ml: '1px', borderRadius: '50%', bgcolor: 'archie.neutralBg', display: 'grid', placeItems: 'center' }}><CampoIcon name={evIcon(e.action)} size={12} /></Box>
          <span><b>{e.actor_username || 'Sistema'}</b> {describe(e, fields, noun)}</span>
          <Box component="time" sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Box>
        </Box>
      ))}
      {limit && events.length > limit ? (
        <Box component="button" type="button" onClick={() => setAll((v) => !v)} sx={{ justifySelf: 'start', border: 0, background: 'none', p: 0, font: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline', textUnderlineOffset: '3px' } }}>
          {all ? 'Mostra meno' : `Mostra tutte (${events.length})`}
        </Box>
      ) : null}
    </Box>
  )
}
