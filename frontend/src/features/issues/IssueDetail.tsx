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

import { FloatingDetail, DetailSection, Properties } from '../../ui/campo'
import { inventoryDrawerPath } from '../../utils/entityPaths'
import { IssuePriorityMark, IssueStatusBadge } from './IssueBadges'
import {
  WAITING_REASON_META, fmtIssueDate, fmtIssueDateTime,
  issueAuthorInitials, issueAuthorName, issueInventoryLabel,
  type CategoryOption, type IssueComment, type IssueRow, type UserOption,
} from './types'

export type IssuePatch = Partial<Pick<IssueRow, 'status' | 'waiting_reason' | 'priority' | 'assigned_to' | 'category' | 'due_date' | 'servicenow_id'>>

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
const durText = (ms: number) => {
  const h = Math.round(Math.abs(ms) / 36e5)
  const g = Math.floor(h / 24)
  return g >= 1 ? `${g} ${g === 1 ? 'giorno' : 'giorni'}` : `${h} ${h === 1 ? 'ora' : 'ore'}`
}

/** Da quanto è aperta e quanto manca alla scadenza (DESIGN.md › Detail card). */
function OpenTimeline({ issue }: { issue: IssueRow }) {
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

const ava = (name: string) => name.split(/[\s.]+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase()

export default function IssueDetail(p: Props) {
  const { issue } = p
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
      tabs={[{ key: 'det', label: 'Dettagli' }, { key: 'att', label: 'Commenti', count: p.comments.length }]}
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
          <OpenTimeline issue={issue} />
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
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {p.commentsLoading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress size={22} /></Box>
          ) : p.comments.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 1 }} />
              <Typography sx={{ fontSize: 13 }}>Nessun commento. Scrivi il primo qui sotto.</Typography>
            </Box>
          ) : p.comments.map((c) => (
            <Box key={c.id} sx={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 1, alignItems: 'start' }}>
              <Avatar sx={{ width: 24, height: 24, fontSize: 9, fontWeight: 700, bgcolor: 'archie.field', color: 'primary.main' }}>{issueAuthorInitials(c)}</Avatar>
              <Box sx={{ bgcolor: 'archie.surface2', border: '1px solid', borderColor: 'divider', borderRadius: '4px 10px 10px 10px', px: 1.25, py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.25 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{issueAuthorName(c)}</Typography>
                  <Typography sx={{ ml: 'auto', fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>{fmtIssueDateTime(c.created_at)}</Typography>
                </Box>
                <Typography sx={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.body}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </FloatingDetail>
  )
}

