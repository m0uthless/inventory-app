import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Box, Button, ButtonBase, CircularProgress, IconButton, InputBase, ListItemIcon, Menu, MenuItem, Popover, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import CheckIcon from '@mui/icons-material/Check'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import AddIcon from '@mui/icons-material/Add'

import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { buildQuery } from '@shared/utils/nav'
import { copyToClipboard } from '@shared/utils/clipboard'
import {
  BandChip, BandEditing, BandStat, CampoIcon, QuickPick, RecordEmpty, RecordField, RecordGrid, RecordLink, RecordLoader, RecordModal, RecordNotes, RecordRow, RecordRows,
  RecordSection, RecordSelect, RecordValue, bandButtonSx, bandSolidSx, recordMono as mono, useRecordDraft,
} from '../../ui/campo'
import { inventoryDrawerPath } from '../../utils/entityPaths'
import { useAuth } from '../../auth/AuthProvider'
import { PERMS } from '../../auth/perms'
import IssueProcedure, { NextStepCard } from './IssueProcedure'
import { useIssueWiki } from './useIssueWiki'
import { IssuePriorityMark, IssueStatusBadge } from './IssueBadges'
import { assigneesForArea } from './issueUsers'
import {
  PRIORITY_META, STATUS_META, WAITING_REASON_META, fmtIssueDate, fmtIssueDateTime,
  issueAuthorInitials, issueAuthorName, issueInventoryLabel,
  type AreaOption,
  type CategoryOption, type IssueComment, type IssueRow, type UserOption,
} from './types'

/*
 * Finestra della issue (DESIGN.md › Record window, anteprima design-previews/iss-base.html, variante A):
 * testata con stato, collegamenti e l'azione principale (risolvi o riapri); al centro prossimo passo e
 * procedura Wiki, descrizione, attività con il commento in fondo; a lato dettagli, tempo e dove intervenire.
 * I dati si leggono come testo e «Modifica» nel ⋯ li trasforma in campi; stato, priorità e assegnatario
 * si cambiano al volo con un clic (cambiano di continuo), con «Annulla» nel messaggio.
 */

export type IssueEvent = {
  id: number
  created_at: string
  action: string
  actor_username?: string | null
  changes?: Record<string, { from?: unknown; to?: unknown } | [unknown, unknown]> | null
}

export type IssuePatch = Partial<Pick<IssueRow, 'status' | 'waiting_reason' | 'priority' | 'assigned_to' | 'area' | 'category' | 'due_date' | 'servicenow_id' | 'customer' | 'customer_placeholder' | 'site' | 'inventory' | 'title' | 'description'>>

type Props = {
  issue: IssueRow | null
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
  /** Aree selezionabili nei Dettagli. */
  areas?: AreaOption[]
  categories: CategoryOption[]
  meId?: number
  /** Salvataggio di uno o più campi (con annulla, gestito dal chiamante). */
  onPatch: (patch: IssuePatch, label: string) => Promise<void> | void
  /** Modulo completo della issue. */
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

type Draft = { title: string; description: string; due_date: string; category: string; servicenow_id: string; site: string }
const toDraft = (i: IssueRow): Draft => ({
  title: i.title ?? '', description: i.description ?? '', due_date: i.due_date ?? '', category: i.category ? String(i.category) : '',
  servicenow_id: i.servicenow_id ?? '', site: i.site ? String(i.site) : '',
})

/** Valore che si cambia al volo: clic, menu, scelta (stato, priorità, assegnatario). */
export default function IssueDetail(p: Props) {
  return p.issue ? <IssueWindow {...p} issue={p.issue} /> : null
}

function IssueWindow(p: Props & { issue: IssueRow }) {
  const { issue } = p
  const navigate = useNavigate()
  const toast = useToast()
  const sites = useCustomerSites(!issue.is_customer_placeholder ? issue.customer : null)
  const { hasPerm } = useAuth()
  const wiki = useIssueWiki(issue.id, hasPerm(PERMS.wiki.page.view))
  const closed = issue.status === 'closed'
  const resolved = issue.status === 'resolved'
  // Issue di un'altra area: sola lettura (il backend risponde 403 a ogni scrittura).
  const otherArea = issue.can_edit === false
  const canChange = hasPerm(PERMS.issues.issue.change) && !closed && !otherArea
  // Cambio d'area al volo: un assegnatario che non fa parte della nuova area si toglie.
  const pickArea = (areaId: number | null) => {
    if (areaId === issue.area) return
    const keep = !issue.assigned_to || assigneesForArea(p.users, areaId).some((u) => u.id === issue.assigned_to)
    if (keep) void p.onPatch({ area: areaId }, 'Area aggiornata')
    else void p.onPatch({ area: areaId, assigned_to: null }, "Area aggiornata. L'assegnatario non fa parte della nuova area: è stato tolto.")
  }

  // ── Modifica: «Modifica» nel ⋯ trasforma i dati in campi; un solo salvataggio ──
  const [editing, setEditing] = React.useState(false)
  const { draft, changed, set, isDirty, reset } = useRecordDraft<Draft>(issue, () => toDraft(issue))
  const v = editing ? draft : toDraft(issue)
  const [busy, setBusy] = React.useState(false)
  const stopEditing = () => { reset(); setEditing(false) }
  const save = async () => {
    if (!draft.title.trim()) { toast.error('Il titolo è obbligatorio.'); return }
    const value: Record<keyof Draft, unknown> = {
      title: draft.title.trim(), description: draft.description, due_date: draft.due_date || null, category: draft.category ? Number(draft.category) : null,
      servicenow_id: draft.servicenow_id.trim(), site: draft.site ? Number(draft.site) : null,
    }
    const patch = Object.fromEntries(changed.map((k) => [k, value[k]])) as IssuePatch
    // Cambiando sito l'inventario collegato (che sta in un altro sito) si scollega, come prima.
    if (changed.includes('site') && issue.inventory) patch.inventory = null
    setBusy(true)
    try { await p.onPatch(patch, changed.includes('site') && issue.inventory ? 'Issue aggiornata, inventario scollegato' : 'Issue aggiornata'); setEditing(false) } finally { setBusy(false) }
  }
  const blocked = () => { if (editing && changed.length) { toast.error('Salva o annulla le modifiche prima di aprire un altro record.'); return true } return false }
  const go = (path: string) => { if (!blocked()) { p.onClose(); navigate(path) } }

  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  const [custEl, setCustEl] = React.useState<HTMLElement | null>(null)
  React.useEffect(() => { setMenu(null); setEditing(false) }, [issue.id])

  // ── Testata ─────────────────────────────────────────────────────
  const now = Date.now()
  const due = issue.due_date ? new Date(`${issue.due_date}T18:00:00`).getTime() : null
  const over = !closed && !resolved && due != null && now > due
  const soon = !closed && !resolved && due != null && !over && due - now < DAY * 1.5
  const customerLabel = issue.customer_name || issue.customer_placeholder || 'Cliente'
  const scrollTo = (id: string) => document.getElementById(`iss-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const chip = (txt: React.ReactNode, warn?: boolean) => (
    <Box component="span" sx={{ height: 20, px: 0.9, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap',
      bgcolor: warn ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: warn ? '#fde9c4' : '#e6f2ee', '& b': { color: '#fff', fontWeight: 700 } }}>{txt}</Box>
  )
  const bandLink = (label: React.ReactNode, onClick: () => void) => (
    <ButtonBase onClick={onClick} sx={{ font: 'inherit', color: '#fff', fontWeight: 600, verticalAlign: 'baseline', textDecoration: 'underline', textDecorationColor: 'rgb(255 255 255 / .4)', textUnderlineOffset: '3px', '&:hover': { textDecorationColor: '#fff' }, '&.Mui-focusVisible': { outline: '2px solid rgb(255 255 255 / .6)', borderRadius: '3px' } }}>{label}</ButtonBase>
  )

  // ── Al volo: stato (con la causale di attesa), priorità, assegnatario ──
  const statusOptions = [
    ...['open', 'in_progress'].map((s) => ({ value: s, label: <IssueStatusBadge status={s} />, selected: issue.status === s })),
    ...Object.entries(WAITING_REASON_META).map(([k, m]) => ({ value: `waiting:${k}`, label: <><IssueStatusBadge status="waiting" /><Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{m.label}</Box></>, selected: issue.status === 'waiting' && issue.waiting_reason === k })),
    { value: 'resolved', label: <IssueStatusBadge status="resolved" />, selected: resolved },
    { value: 'closed', label: <IssueStatusBadge status="closed" />, selected: closed },
  ]
  const pickStatus = (val: string) => {
    if (val.startsWith('waiting:')) void p.onPatch({ status: 'waiting', waiting_reason: val.slice(8) }, 'Stato aggiornato')
    else void p.onPatch({ status: val, waiting_reason: '' }, 'Stato aggiornato')
  }
  const assignee = issue.assigned_to_full_name
    ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Avatar sx={{ width: 20, height: 20, fontSize: 9, fontWeight: 700, bgcolor: 'archie.field', color: 'primary.main' }}>{ava(issue.assigned_to_full_name)}</Avatar>{issue.assigned_to_full_name}</Box>
    : <Box component="span" sx={{ color: 'warning.main', fontWeight: 550 }}>Non assegnata</Box>

  const issueLink = `${window.location.origin}/issues${buildQuery({ open: issue.id })}`

  return (
    <RecordModal open onClose={p.onClose} ariaLabel={`Issue ${issue.id}`} compact
      title={<><Box component="span" sx={{ ...mono, fontSize: 15, fontWeight: 500, opacity: 0.75 }}>#{issue.id}</Box>{v.title.trim() || issue.title}</>}
      status={<>
        <BandChip>{STATUS_META[issue.status]?.label ?? issue.status_label}{issue.status === 'waiting' && issue.waiting_reason_label ? ` · ${issue.waiting_reason_label}` : ''}</BandChip>
        {editing ? <BandEditing /> : null}
      </>}
      subtitle={<>
        {issue.is_customer_placeholder ? customerLabel : bandLink(customerLabel, () => go(`/customers${buildQuery({ open: issue.customer })}`))}
        {issue.site_name ? <> · {issue.site ? bandLink(issue.site_name, () => go(`/sites${buildQuery({ open: issue.site })}`)) : issue.site_name}</> : null}
        {issue.inventory ? <> · {bandLink(issueInventoryLabel(issue), () => go(inventoryDrawerPath(issue.inventory!, { customer: issue.customer })))}</> : null}
        {issue.servicenow_id ? <> · <Box component="span" sx={{ ...mono, fontSize: 12 }}>{issue.servicenow_id}</Box></> : null}
      </>}
      tags={<>
        {issue.area_label ? chip(<>area <b>{issue.area_label}</b></>) : null}
        {chip(<>priorità <b>{(PRIORITY_META[issue.priority]?.label ?? issue.priority).toLowerCase()}</b></>, issue.priority === 'critical')}
        {chip(issue.assigned_to_full_name ? <>assegnata a <b>{issue.assigned_to_full_name}</b></> : 'non assegnata', !issue.assigned_to)}
        {due != null && !closed && !resolved ? chip(over ? <>scaduta il <b>{fmtIssueDate(issue.due_date)}</b></> : <>scade il <b>{fmtIssueDate(issue.due_date)}</b></>, over || soon) : null}
        <BandStat n={p.comments.length} one=" commento" many=" commenti" onClick={() => scrollTo('att')} />
      </>}
      position={p.position} onPrev={p.onPrev} onNext={p.onNext}
      actions={<>
        {editing || closed || otherArea ? null : resolved
          ? <Button variant="outlined" onClick={() => void p.onPatch({ status: 'in_progress' }, 'Issue riaperta')} sx={bandButtonSx}>Riapri</Button>
          : <Button variant="outlined" startIcon={<CheckIcon sx={{ fontSize: 16 }} />} onClick={() => void p.onPatch({ status: 'resolved', waiting_reason: '' }, 'Issue risolta')} sx={{ ...bandButtonSx, ...bandSolidSx }}>Segna come risolta</Button>}
        <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setMenu(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem disabled={!canChange || editing} onClick={() => { setMenu(null); setEditing(true) }}><ListItemIcon><CampoIcon name="columns" size={16} /></ListItemIcon>Modifica</MenuItem>
          <MenuItem disabled={!canChange} onClick={() => { setMenu(null); p.onEdit() }}><ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>Tutti i campi…</MenuItem>
          <MenuItem disabled={!canChange} onClick={() => { setMenu(null); p.onLinkInventory() }}><ListItemIcon><CampoIcon name="server" size={16} /></ListItemIcon>{issue.inventory ? 'Cambia inventario collegato' : 'Collega un inventario'}</MenuItem>
          <MenuItem onClick={() => { setMenu(null); void copyToClipboard(issueLink).then(() => toast.success('Link copiato')) }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia il link</MenuItem>
          <MenuItem disabled={closed || otherArea || !hasPerm(PERMS.issues.issue.delete)} onClick={() => { setMenu(null); p.onDelete() }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><CampoIcon name="trash" size={16} /></ListItemIcon>Elimina</MenuItem>
        </Menu>
      </>}
      editing={editing} dirtyCount={editing ? changed.length : 0} saving={busy} onSave={() => void save()} onDiscard={stopEditing}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        {/* ── Colonna principale ── */}
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          {otherArea ? <Typography role="note" sx={{ fontSize: 12.5, p: '8px 10px', borderRadius: '8px', bgcolor: 'info.light', color: 'info.main' }}>Issue dell'area {issue.area_label}: puoi solo consultarla.</Typography> : null}
          <NextStepCard wiki={wiki} canEdit={canChange} />
          <RecordSection title="Descrizione">
            {editing ? <RecordNotes value={draft.description} onChange={set('description')} dirty={isDirty('description')} placeholder="Cosa succede, da quando, cosa è già stato provato" ariaLabel="Descrizione" />
              : <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: issue.description ? 'text.primary' : 'text.disabled' }}>{issue.description || 'Nessuna descrizione.'}</Typography>}
          </RecordSection>
          <IssueProcedure wiki={wiki} canEdit={canChange} />
          <Box id="iss-att" sx={{ scrollMarginTop: 16 }}>
            <RecordSection title={<>Attività<Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{p.comments.length + visibleEvents(p.events).length}</Box></>}>
              <ActivityFeed comments={p.comments} events={p.events} loading={p.commentsLoading} />
              {closed ? <RecordEmpty>Issue chiusa: non si commenta più.</RecordEmpty> : otherArea ? null : (
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <InputBase multiline minRows={2} maxRows={6} value={p.newComment} onChange={(e) => p.onNewCommentChange(e.target.value)} disabled={p.sendingComment}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) p.onSendComment() }}
                    placeholder="Scrivi un commento… (Ctrl+Invio per inviare)" inputProps={{ 'aria-label': 'Scrivi un commento' }}
                    sx={{ flex: 1, px: 1.25, py: 0.75, fontSize: 13, bgcolor: 'background.paper', border: '1px solid', borderColor: 'archie.borderStrong', borderRadius: '8px', '&.Mui-focused': { borderColor: 'primary.main', boxShadow: (t) => t.palette.archie.focusRing } }} />
                  <Button variant="contained" onClick={p.onSendComment} disabled={!p.newComment.trim() || p.sendingComment}>
                    {p.sendingComment ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : 'Commenta'}
                  </Button>
                </Box>
              )}
            </RecordSection>
          </Box>
        </Box>

        {/* ── Colonna laterale ── */}
        <Box component="aside" aria-label="Issue" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Dettagli">
            <RecordGrid>
              {editing ? <RecordField editing label="Titolo" value={draft.title} onChange={set('title')} dirty={isDirty('title')} wide /> : null}
              <QuickPick label="Stato" disabled={!canChange} options={statusOptions} onPick={pickStatus}
                value={<><IssueStatusBadge status={issue.status} />{issue.status === 'waiting' && issue.waiting_reason_label ? <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{issue.waiting_reason_label}</Box> : null}</>} />
              <QuickPick label="Priorità" disabled={!canChange} value={<IssuePriorityMark priority={issue.priority} />}
                options={['critical', 'high', 'medium', 'low'].map((k) => ({ value: k, label: <IssuePriorityMark priority={k} />, selected: issue.priority === k }))}
                onPick={(val) => void p.onPatch({ priority: val }, 'Priorità aggiornata')} />
              <QuickPick label="Area" disabled={!canChange}
                value={issue.area_label ?? <Box component="span" sx={{ color: 'text.secondary' }}>Nessuna area</Box>}
                options={[{ value: '', label: <Box component="span" sx={{ color: 'text.secondary' }}>Nessuna area</Box>, selected: !issue.area },
                  ...(p.areas ?? []).map((a) => ({ value: String(a.id), label: a.label, selected: issue.area === a.id }))]}
                onPick={(val) => pickArea(val ? Number(val) : null)} />
              <QuickPick label="Assegnata a" wide disabled={!canChange} value={assignee}
                options={[{ value: '', label: <Box component="span" sx={{ color: 'text.secondary' }}>Nessuno</Box>, selected: !issue.assigned_to }, ...assigneesForArea(p.users, issue.area).map((u) => ({ value: String(u.id), label: u.label, selected: issue.assigned_to === u.id }))]}
                onPick={(val) => void p.onPatch({ assigned_to: val ? Number(val) : null }, 'Assegnatario aggiornato')}
                after={!issue.assigned_to && canChange && p.meId != null ? <Button size="small" onClick={() => void p.onPatch({ assigned_to: p.meId! }, 'Assegnata a te')} sx={{ minWidth: 0, px: 0.5 }}>Assegna a me</Button> : null} />
              <RecordField editing={editing} type="date" label="Scadenza" value={v.due_date} onChange={set('due_date')} dirty={isDirty('due_date')} show={(x) => fmtIssueDate(x)} />
              {editing ? (
                <RecordSelect label="Categoria" value={draft.category} onChange={set('category')} dirty={isDirty('category')}
                  options={[{ value: '', label: 'Nessuna' }, ...p.categories.map((c) => ({ value: String(c.id), label: c.label }))]} />
              ) : <RecordValue label="Categoria">{issue.category_label || null}</RecordValue>}
              <RecordField editing={editing} label="ServiceNow" value={v.servicenow_id} onChange={set('servicenow_id')} dirty={isDirty('servicenow_id')} mono placeholder="CS0000000" wide
                show={(x) => <RecordLink onClick={() => p.onOpenServiceNow(x)}><Box component="span" sx={{ ...mono, fontSize: 12.5 }}>{x}</Box></RecordLink>} />
            </RecordGrid>
            {editing ? <Typography sx={{ mt: 1.25, fontSize: 11.5, color: 'text.secondary' }}>Stato, priorità e assegnatario si cambiano al volo, anche fuori dalla modifica.</Typography> : null}
          </RecordSection>

          <RecordSection title="Tempo"><OpenTimeline issue={issue} events={p.events} /></RecordSection>

          <RecordSection title="Dove intervenire">
            <RecordRows>
              <RecordRow lead={<CampoIcon name="building" size={18} />} title={customerLabel}
                sub={issue.is_customer_placeholder ? 'Cliente non presente in anagrafica' : 'Cliente'}
                end={editing ? <Button size="small" onClick={(e) => { e.stopPropagation(); setCustEl(e.currentTarget) }}>Cambia</Button> : undefined}
                onClick={!editing && !issue.is_customer_placeholder ? () => go(`/customers${buildQuery({ open: issue.customer })}`) : undefined} />
              {editing && !issue.is_customer_placeholder ? (
                <Box sx={{ py: 1 }}>
                  <RecordSelect label="Sito" value={draft.site} onChange={set('site')} dirty={isDirty('site')}
                    options={[{ value: '', label: 'Nessun sito' }, ...sites.map((x) => ({ value: String(x.id), label: x.label }))]} />
                </Box>
              ) : issue.site_name ? (
                <RecordRow lead={<CampoIcon name="pin" size={18} />} title={issue.site_name} sub="Sito" onClick={issue.site ? () => go(`/sites${buildQuery({ open: issue.site })}`) : undefined} />
              ) : null}
              {issue.inventory ? (
                <RecordRow lead={<CampoIcon name="server" size={18} />} title={issueInventoryLabel(issue)} sub={<>Inventario{issue.inventory_hostname ? <> · <Box component="span" sx={mono}>{issue.inventory_hostname}</Box></> : null}</>}
                  onClick={() => go(inventoryDrawerPath(issue.inventory!, { customer: issue.customer }))} />
              ) : (
                <RecordRow lead={<CampoIcon name="server" size={18} />} title={<Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>Nessun inventario collegato</Box>}
                  end={canChange ? <Button size="small" onClick={(e) => { e.stopPropagation(); p.onLinkInventory() }}>Collega</Button> : undefined} />
              )}
            </RecordRows>
            <Popover open={Boolean(custEl)} anchorEl={custEl} onClose={() => setCustEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { sx: { width: 320, p: 1 } } }}>
              <CustomerPicker current={issue.is_customer_placeholder ? null : issue.customer} onPick={(c) => {
                setCustEl(null)
                if (c.id === issue.customer && !issue.is_customer_placeholder) return
                void p.onPatch({ customer: c.id, customer_placeholder: '', site: null, inventory: null }, issue.inventory ? 'Cliente aggiornato, sito e inventario scollegati' : 'Cliente aggiornato')
              }} />
            </Popover>
          </RecordSection>

          <Typography sx={{ px: 0.5, fontSize: 11, color: 'text.disabled' }}>
            Creata da {issue.created_by_full_name || issue.created_by_username} il {fmtIssueDateTime(issue.created_at)} · aggiornata il {fmtIssueDateTime(issue.updated_at)}
          </Typography>
        </Box>
      </Box>
    </RecordModal>
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
  if (loading) return <RecordLoader />
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
