import * as React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Avatar, Box, Button, CircularProgress, InputBase, Link, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import LinkIcon from '@mui/icons-material/Link'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import CheckIcon from '@mui/icons-material/Check'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined'
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import AddIcon from '@mui/icons-material/Add'

import { api } from '@shared/api/client'
import { FloatingDetail, DetailSection, Properties } from '../../ui/campo'
import { inventoryDrawerPath } from '../../utils/entityPaths'
import { IssuePriorityMark, IssueStatusBadge } from './IssueBadges'
import {
  PRIORITY_META, STATUS_META, WAITING_REASON_META, fmtIssueDate, fmtIssueDateTime,
  issueAuthorInitials, issueAuthorName, issueInventoryLabel,
  type CategoryOption, type IssueComment, type IssueRow, type UserOption,
} from './types'

export type IssueEvent = {
  id: number
  created_at: string
  action: string
  actor_username?: string | null
  changes?: Record<string, { from?: unknown; to?: unknown } | [unknown, unknown]> | null
}

export type IssuePatch = Partial<Pick<IssueRow, 'status' | 'waiting_reason' | 'priority' | 'assigned_to' | 'category' | 'due_date' | 'servicenow_id' | 'customer' | 'customer_placeholder' | 'site' | 'inventory'>>

type Props = {
  issue: IssueRow | null
  tab: 'det' | 'att'
  onTab: (t: 'det' | 'att') => void
  position?: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
  comments: IssueComment[]
  commentsLoading: boolean
  /** Eventi di audit della issue (null = permesso mancante o non caricati). */
  events?: IssueEvent[] | null
  newComment: string
  sendingComment: boolean
  onNewCommentChange: (v: string) => void
  onSendComment: () => void
  users: UserOption[]
  categories: CategoryOption[]
  meId?: number
  /** Salvataggio immediato di un campo (con annulla, gestito dal chiamante). */
  onPatch: (patch: IssuePatch, label: string) => void
  onEdit: () => void
  onDelete: () => void
  onLinkInventory: () => void
  onOpenServiceNow: (number: string) => void
}

const DAY = 864e5

const FIELD_LABEL: Record<string, string> = {
  status: 'lo stato', priority: 'la priorità', assigned_to: "l'assegnatario", due_date: 'la scadenza',
  category: 'la categoria', servicenow_id: 'il caso ServiceNow', title: 'il titolo', description: 'la descrizione',
  waiting_reason: 'la causale di attesa', inventory: "l'inventario collegato", site: 'il sito', customer: 'il cliente', opened_at: "la data di apertura",
}
const fmtVal = (field: string, v: unknown): string => {
  if (v == null || v === '') return '—'
  if (field === 'status') return STATUS_META[String(v)]?.label ?? String(v)
  if (field === 'priority') return PRIORITY_META[String(v)]?.label ?? String(v)
  if (field === 'waiting_reason') return WAITING_REASON_META[String(v)]?.label ?? String(v)
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return '…'
  return String(v)
}
/** Descrizione leggibile di un evento di audit. */
function describeEvent(e: IssueEvent): React.ReactNode {
  if (e.action === 'create') return 'ha aperto la issue'
  if (e.action === 'delete') return 'ha eliminato la issue'
  if (e.action === 'restore') return 'ha ripristinato la issue'
  const ch = Object.entries(e.changes ?? {}).filter(([k]) => k !== 'updated_at')
  if (!ch.length) return 'ha modificato la issue'
  return ch.map(([k, v], i) => {
    // Due formati nell'audit: {from, to} (recente) e [from, to] (storico).
    const [from, to] = Array.isArray(v) ? v : [v?.from, v?.to]
    return (
      <React.Fragment key={k}>
        {i ? '; ' : ''}ha cambiato {FIELD_LABEL[k] ?? k}
        {['description'].includes(k) ? null : <> da <b>{fmtVal(k, from)}</b> a <b>{fmtVal(k, to)}</b></>}
      </React.Fragment>
    )
  })
}
const durText = (ms: number) => {
  const h = Math.round(Math.abs(ms) / 36e5)
  const g = Math.floor(h / 24)
  return g >= 1 ? `${g} ${g === 1 ? 'giorno' : 'giorni'}` : `${h} ${h === 1 ? 'ora' : 'ore'}`
}

/** Da quanto è aperta e quanto manca alla scadenza (DESIGN.md › Detail card). */
function OpenTimeline({ issue, events }: { issue: IssueRow; events?: IssueEvent[] | null }) {
  const [now] = React.useState(() => Date.now())
  const opened = new Date(issue.opened_at || issue.created_at).getTime()
  const closedAt = issue.closed_at ? new Date(issue.closed_at).getTime() : null
  const end = closedAt ?? now
  const due = issue.due_date ? new Date(issue.due_date + 'T18:00:00').getTime() : null
  const isClosed = issue.status === 'resolved' || issue.status === 'closed'
  const over = !isClosed && due != null && now > due
  const left = due != null ? due - now : null
  const span = Math.max((due && due > end ? due : end + Math.max((end - opened) * 0.25, DAY / 2)) - opened, 1)
  const pos = (t: number) => Math.max(0, Math.min(100, ((t - opened) / span) * 100))
  const tone = over ? 'error' : left != null && left < DAY * 1.5 && !isClosed ? 'warning' : null
  return (
    <Box component="section" aria-label="Tempo dall'apertura">
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.5 }}>
        <Box>
          <Typography component="span" sx={{ display: 'block', fontSize: 11, color: 'text.secondary' }}>{isClosed ? 'Rimasta aperta' : 'Aperta da'}</Typography>
          <Typography component="b" sx={{ fontSize: 18, fontWeight: 650, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{durText(end - opened)}</Typography>
        </Box>
        <Box component="span" sx={{
          fontSize: 11, fontWeight: 600, px: 0.75, py: '1px', borderRadius: '5px', whiteSpace: 'nowrap',
          bgcolor: tone ? `${tone}.light` : 'archie.neutralBg', color: tone ? `${tone}.main` : 'text.secondary',
        }}>
          {isClosed ? `Chiusa il ${fmtIssueDate(issue.closed_at)}` : due == null ? 'Senza scadenza' : over ? `Scaduta da ${durText(left!)}` : `Scade tra ${durText(left!)}`}
        </Box>
      </Box>
      <Box sx={{ position: 'relative', height: 22, mt: 2, mx: 0.75 }}>
        <Box sx={{ position: 'absolute', left: 0, right: 0, top: 10, height: 2, background: (t) => `repeating-linear-gradient(90deg, ${t.palette.archie.borderStrong} 0 4px, transparent 4px 8px)` }} />
        <Box sx={{ position: 'absolute', left: 0, top: 9, height: 4, borderRadius: 2, width: `${pos(end)}%`, bgcolor: over ? 'error.main' : 'primary.main' }} />
        <Tooltip title={`Aperta il ${fmtIssueDate(issue.opened_at) || fmtIssueDateTime(issue.created_at)}`}>
          <Box sx={{ position: 'absolute', top: 5, left: 0, width: 12, height: 12, ml: '-6px', borderRadius: '50%', bgcolor: 'primary.main', border: '2px solid', borderColor: 'background.paper', boxShadow: (t) => `0 0 0 1px ${t.palette.primary.main}` }} />
        </Tooltip>
        {visibleEvents(events).filter((e) => e.action !== 'create').map((e) => {
          const t = new Date(e.created_at).getTime()
          if (t < opened || t > end) return null
          return (
            <Tooltip key={e.id} title={<>{e.actor_username ? <b>{e.actor_username} </b> : null}{describeEvent(e)} · {fmtIssueDateTime(e.created_at)}</>}>
              <Box sx={{ position: 'absolute', top: 6, left: `${pos(t)}%`, width: 10, height: 10, ml: '-5px', borderRadius: '50%', bgcolor: 'primary.main', border: '2px solid', borderColor: 'background.paper', boxShadow: (th) => `0 0 0 1px ${th.palette.primary.main}`, cursor: 'default' }} />
            </Tooltip>
          )
        })}
        {!isClosed ? (
          <Box sx={{ position: 'absolute', top: 0, bottom: 0, width: 2, ml: '-1px', left: `${pos(now)}%`, bgcolor: 'text.primary', borderRadius: 1 }}>
            <Box component="span" sx={{
              position: 'absolute', top: -15, fontSize: 10, fontWeight: 650, letterSpacing: '0.06em', color: 'text.primary',
              ...(pos(now) > 88 ? { right: 4 } : pos(now) < 8 ? { left: 4 } : { left: '50%', transform: 'translateX(-50%)' }),
            }}>ORA</Box>
          </Box>
        ) : null}
        {due != null ? <Box sx={{ position: 'absolute', top: 3, height: 16, width: 2, ml: '-1px', left: `${pos(due)}%`, bgcolor: 'text.secondary', borderRadius: 1 }} /> : null}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
        <span>{fmtIssueDate(issue.opened_at) || fmtIssueDate(issue.created_at)}</span>
        <span>{due != null ? `Scadenza ${fmtIssueDate(issue.due_date)}` : ''}</span>
      </Box>
    </Box>
  )
}

const ava = (name: string) => name.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase()

export default function IssueDetail(p: Props) {
  const { issue } = p
  const sites = useCustomerSites(issue && !issue.is_customer_placeholder ? issue.customer : null)
  if (!issue) return null
  const closed = issue.status === 'closed'
  const resolved = issue.status === 'resolved'
  const assignedToMe = p.meId != null && issue.assigned_to === p.meId

  const statusOptions = [
    ...['open', 'in_progress'].map((s) => ({ value: s, label: <IssueStatusBadge status={s} /> })),
    ...Object.entries(WAITING_REASON_META).map(([k, v]) => ({ value: `waiting:${k}`, label: <><IssueStatusBadge status="waiting" />&nbsp;<Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{v.label}</Box></> })),
    { value: 'resolved', label: <IssueStatusBadge status="resolved" /> },
    { value: 'closed', label: <IssueStatusBadge status="closed" /> },
  ]
  const statusCurrent = issue.status === 'waiting' ? `waiting:${issue.waiting_reason}` : issue.status

  const props = [
    {
      key: 'status', label: 'Stato', current: statusCurrent, options: statusOptions, disabled: closed,
      display: <><IssueStatusBadge status={issue.status} />{issue.status === 'waiting' && issue.waiting_reason_label ? <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>{issue.waiting_reason_label}</Box> : null}</>,
      onChange: (v: string) => {
        if (v.startsWith('waiting:')) p.onPatch({ status: 'waiting', waiting_reason: v.slice(8) }, 'Stato aggiornato')
        else p.onPatch({ status: v, waiting_reason: '' }, 'Stato aggiornato')
      },
    },
    {
      key: 'priority', label: 'Priorità', current: issue.priority, disabled: closed,
      options: ['critical', 'high', 'medium', 'low'].map((k) => ({ value: k, label: <IssuePriorityMark priority={k} /> })),
      display: <IssuePriorityMark priority={issue.priority} />,
      onChange: (v: string) => p.onPatch({ priority: v }, 'Priorità aggiornata'),
    },
    {
      key: 'assigned', label: 'Assegnata a', current: issue.assigned_to ? String(issue.assigned_to) : '', disabled: closed,
      options: [{ value: '', label: <Box component="span" sx={{ color: 'text.secondary' }}>Nessuno</Box> }, ...p.users.map((u) => ({ value: String(u.id), label: u.label }))],
      display: issue.assigned_to_full_name
        ? <><Avatar sx={{ width: 18, height: 18, fontSize: 8, fontWeight: 700, bgcolor: 'archie.field', color: 'primary.main' }}>{ava(issue.assigned_to_full_name)}</Avatar>{issue.assigned_to_full_name}</>
        : <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>Nessuno</Box>,
      onChange: (v: string) => p.onPatch({ assigned_to: v ? Number(v) : null }, 'Assegnatario aggiornato'),
    },
    {
      key: 'due', label: 'Scadenza', disabled: closed,
      text: { value: issue.due_date ?? '', type: 'date' as const },
      display: issue.due_date ? fmtIssueDate(issue.due_date) : <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>Nessuna</Box>,
      onChange: (v: string) => p.onPatch({ due_date: v || null }, 'Scadenza aggiornata'),
    },
    {
      key: 'category', label: 'Categoria', current: issue.category ? String(issue.category) : '', disabled: closed,
      options: [{ value: '', label: <Box component="span" sx={{ color: 'text.secondary' }}>Nessuna</Box> }, ...p.categories.map((c) => ({ value: String(c.id), label: c.label }))],
      display: issue.category_label || <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>Nessuna</Box>,
      onChange: (v: string) => p.onPatch({ category: v ? Number(v) : null }, 'Categoria aggiornata'),
    },
    {
      key: 'customer', label: 'Cliente', disabled: closed, full: true,
      display: <>{issue.customer_name || issue.customer_placeholder}{issue.is_customer_placeholder ? <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>· non in anagrafica</Box> : null}</>,
      editor: (close: () => void) => (
        <CustomerPicker
          current={issue.is_customer_placeholder ? null : issue.customer}
          onPick={(c) => {
            close()
            if (c.id === issue.customer && !issue.is_customer_placeholder) return
            p.onPatch({ customer: c.id, customer_placeholder: '', site: null, inventory: null },
              issue.inventory ? 'Cliente aggiornato, sito e inventario scollegati' : 'Cliente aggiornato')
          }}
        />
      ),
    },
    {
      key: 'site', label: 'Sito', disabled: closed || issue.is_customer_placeholder, full: true,
      current: issue.site ? String(issue.site) : '',
      options: [{ value: '', label: <Box component="span" sx={{ color: 'text.secondary' }}>Nessun sito</Box> }, ...sites.map((x) => ({ value: String(x.id), label: x.label }))],
      display: issue.site_name || <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>{issue.is_customer_placeholder ? 'Non disponibile con cliente non in anagrafica' : 'Nessuno'}</Box>,
      onChange: (v: string) => p.onPatch(issue.inventory ? { site: v ? Number(v) : null, inventory: null } : { site: v ? Number(v) : null }, issue.inventory ? 'Sito aggiornato, inventario scollegato' : 'Sito aggiornato'),
    },
    {
      key: 'sn', label: 'ServiceNow', disabled: closed,
      text: { value: issue.servicenow_id ?? '', placeholder: 'CS0000000', mono: true },
      display: issue.servicenow_id || <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400, fontFamily: 'inherit' }}>Da collegare</Box>,
      onChange: (v: string) => p.onPatch({ servicenow_id: v.trim() }, 'Caso ServiceNow aggiornato'),
    },
  ]

  const where: { icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode }[] = [
    { icon: <ApartmentOutlinedIcon />, title: issue.customer_name || issue.customer_placeholder || '—', sub: issue.is_customer_placeholder ? 'Cliente non presente in anagrafica' : 'Cliente' },
  ]
  if (issue.site_name) where.push({ icon: <PlaceOutlinedIcon />, title: issue.site_name, sub: 'Sito' })
  where.push(issue.inventory
    ? { icon: <DnsOutlinedIcon />, title: <Link component={RouterLink} to={inventoryDrawerPath(issue.inventory, { customer: issue.customer })} onClick={p.onClose} underline="hover">{issueInventoryLabel(issue)}</Link>, sub: 'Inventario collegato' }
    : { icon: <DnsOutlinedIcon />, title: <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>Nessun inventario collegato</Box>, sub: closed ? undefined : <Link component="button" type="button" underline="hover" onClick={p.onLinkInventory} sx={{ fontSize: 11 }}>Collega un inventario</Link> })
  if (issue.servicenow_id) where.push({
    icon: <CloudSyncOutlinedIcon />,
    title: <Link component="button" type="button" underline="hover" onClick={() => p.onOpenServiceNow(issue.servicenow_id)} sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12 }}>{issue.servicenow_id}</Link>,
    sub: issue.servicenow_external_url ? <Link href={issue.servicenow_external_url} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ fontSize: 11 }}>Apri sul portale ServiceNow</Link> : 'Caso ServiceNow',
  })

  const footer = p.tab === 'det' ? (
    <>
      {!closed && !assignedToMe && p.meId != null ? (
        <Button variant="outlined" startIcon={<PersonOutlineIcon />} onClick={() => p.onPatch({ assigned_to: p.meId! }, 'Assegnata a te')}>Assegna a me</Button>
      ) : null}
      <Box sx={{ flex: 1 }} />
      {!closed && !resolved ? (
        <Button variant="contained" startIcon={<CheckIcon />} onClick={() => p.onPatch({ status: 'resolved', waiting_reason: '' }, 'Issue risolta')}>Segna come risolta</Button>
      ) : resolved ? (
        <Button variant="outlined" onClick={() => p.onPatch({ status: 'in_progress' }, 'Issue riaperta')}>Riapri</Button>
      ) : (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Issue chiusa: non più modificabile.</Typography>
      )}
    </>
  ) : (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, width: '100%' }}>
      <InputBase multiline maxRows={4} value={p.newComment} onChange={(e) => p.onNewCommentChange(e.target.value)} disabled={p.sendingComment}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) p.onSendComment() }}
        placeholder="Scrivi un commento… (Ctrl+Invio per inviare)" inputProps={{ 'aria-label': 'Scrivi un commento' }}
        sx={{ flex: 1, minHeight: 34, px: 1.25, py: 0.75, fontSize: 13, bgcolor: 'background.paper', border: '1px solid', borderColor: 'archie.borderStrong', borderRadius: '8px', '&.Mui-focused': { borderColor: 'primary.main', boxShadow: (t) => t.palette.archie.focusRing } }} />
      <Button variant="contained" onClick={p.onSendComment} disabled={!p.newComment.trim() || p.sendingComment}>
        {p.sendingComment ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : 'Commenta'}
      </Button>
    </Box>
  )

  return (
    <FloatingDetail
      open
      onClose={p.onClose}
      ariaLabel="Dettaglio issue"
      idLabel={`#${issue.id}`}
      status={<IssueStatusBadge status={issue.status} onDark />}
      title={issue.title}
      subtitle={[issue.customer_name || issue.customer_placeholder, issue.site_name].filter(Boolean).join(' · ')}
      tabs={[{ key: 'det', label: 'Dettagli' }, { key: 'att', label: p.events ? 'Attività' : 'Commenti', count: p.comments.length + visibleEvents(p.events).length }]}
      tab={p.tab}
      onTab={(k) => p.onTab(k as 'det' | 'att')}
      position={p.position}
      onPrev={p.onPrev}
      onNext={p.onNext}
      menu={[
        { label: 'Modifica tutti i campi', icon: <EditIcon />, onClick: p.onEdit, disabled: closed },
        { label: issue.inventory ? 'Cambia inventario collegato' : 'Collega un inventario', icon: <LinkIcon />, onClick: p.onLinkInventory, disabled: closed },
        { label: 'Elimina', icon: <DeleteOutlineIcon />, onClick: p.onDelete, danger: true, disabled: closed },
      ]}
      footer={footer}
    >
      {p.tab === 'det' ? (
        <>
          <Properties
            storageKey="issue-props-open"
            props={props}
            summary={<><IssuePriorityMark priority={issue.priority} /><Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>{issue.assigned_to_full_name || 'Non assegnata'}</Box></>}
          />
          <OpenTimeline issue={issue} events={p.events} />
          <DetailSection title="Descrizione">
            <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: issue.description ? 'text.primary' : 'text.disabled' }}>
              {issue.description || 'Nessuna descrizione.'}
            </Typography>
          </DetailSection>
          <DetailSection title="Dove intervenire">
            <Box sx={{ display: 'grid', gap: 0.75 }}>
              {where.map((w, i) => (
                <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 1, alignItems: 'center' }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '6px', display: 'grid', placeItems: 'center', bgcolor: 'archie.field', color: 'primary.main', '& svg': { fontSize: 14 } }}>{w.icon}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="div" sx={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</Typography>
                    {w.sub ? <Typography component="div" sx={{ fontSize: 11, color: 'text.secondary' }}>{w.sub}</Typography> : null}
                  </Box>
                </Box>
              ))}
            </Box>
          </DetailSection>
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
            Creata da {issue.created_by_full_name || issue.created_by_username} il {fmtIssueDateTime(issue.created_at)} · aggiornata il {fmtIssueDateTime(issue.updated_at)}
          </Typography>
        </>
      ) : (
        <ActivityFeed comments={p.comments} events={p.events} loading={p.commentsLoading} />
      )}
    </FloatingDetail>
  )
}


/** Eventi da mostrare: senza quelli che ripetono un commento o non cambiano nulla. */
function visibleEvents(events?: IssueEvent[] | null) {
  return (events ?? []).filter((e) => {
    if (e.action !== 'update') return true
    const keys = Object.keys(e.changes ?? {}).filter((k) => k !== 'updated_at')
    return keys.length > 0 && !keys.every((k) => k === 'comment_added')
  })
}

type FeedItem = { kind: 'cm'; at: string; c: IssueComment } | { kind: 'ev'; at: string; e: IssueEvent }

/** Cronologia: commenti e modifiche insieme, con filtro (DESIGN.md › Detail card › Attività). */
function ActivityFeed({ comments, events, loading }: { comments: IssueComment[]; events?: IssueEvent[] | null; loading: boolean }) {
  const [filter, setFilter] = React.useState<'all' | 'cm' | 'ev'>('all')
  const items: FeedItem[] = [
    ...comments.map((c) => ({ kind: 'cm' as const, at: c.created_at, c })),
    ...visibleEvents(events).map((e) => ({ kind: 'ev' as const, at: e.created_at, e })),
  ].sort((a, b) => a.at.localeCompare(b.at))
  const evCount = visibleEvents(events).length
  const shown = items.filter((i) => filter === 'all' || i.kind === filter)
  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress size={22} /></Box>
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {events ? (
        <Box role="group" aria-label="Filtra attività" sx={{ display: 'inline-flex', justifySelf: 'start', gap: '2px', p: '2px', border: '1px solid', borderColor: 'divider', borderRadius: '7px', bgcolor: 'archie.surface2' }}>
          {([['all', 'Tutto', items.length], ['cm', 'Commenti', comments.length], ['ev', 'Modifiche', evCount]] as const).map(([k, l, n]) => (
            <Button key={k} size="small" aria-pressed={filter === k} onClick={() => setFilter(k)} sx={{
              minHeight: 26, px: 1.25, gap: 0.75, color: filter === k ? 'text.primary' : 'text.secondary',
              bgcolor: filter === k ? 'background.paper' : 'transparent', boxShadow: filter === k ? (t) => `0 1px 2px rgb(0 0 0 / .08), 0 0 0 1px ${t.palette.divider}` : 'none',
              '&:hover': { bgcolor: filter === k ? 'background.paper' : 'transparent' },
            }}>{l} <Box component="span" sx={{ fontSize: 11 }}>{n}</Box></Button>
          ))}
        </Box>
      ) : null}
      {shown.length === 0 ? (
        <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
          <ChatBubbleOutlineIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: 13 }}>{filter === 'ev' ? 'Nessuna modifica registrata.' : 'Nessun commento. Scrivi il primo qui sotto.'}</Typography>
        </Box>
      ) : shown.map((it) => it.kind === 'cm' ? (
        <Box key={`c${it.c.id}`} sx={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 1, alignItems: 'start' }}>
          <Avatar sx={{ width: 24, height: 24, fontSize: 9, fontWeight: 700, bgcolor: 'archie.field', color: 'primary.main' }}>{issueAuthorInitials(it.c)}</Avatar>
          <Box sx={{ bgcolor: 'archie.surface2', border: '1px solid', borderColor: 'divider', borderRadius: '4px 10px 10px 10px', px: 1.25, py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.25 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{issueAuthorName(it.c)}</Typography>
              <Typography sx={{ ml: 'auto', fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>{fmtIssueDateTime(it.c.created_at)}</Typography>
            </Box>
            <Typography sx={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{it.c.body}</Typography>
          </Box>
        </Box>
      ) : (
        <Box key={`e${it.e.id}`} sx={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 1, alignItems: 'center', fontSize: 12, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
          <Box sx={{ width: 22, height: 22, ml: '1px', borderRadius: '50%', bgcolor: 'archie.neutralBg', display: 'grid', placeItems: 'center', '& svg': { fontSize: 13 } }}>
            {it.e.action === 'create' ? <AddIcon /> : <EditIcon />}
          </Box>
          <span><b>{it.e.actor_username || 'Sistema'}</b> {describeEvent(it.e)}</span>
          <Box component="time" sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtIssueDateTime(it.e.created_at)}</Box>
        </Box>
      ))}
    </Box>
  )
}

type Opt = { id: number; label: string }

function useCustomerSites(customerId: number | null) {
  const [sites, setSites] = React.useState<Opt[]>([])
  React.useEffect(() => {
    if (!customerId) { setSites([]); return }
    let alive = true
    api.get('/sites/', { params: { customer: customerId, page_size: 200, ordering: 'name' } }).then((r) => {
      const d = r.data as { results?: Record<string, unknown>[] } | Record<string, unknown>[]
      const list = Array.isArray(d) ? d : d.results ?? []
      if (alive) setSites(list.map((x) => ({ id: Number(x.id), label: String(x.display_name || x.name || x.id) })))
    }).catch(() => { if (alive) setSites([]) })
    return () => { alive = false }
  }, [customerId])
  return sites
}

/** Ricerca cliente in anagrafica (per il cambio cliente dal pannello). */
function CustomerPicker({ current, onPick }: { current: number | null; onPick: (c: Opt) => void }) {
  const [q, setQ] = React.useState('')
  const [list, setList] = React.useState<Opt[]>([])
  const [loading, setLoading] = React.useState(false)
  const [active, setActive] = React.useState(0)
  React.useEffect(() => {
    let alive = true
    setLoading(true)
    const t = window.setTimeout(() => {
      api.get('/customers/', { params: { search: q || undefined, page_size: 20, ordering: 'name' } }).then((r) => {
        const d = r.data as { results?: Record<string, unknown>[] } | Record<string, unknown>[]
        const rows = Array.isArray(d) ? d : d.results ?? []
        if (alive) { setList(rows.map((x) => ({ id: Number(x.id), label: String(x.display_name || x.name || x.id) }))); setActive(0) }
      }).catch(() => {}).finally(() => { if (alive) setLoading(false) })
    }, 250)
    return () => { alive = false; window.clearTimeout(t) }
  }, [q])
  return (
    <Box>
      <InputBase autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca cliente…" inputProps={{ 'aria-label': 'Cerca cliente' }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && list[active]) { e.preventDefault(); onPick(list[active]) }
        }}
        sx={{ width: '100%', height: 32, px: 1, mb: 0.5, fontSize: 13, border: '1px solid', borderColor: 'divider', borderRadius: '6px', '&.Mui-focused': { borderColor: 'primary.main' } }} />
      <Box role="listbox" sx={{ maxHeight: 260, overflowY: 'auto', display: 'grid' }}>
        {list.map((c, i) => (
          <Box key={c.id} role="option" aria-selected={c.id === current} onMouseEnter={() => setActive(i)} onClick={() => onPick(c)}
            sx={{ display: 'flex', alignItems: 'center', height: 30, px: 1, borderRadius: '5px', fontSize: 13, cursor: 'pointer',
              bgcolor: i === active ? 'archie.surface2' : 'transparent', fontWeight: c.id === current ? 600 : 400 }}>
            {c.label}
            {c.id === current ? <CheckIcon sx={{ ml: 'auto', fontSize: 15, color: 'primary.main' }} /> : null}
          </Box>
        ))}
        {!list.length ? <Box sx={{ p: 1, fontSize: 12, color: 'text.secondary' }}>{loading ? 'Ricerca…' : 'Nessun cliente trovato'}</Box> : null}
      </Box>
    </Box>
  )
}
