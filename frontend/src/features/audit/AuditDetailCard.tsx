import * as React from 'react'
import { Box, Button, ButtonBase, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { copyToClipboard } from '@shared/utils/clipboard'
import { buildQuery } from '@shared/utils/nav'
import { useToast } from '@shared/ui/toast'
import { CampoIcon, RecordEmpty, RecordGrid, RecordLoader, RecordModal, RecordSection, RecordValue, bandButtonSx, bandSolidSx, useList } from '../../ui/campo'
import {
  ENTITY, actorLabel, browserOf, changeEntries, entityKey, entityLabel, fieldLabel, fmtValue, fullDate, isPrivateIp, isSecretField, objectTitle, whenLabel,
  failedUsername, type AuditEvent,
} from './auditModel'
import { ActorAvatar, AuditActionBadge } from './auditUi'

type Props = {
  ev: AuditEvent
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  onSelect: (id: number) => void
  onFilterObject: (ev: AuditEvent) => void
  onFailedView: () => void
  onNavigate: (path: string) => void
}


function Callout({ tone, title, children }: { tone: 'error' | 'warning'; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box role="status" sx={{ p: '10px 14px', borderRadius: '10px', bgcolor: `${tone}.light`, fontSize: 12.5 }}>
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

/*
 * Finestra dell'evento di audit (anteprima design-previews/aud-base.html), in sola lettura: testata con l'oggetto,
 * l'azione e chi l'ha fatta; «Apri l'oggetto» (o «Apri il Cestino») come azione principale; al centro gli avvisi,
 * la tabella «Cosa è cambiato» e lo storico dell'oggetto (un altro evento si apre nella stessa finestra);
 * a lato chi e da dove e i dettagli tecnici richiudibili.
 */
export default function AuditDetailCard(p: Props) {
  const e = p.ev
  const toast = useToast()
  const a = actorLabel(e)
  const changes = changeEntries(e.changes)
  const key = entityKey(e.content_type_app, e.content_type_model)
  const hasObject = Boolean(key && e.object_id) && !['login', 'logout', 'login_failed'].includes(e.action)
  const history = useList<AuditEvent>('/audit-events/', hasObject ? { app_label: e.content_type_app, model: e.content_type_model, object_id: e.object_id, page_size: 50, ordering: '-created_at' } : null, e.id)
  const failedN = useFailedFromIp(e)
  const browser = browserOf(e.user_agent)
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  const [tech, setTech] = React.useState(false)
  React.useEffect(() => { setMenu(null); setTech(false) }, [e.id])
  const empty = <Box component="span" sx={{ color: 'archie.textFaint', fontWeight: 400 }}>vuoto</Box>
  const hidden = <Box component="span" sx={{ color: 'text.secondary', fontStyle: 'italic', fontWeight: 400 }}>nascosto</Box>
  const extras = Object.entries(e.metadata_summary ?? {}).filter(([k]) => !['username', 'query_params'].includes(k))
  const failed = e.action === 'login_failed'
  const deleted = e.action === 'delete'
  const internal = e.ip_address ? isPrivateIp(e.ip_address) : true
  const openLabel = ENTITY[key]?.open ?? "l'oggetto"
  const scrollTo = (id: string) => document.getElementById(`aud-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const chip = (txt: React.ReactNode, warn?: boolean, onClick?: () => void) => (
    <Box component={onClick ? 'button' : 'span'} type={onClick ? 'button' : undefined} onClick={onClick} sx={{
      height: 20, px: 0.9, border: 0, font: 'inherit', borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'default',
      bgcolor: warn ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: warn ? '#fde9c4' : '#e6f2ee', '& b': { color: '#fff', fontWeight: 700 },
      '&:hover': onClick ? { bgcolor: 'rgb(255 255 255 / .22)' } : undefined,
    }}>{txt}</Box>
  )
  const primary = deleted ? <Button variant="outlined" startIcon={<CampoIcon name="restore" size={15} />} onClick={() => p.onNavigate('/trash')} sx={{ ...bandButtonSx, ...bandSolidSx }}>Apri il Cestino</Button>
    : e.entity_path ? <Button variant="outlined" startIcon={<CampoIcon name="arrowR" size={15} />} onClick={() => p.onNavigate(e.entity_path!)} sx={{ ...bandButtonSx, ...bandSolidSx }}>Apri {openLabel}</Button> : null

  return (
    <RecordModal open onClose={p.onClose} ariaLabel={`Evento ${e.id}`} compact
      title={objectTitle(e)}
      status={<AuditActionBadge action={e.action} onDark />}
      subtitle={<>{entityLabel(e)} · {whenLabel(e.created_at)} · {a.kind === 'user' ? <>da <b>{a.name}</b></> : a.kind === 'system' ? 'operazione automatica' : <>nome utente tentato <b>«{failedUsername(e) || '?'}»</b></>}</>}
      tags={<>
        {changes.length ? chip(<><b>{changes.length}</b> {changes.length === 1 ? 'campo cambiato' : 'campi cambiati'}</>) : null}
        {e.ip_address ? chip(<>{internal ? 'rete interna' : 'IP esterno'} · <b>{e.ip_address}</b></>, !internal) : null}
        {failed && failedN != null ? chip(<><b>{failedN}</b> {failedN === 1 ? 'tentativo' : 'tentativi'} in 24 ore</>, true) : null}
        {hasObject && history ? chip(<><b>{history.length}</b> {history.length === 1 ? "evento sull'oggetto" : "eventi sull'oggetto"}</>, false, () => scrollTo('his')) : null}
      </>}
      position={p.position} onPrev={p.onPrev} onNext={p.onNext}
      actions={<>
        {primary}
        <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(x) => setMenu(x.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          {hasObject ? <MenuItem onClick={() => { setMenu(null); p.onFilterObject(e) }}><ListItemIcon><CampoIcon name="filter" size={16} /></ListItemIcon>Solo questo oggetto</MenuItem> : null}
          {failed ? <MenuItem onClick={() => { setMenu(null); p.onFailedView() }}><ListItemIcon><CampoIcon name="filter" size={16} /></ListItemIcon>Tutti gli accessi falliti</MenuItem> : null}
          <MenuItem onClick={() => { setMenu(null); void copyToClipboard(`${window.location.origin}/audit${buildQuery({ open: e.id })}`).then(() => toast.success('Link copiato')) }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia il link dell'evento</MenuItem>
        </Menu>
      </>}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          {deleted ? <Callout tone="warning" title={`Eliminato ${whenLabel(e.created_at)}`}>Se l'oggetto va nel cestino, da lì si può ripristinare finché non viene svuotato.</Callout> : null}
          {failed ? (
            <Callout tone="error" title={failedN != null && e.ip_address ? `${failedN} ${failedN === 1 ? 'tentativo fallito' : 'tentativi falliti'} da ${e.ip_address} in 24 ore` : 'Accesso non riuscito'}>
              Nome utente usato: «{failedUsername(e) || '?'}». {e.ip_address ? (internal ? 'Indirizzo della rete interna.' : 'Indirizzo esterno alla rete aziendale.') : ''}
            </Callout>
          ) : null}

          {changes.length ? (
            <RecordSection title={<>{e.action === 'create' ? 'Valori iniziali' : 'Cosa è cambiato'}<Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{changes.length} {changes.length === 1 ? 'campo' : 'campi'}</Box></>}>
              <Box component="table" sx={{
                width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 12.5,
                '& th, & td': { textAlign: 'left', p: '7px 8px', borderBottom: '1px solid', borderColor: 'divider', verticalAlign: 'top', overflowWrap: 'anywhere', whiteSpace: 'normal' },
                '& thead th': { fontSize: 11, fontWeight: 550, color: 'text.secondary' },
                '& tbody th': { fontWeight: 550, color: 'text.secondary', width: '28%' },
                '& td.was': { color: 'text.secondary', textDecoration: 'line-through', textDecorationColor: (t) => t.palette.error.main },
                '& td.now': { fontWeight: 550, bgcolor: 'success.light' },
              }}>
                <thead><tr><th style={{ width: '28%' }}>Campo</th>{e.action === 'create' ? null : <th>Prima</th>}<th>{e.action === 'create' ? 'Valore' : 'Dopo'}</th></tr></thead>
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
              {changes.some((c) => isSecretField(c.field)) ? <Typography sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mt: 1, fontSize: 11.5, color: 'text.secondary' }}><CampoIcon name="lock" size={12} />Le password non vengono mai scritte nel registro: risulta solo che sono cambiate.</Typography> : null}
            </RecordSection>
          ) : null}

          {hasObject ? (
            <Box id="aud-his" sx={{ scrollMarginTop: 16 }}>
              <RecordSection title={<>Storico dell'oggetto<Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{history?.length ?? ''}</Box></>}>
                {!history ? <RecordLoader /> : !history.length ? <RecordEmpty>Nessun altro evento per questo oggetto.</RecordEmpty> : (
                  <Box sx={{ display: 'grid', gap: 0.25 }}>
                    {history.map((h) => {
                      const fields = changeEntries(h.changes).map((c) => fieldLabel(c.field))
                      const cur = h.id === e.id
                      return (
                        <ButtonBase key={h.id} onClick={() => p.onSelect(h.id)} aria-current={cur || undefined} sx={{
                          display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) auto', gap: 1.25, alignItems: 'center', textAlign: 'left', p: '7px 8px', borderRadius: '6px', fontSize: 12,
                          color: 'text.secondary', bgcolor: cur ? 'archie.field' : 'transparent', '&:hover': { bgcolor: cur ? 'archie.field' : 'archie.surface2' }, '&:hover b': { color: 'primary.main' },
                        }}>
                          <AuditActionBadge action={h.action} />
                          <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>{actorLabel(h).name}</Box>{fields.length && h.action === 'update' ? ` · ${fields.join(', ')}` : ''}{cur ? ' · questo evento' : ''}
                          </Box>
                          <Box component="time" sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{whenLabel(h.created_at)}</Box>
                        </ButtonBase>
                      )
                    })}
                  </Box>
                )}
              </RecordSection>
            </Box>
          ) : null}

          {!changes.length && !hasObject && !failed && !deleted ? <RecordEmpty>Nessun dettaglio in più per questo evento.</RecordEmpty> : null}
        </Box>

        <Box component="aside" aria-label="Chi e da dove" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Chi e da dove">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
              <ActorAvatar ev={e} size={32} />
              <Box sx={{ display: 'grid', lineHeight: 1.3, minWidth: 0 }}>
                <Typography component="b" sx={{ fontWeight: 600, fontSize: 13 }} noWrap>{a.name}</Typography>
                <Typography component="small" sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{a.kind === 'user' ? `@${e.actor_username ?? ''}` : a.kind === 'system' ? 'operazione automatica' : 'nome utente tentato'}</Typography>
              </Box>
            </Box>
            <RecordGrid>
              <RecordValue label="Quando" wide>{fullDate(e.created_at)}</RecordValue>
              {e.ip_address ? <RecordValue label="Indirizzo IP" mono>{e.ip_address}</RecordValue> : null}
              {e.ip_address ? <RecordValue label="Rete"><Box component="span" sx={{ color: internal ? 'text.primary' : 'warning.main' }}>{internal ? 'interna' : 'esterna'}</Box></RecordValue> : null}
              {browser ? <RecordValue label="Browser" wide>{browser}</RecordValue> : null}
            </RecordGrid>
          </RecordSection>
          <RecordSection title="Dettagli tecnici" end={<Button size="small" onClick={() => setTech((x) => !x)}>{tech ? 'Nascondi' : 'Mostra'}</Button>}>
            {tech ? (
              <RecordGrid>
                {e.method || e.path ? <RecordValue label="Richiesta" wide mono>{[e.method, e.path].filter(Boolean).join(' ')}</RecordValue> : null}
                {key ? <RecordValue label="Tipo" mono>{key}</RecordValue> : null}
                {e.object_id ? <RecordValue label="ID oggetto" mono>{e.object_id}</RecordValue> : null}
                <RecordValue label="Evento" mono>{String(e.id)}</RecordValue>
                {extras.map(([k, v]) => <RecordValue key={k} label={k} wide mono>{typeof v === 'string' ? v : JSON.stringify(v)}</RecordValue>)}
                {e.user_agent ? <RecordValue label="User agent" wide mono>{e.user_agent}</RecordValue> : null}
              </RecordGrid>
            ) : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Richiesta, identificativi e user agent.</Typography>}
          </RecordSection>
        </Box>
      </Box>
    </RecordModal>
  )
}
