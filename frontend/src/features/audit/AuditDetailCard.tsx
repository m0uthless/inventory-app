import * as React from 'react'
import { Box, Button, ButtonBase, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { CampoIcon, DetailSection, FloatingDetail } from '../../ui/campo'
import { Empty, Loading, useList } from '../../ui/campo/ListRows'
import {
  ENTITY, actorLabel, browserOf, changeEntries, entityKey, entityLabel, fieldLabel, fmtValue, fullDate, isPrivateIp, isSecretField, objectTitle, whenLabel,
  failedUsername, type AuditEvent,
} from './auditModel'
import { ActorAvatar, AuditActionBadge } from './auditUi'

export type AuditTab = 'det' | 'his'
type Props = {
  ev: AuditEvent
  tab: AuditTab
  onTab: (t: AuditTab) => void
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onSelect: (id: number) => void
  onFilterObject: (ev: AuditEvent) => void
  onFailedView: () => void
  onNavigate: (path: string) => void
}

const dl = { m: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: '6px 16px', fontSize: 13, '& dt': { color: 'text.secondary' }, '& dd': { m: 0, textAlign: 'right', fontWeight: 550, overflowWrap: 'anywhere' } } as const
const mono = { fontFamily: '"Geist Mono", monospace', fontSize: 12 } as const

function Callout({ tone, title, children }: { tone: 'error' | 'warning'; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box role="status" sx={{ p: '10px 12px', borderRadius: '8px', bgcolor: `${tone}.light`, fontSize: 12.5 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: `${tone}.main` }}>{title}</Typography>
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{children}</Typography>
    </Box>
  )
}

/** Tentativi falliti dallo stesso IP nelle 24 ore prima di questo. */
function useFailedFromIp(ev: AuditEvent) {
  const [n, setN] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (ev.action !== 'login_failed' || !ev.ip_address) { setN(null); return }
    let alive = true
    const end = new Date(ev.created_at)
    const start = new Date(end.getTime() - 864e5)
    api.get<{ count?: number } | unknown[]>('/audit-events/', { params: { action: 'login_failed', ip: ev.ip_address, created_after: start.toISOString(), created_before: new Date(end.getTime() + 1000).toISOString(), page_size: 1 } })
      .then((r) => { if (alive) setN(Array.isArray(r.data) ? r.data.length : r.data.count ?? null) }).catch(() => { if (alive) setN(null) })
    return () => { alive = false }
  }, [ev.id, ev.action, ev.ip_address, ev.created_at])
  return n
}

/** Scheda flottante dell'evento di audit (anteprima design-previews/au-base.html). */
export default function AuditDetailCard(p: Props) {
  const e = p.ev
  const a = actorLabel(e)
  const changes = changeEntries(e.changes)
  const key = entityKey(e.content_type_app, e.content_type_model)
  const hasObject = Boolean(key && e.object_id) && !['login', 'logout', 'login_failed'].includes(e.action)
  const history = useList<AuditEvent>('/audit-events/', hasObject ? { app_label: e.content_type_app, model: e.content_type_model, object_id: e.object_id, page_size: 50, ordering: '-created_at' } : null, e.id)
  const failedN = useFailedFromIp(e)
  const browser = browserOf(e.user_agent)
  const empty = <Box component="span" sx={{ color: 'archie.textFaint', fontWeight: 400 }}>vuoto</Box>
  const hidden = <Box component="span" sx={{ color: 'text.secondary', fontStyle: 'italic', fontWeight: 400 }}>nascosto</Box>
  const extras = Object.entries(e.metadata_summary ?? {}).filter(([k]) => !['username', 'query_params'].includes(k))

  const details = (
    <>
      {e.action === 'delete' ? (
        <Callout tone="warning" title={`Eliminato ${whenLabel(e.created_at)}`}>Se l'oggetto va nel cestino, da lì si può ripristinare finché non viene svuotato.</Callout>
      ) : null}
      {e.action === 'login_failed' ? (
        <Callout tone="error" title={failedN != null && e.ip_address ? `${failedN} ${failedN === 1 ? 'tentativo fallito' : 'tentativi falliti'} da ${e.ip_address} in 24 ore` : 'Accesso non riuscito'}>
          Nome utente usato: «{failedUsername(e) || '?'}». {e.ip_address ? (isPrivateIp(e.ip_address) ? 'Indirizzo della rete interna.' : 'Indirizzo esterno alla rete aziendale.') : ''}
        </Callout>
      ) : null}

      {changes.length ? (
        <DetailSection title={e.action === 'create' ? 'Valori iniziali' : 'Cosa è cambiato'} end={<Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{changes.length} {changes.length === 1 ? 'campo' : 'campi'}</Typography>}>
          <Box component="table" sx={{
            width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 12.5,
            '& th, & td': { textAlign: 'left', p: '6px 8px', borderBottom: '1px solid', borderColor: 'divider', verticalAlign: 'top', overflowWrap: 'anywhere' },
            '& thead th': { fontSize: 11, fontWeight: 550, color: 'text.secondary' },
            '& tbody th': { fontWeight: 550, color: 'text.secondary', width: '30%' },
            '& td.was': { color: 'text.secondary', textDecoration: 'line-through', textDecorationColor: (t) => t.palette.error.main },
            '& td.now': { fontWeight: 550, bgcolor: 'success.light' },
          }}>
            <thead><tr><th style={{ width: '30%' }}>Campo</th>{e.action === 'create' ? null : <th>Prima</th>}<th>{e.action === 'create' ? 'Valore' : 'Dopo'}</th></tr></thead>
            <tbody>
              {changes.map((c) => {
                const secret = isSecretField(c.field)
                const from = fmtValue(c.from); const to = fmtValue(c.to)
                return (
                  <tr key={c.field}>
                    <th scope="row">{fieldLabel(c.field)}</th>
                    {e.action === 'create' ? null : <td className={from && !secret ? 'was' : undefined}>{secret ? hidden : c.hasFrom ? from ?? empty : <Box component="span" sx={{ color: 'archie.textFaint' }}>—</Box>}</td>}
                    <td className="now">{secret ? hidden : to ?? empty}</td>
                  </tr>
                )
              })}
            </tbody>
          </Box>
          {changes.some((c) => isSecretField(c.field)) ? <Typography sx={{ mt: 0.75, fontSize: 11.5, color: 'text.secondary' }}>Le password non vengono mai scritte nel registro: risulta solo che sono cambiate.</Typography> : null}
        </DetailSection>
      ) : null}

      <DetailSection title="Chi e da dove">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
          <ActorAvatar ev={e} size={32} />
          <Box sx={{ display: 'grid', lineHeight: 1.3, minWidth: 0 }}>
            <Typography component="b" sx={{ fontWeight: 600, fontSize: 13 }} noWrap>{a.name}</Typography>
            <Typography component="small" sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>
              {a.kind === 'user' ? `@${e.actor_username ?? ''}` : a.kind === 'system' ? 'operazione automatica' : 'nome utente tentato'}
            </Typography>
          </Box>
        </Box>
        <Box component="dl" sx={dl}>
          <dt>Quando</dt><dd>{fullDate(e.created_at)}</dd>
          {e.ip_address ? <><dt>Indirizzo IP</dt><dd style={mono}>{e.ip_address}</dd></> : null}
          {browser ? <><dt>Browser</dt><dd>{browser}</dd></> : null}
        </Box>
        <Box component="details" sx={{ mt: 1.25, fontSize: 12, '& summary': { cursor: 'pointer', color: 'text.secondary', fontWeight: 550, '&:hover': { color: 'text.primary' } } }}>
          <summary>Dettagli tecnici</summary>
          <Box component="dl" sx={{ ...dl, mt: 1, fontSize: 12 }}>
            {e.method || e.path ? <><dt>Richiesta</dt><dd style={mono}>{[e.method, e.path].filter(Boolean).join(' ')}</dd></> : null}
            {key ? <><dt>Tipo</dt><dd style={mono}>{key}</dd></> : null}
            {e.object_id ? <><dt>ID oggetto</dt><dd style={mono}>{e.object_id}</dd></> : null}
            <dt>Evento</dt><dd style={mono}>{e.id}</dd>
            {extras.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd style={mono}>{typeof v === 'string' ? v : JSON.stringify(v)}</dd></React.Fragment>)}
            {e.user_agent ? <><dt>User agent</dt><dd style={{ ...mono, fontWeight: 400, textAlign: 'left' }}>{e.user_agent}</dd></> : null}
          </Box>
        </Box>
      </DetailSection>
    </>
  )

  const hist = !history ? <Loading /> : !history.length ? <Empty text="Nessun altro evento per questo oggetto." /> : (
    <Box sx={{ display: 'grid', gap: 0.5 }}>
      {history.map((h) => {
        const fields = changeEntries(h.changes).map((c) => fieldLabel(c.field))
        return (
          <ButtonBase key={h.id} onClick={() => p.onSelect(h.id)} sx={{
            display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 1, alignItems: 'center', textAlign: 'left', p: '6px 8px', borderRadius: '6px', fontSize: 12,
            color: 'text.secondary', bgcolor: h.id === e.id ? 'archie.field' : 'transparent', '&:hover': { bgcolor: h.id === e.id ? 'archie.field' : 'archie.surface2' },
          }}>
            <AuditActionBadge action={h.action} />
            <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>{actorLabel(h).name}</Box>{fields.length && h.action === 'update' ? ` · ${fields.join(', ')}` : ''}
            </Box>
            <Box component="time" sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{whenLabel(h.created_at)}</Box>
          </ButtonBase>
        )
      })}
    </Box>
  )

  const openLabel = ENTITY[key]?.open ?? "l'oggetto"
  return (
    <FloatingDetail
      open
      onClose={p.onClose}
      ariaLabel="Dettaglio evento"
      idLabel={<Box component="span" sx={mono}>Evento #{e.id}</Box>}
      status={<AuditActionBadge action={e.action} onDark />}
      title={objectTitle(e)}
      subtitle={`${entityLabel(e)} · ${whenLabel(e.created_at)}`}
      tabs={hasObject ? [{ key: 'det', label: 'Dettagli' }, { key: 'his', label: "Storico dell'oggetto", count: history?.length ?? null }] : undefined}
      tab={hasObject ? p.tab : undefined}
      onTab={(k) => p.onTab(k as AuditTab)}
      position={p.position}
      onPrev={p.onPrev}
      onNext={p.onNext}
      footer={(
        <>
          {hasObject ? <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="filter" size={15} />} onClick={() => p.onFilterObject(e)}>Solo questo oggetto</Button> : null}
          {e.action === 'login_failed' ? <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="filter" size={15} />} onClick={p.onFailedView}>Tutti gli accessi falliti</Button> : null}
          <Box sx={{ flex: 1 }} />
          {e.action === 'delete' ? <Button variant="contained" startIcon={<CampoIcon name="restore" size={15} />} onClick={() => p.onNavigate('/trash')}>Apri il Cestino</Button>
            : e.entity_path ? <Button variant="contained" startIcon={<CampoIcon name="arrowR" size={15} />} onClick={() => p.onNavigate(e.entity_path!)}>Apri {openLabel}</Button> : null}
        </>
      )}
    >
      {hasObject && p.tab === 'his' ? hist : details}
    </FloatingDetail>
  )
}
