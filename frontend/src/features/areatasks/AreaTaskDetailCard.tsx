import * as React from 'react'
import { Avatar, Box, Button, ButtonBase, CircularProgress, IconButton, InputBase, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import { copyToClipboard } from '@shared/utils/clipboard'
import { buildQuery } from '@shared/utils/nav'
import { useToast } from '@shared/ui/toast'
import {
  BandChip, BandEditing, BandStat, CampoIcon, RecordEmpty, RecordField, RecordGrid, RecordLoader, RecordModal, RecordNotes, RecordSection,
  RecordValue, bandButtonSx, bandSolidSx, recordMono as mono, useList, useRecordDraft,
} from '../../ui/campo'
import { IssuePriorityMark } from '../issues/IssueBadges'
import { TaskStatusBadge, daysTo, ddmmyyyy, isOpenTask } from './taskUi'
import {
  STATUS_META, STATUS_ORDER, fmtTaskDateTime, formatBytes, personInitials,
  type AreaTaskComment, type AreaTaskRow, type AreaUser, type TaskPriority, type TaskStatus,
} from './types'

/*
 * Finestra del task di area (DESIGN.md › Record window, anteprima design-previews/tsk-base.html), sullo schema
 * della issue: testata con area, stato e azione principale che segue il ciclo (Inizia, Completa, Riprendi,
 * Riapri); al centro descrizione, allegati da Drive e attività (commenti e modifiche) con il commento in fondo;
 * a lato dettagli (stato, priorità, assegnatario al volo), tempo e «Trasforma in issue». I dati si leggono
 * come testo, «Modifica» nel ⋯ li rende campi. Chi non è dell'area lo vede in sola lettura.
 */

export type AreaTaskPatch = Partial<Pick<AreaTaskRow, 'status' | 'priority' | 'assigned_to' | 'due_date' | 'description' | 'title'>>

type Props = {
  task: AreaTaskRow
  meId: number | null
  users: AreaUser[]
  /** Al primo render scorre ai commenti (aperto dal contatore dei commenti). */
  focusComments?: boolean
  comments: AreaTaskComment[]
  commentsLoading: boolean
  newComment: string
  sendingComment: boolean
  onNewCommentChange: (v: string) => void
  onSendComment: () => void
  canLinkFiles: boolean
  unlinkingId: number | null
  onLinkFiles: () => void
  onUnlinkFile: (id: number) => void
  canConvert: boolean
  onConvert: () => void
  onOpenIssue: (id: number) => void
  onPatch: (patch: AreaTaskPatch, label: string) => Promise<void> | void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
  position?: string
  onPrev?: () => void
  onNext?: () => void
}

type AuditEvent = { id: number; action: string; actor_username?: string | null; created_at: string; changes?: Record<string, { from?: unknown; to?: unknown } | [unknown, unknown]> | null }
const FIELD: Record<string, string> = { title: 'il titolo', description: 'la descrizione', status: 'lo stato', priority: 'la priorità', due_date: 'la scadenza', assigned_to: "l'assegnatario", drive_files: 'gli allegati', converted_to_issue: 'la issue collegata' }
const PRIO_LABEL: Record<TaskPriority, string> = { critical: 'Critica', high: 'Alta', medium: 'Media', low: 'Bassa' }
const valOf = (k: string, v: unknown) => (v == null || v === '' ? '—' : k === 'status' ? STATUS_META[v as TaskStatus]?.label ?? String(v) : k === 'priority' ? PRIO_LABEL[v as TaskPriority] ?? String(v) : typeof v === 'object' ? '…' : String(v))
function describe(e: AuditEvent): React.ReactNode {
  if (e.action === 'create') return 'ha creato il task'
  if (e.action === 'delete') return 'ha eliminato il task'
  if (e.action === 'restore') return 'ha ripristinato il task'
  const ch = Object.entries(e.changes ?? {}).filter(([k]) => k !== 'updated_at')
  if (!ch.length) return 'ha modificato il task'
  return ch.map(([k, v], i) => {
    const [from, to] = Array.isArray(v) ? v : [v?.from, v?.to]
    return <React.Fragment key={k}>{i ? '; ' : ''}ha cambiato {FIELD[k] ?? k}{['description', 'drive_files', 'assigned_to'].includes(k) ? null : <> da <b>{valOf(k, from)}</b> a <b>{valOf(k, to)}</b></>}</React.Fragment>
  })
}

const DAY = 864e5
const dur = (ms: number) => { const g = Math.floor(Math.abs(ms) / DAY); return `${g} ${g === 1 ? 'giorno' : 'giorni'}` }

/** Da quanto è aperto e quanto manca alla scadenza (come nella issue). */
function TaskTimeline({ task }: { task: AreaTaskRow }) {
  const [now] = React.useState(() => Date.now())
  const opened = new Date(task.created_at).getTime()
  const done = task.completed_at && !isOpenTask(task) ? new Date(task.completed_at).getTime() : null
  const end = done ?? now
  const due = task.due_date ? new Date(task.due_date + 'T18:00:00').getTime() : null
  const open = isOpenTask(task)
  const left = task.due_date ? daysTo(task.due_date) : null
  const over = open && left != null && left < 0
  const span = Math.max((due && due > end ? due : end + Math.max((end - opened) * 0.25, DAY / 2)) - opened, 1)
  const pos = (t: number) => Math.max(0, Math.min(100, ((t - opened) / span) * 100))
  const tone = over ? 'error' : open && left != null && left <= 1 ? 'warning' : null
  const badge = !open ? `Completato il ${ddmmyyyy(task.completed_at)}` : left == null ? 'Senza scadenza'
    : over ? `Scaduto da ${-left} ${left === -1 ? 'giorno' : 'giorni'}` : left === 0 ? 'Scade oggi' : `Scade tra ${left} ${left === 1 ? 'giorno' : 'giorni'}`
  return (
    <Box component="section" aria-label="Tempo dalla creazione">
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.5 }}>
        <Box>
          <Typography component="span" sx={{ display: 'block', fontSize: 11, color: 'text.secondary' }}>{open ? 'Aperto da' : 'Chiuso in'}</Typography>
          <Typography component="b" sx={{ fontSize: 18, fontWeight: 650, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{dur(end - opened)}</Typography>
        </Box>
        <Box component="span" sx={{ fontSize: 11, fontWeight: 600, px: 0.75, py: '1px', borderRadius: '5px', whiteSpace: 'nowrap', bgcolor: tone ? `${tone}.light` : 'archie.neutralBg', color: tone ? `${tone}.main` : 'text.secondary' }}>{badge}</Box>
      </Box>
      <Box sx={{ position: 'relative', height: 22, mt: 2, mx: 0.75 }}>
        <Box sx={{ position: 'absolute', left: 0, right: 0, top: 10, height: 2, background: (t) => `repeating-linear-gradient(90deg, ${t.palette.archie.borderStrong} 0 4px, transparent 4px 8px)` }} />
        <Box sx={{ position: 'absolute', left: 0, top: 9, height: 4, borderRadius: 2, width: `${pos(end)}%`, bgcolor: over ? 'error.main' : 'primary.main' }} />
        <Box sx={{ position: 'absolute', top: 5, left: 0, width: 12, height: 12, ml: '-6px', borderRadius: '50%', bgcolor: 'primary.main', border: '2px solid', borderColor: 'background.paper', boxShadow: (t) => `0 0 0 1px ${t.palette.primary.main}` }} />
        {open ? (
          <Box sx={{ position: 'absolute', top: 0, bottom: 0, width: 2, ml: '-1px', left: `${pos(now)}%`, bgcolor: 'text.primary', borderRadius: 1 }}>
            <Box component="span" sx={{ position: 'absolute', top: -15, fontSize: 10, fontWeight: 650, letterSpacing: '0.06em', color: 'text.primary', ...(pos(now) > 88 ? { right: 4 } : pos(now) < 8 ? { left: 4 } : { left: '50%', transform: 'translateX(-50%)' }) }}>OGGI</Box>
          </Box>
        ) : null}
        {due != null ? <Box sx={{ position: 'absolute', top: 3, height: 16, width: 2, ml: '-1px', left: `${pos(due)}%`, bgcolor: 'text.secondary', borderRadius: 1 }} /> : null}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
        <span>Creato {ddmmyyyy(task.created_at)}</span>
        <span>{task.due_date ? `Scadenza ${ddmmyyyy(task.due_date)}` : ''}</span>
      </Box>
    </Box>
  )
}

/** Valore che si cambia al volo (stato, priorità, assegnatario), come nella issue. */
function QuickPick({ label, value, options, onPick, disabled, after, wide }: {
  label: string; value: React.ReactNode; options: { value: string; label: React.ReactNode; selected?: boolean }[]; onPick: (v: string) => void
  disabled?: boolean; after?: React.ReactNode; wide?: boolean
}) {
  const [el, setEl] = React.useState<HTMLElement | null>(null)
  return (
    <Box sx={{ display: 'grid', gap: '3px', minWidth: 0, gridColumn: wide ? '1 / -1' : undefined }}>
      <Typography component="span" sx={{ fontSize: 11.5, fontWeight: 550, color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25, minHeight: 22 }}>
        <ButtonBase disabled={disabled} aria-haspopup="menu" aria-label={`${label}: cambia`} onClick={(e) => setEl(e.currentTarget)} sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 13, borderRadius: '6px', pr: 0.5, py: '1px',
          '&:hover': { bgcolor: 'archie.surface2', boxShadow: (t) => `0 0 0 4px ${t.palette.archie.surface2}` }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
        }}>
          {value}{disabled ? null : <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><CampoIcon name="chevD" size={13} /></Box>}
        </ButtonBase>
        {after}
      </Box>
      <Menu anchorEl={el} open={Boolean(el)} onClose={() => setEl(null)}>
        {options.map((o) => <MenuItem key={o.value} selected={o.selected} onClick={() => { setEl(null); onPick(o.value) }} sx={{ fontSize: 13, gap: 1 }}>{o.label}</MenuItem>)}
      </Menu>
    </Box>
  )
}

type Draft = { title: string; description: string; due_date: string }
const toDraft = (t: AreaTaskRow): Draft => ({ title: t.title ?? '', description: t.description ?? '', due_date: t.due_date ?? '' })

export default function AreaTaskDetailCard(p: Props) {
  const t = p.task
  const toast = useToast()
  const edit = t.can_edit
  const open = isOpenTask(t)
  const issueId = t.converted_to_issue
  const canAct = edit && !issueId
  const users = t.assigned_to != null && !p.users.some((u) => u.id === t.assigned_to)
    ? [{ id: t.assigned_to, label: t.assigned_to_name ?? String(t.assigned_to) }, ...p.users] : p.users

  // ── Modifica ────────────────────────────────────────────────────
  const [editing, setEditing] = React.useState(false)
  const { draft, changed, set, isDirty, reset } = useRecordDraft<Draft>(t, () => toDraft(t))
  const v = editing ? draft : toDraft(t)
  const [busy, setBusy] = React.useState(false)
  const save = async () => {
    if (!draft.title.trim()) { toast.error('Il titolo è obbligatorio.'); return }
    const value: Record<keyof Draft, unknown> = { title: draft.title.trim(), description: draft.description.trim(), due_date: draft.due_date || null }
    setBusy(true)
    try { await p.onPatch(Object.fromEntries(changed.map((k) => [k, value[k]])) as AreaTaskPatch, 'Task aggiornato'); setEditing(false) } finally { setBusy(false) }
  }
  const [menu, setMenu] = React.useState<HTMLElement | null>(null)
  const [feed, setFeed] = React.useState<'all' | 'cm' | 'ev'>('all')
  React.useEffect(() => { setMenu(null); setEditing(false); setFeed('all') }, [t.id])
  React.useEffect(() => {
    if (!p.focusComments) return
    const id = window.setTimeout(() => document.getElementById('task-att')?.scrollIntoView({ block: 'start' }), 250)
    return () => window.clearTimeout(id)
  }, [t.id, p.focusComments])

  // ── Attività: commenti e modifiche insieme ──────────────────────
  const events = useList<AuditEvent>('/audit-events/', { app_label: 'core', model: 'areatask', object_id: String(t.id), ordering: 'created_at', page_size: 200 }, t.updated_at)
  const visible = (events ?? []).filter((e) => e.action !== 'update' || Object.keys(e.changes ?? {}).some((k) => k !== 'updated_at'))
  type Item = { kind: 'cm'; at: string; c: AreaTaskComment } | { kind: 'ev'; at: string; e: AuditEvent }
  const items: Item[] = [...p.comments.map((c) => ({ kind: 'cm' as const, at: c.created_at, c })), ...visible.map((e) => ({ kind: 'ev' as const, at: e.created_at, e }))].sort((a, b) => a.at.localeCompare(b.at))
  const shownItems = items.filter((i) => feed === 'all' || i.kind === feed)

  // ── Testata ─────────────────────────────────────────────────────
  const left = t.due_date ? daysTo(t.due_date) : null
  const late = open && left != null && left < 0
  const soon = open && left != null && left >= 0 && left <= 1
  const scrollTo = (id: string) => document.getElementById(`task-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const chip = (txt: React.ReactNode, warn?: boolean) => (
    <Box component="span" sx={{ height: 20, px: 0.9, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap',
      bgcolor: warn ? 'rgb(224 164 58 / .28)' : 'rgb(255 255 255 / .12)', color: warn ? '#fde9c4' : '#e6f2ee', '& b': { color: '#fff', fontWeight: 700 } }}>{txt}</Box>
  )
  const primary = !canAct || editing ? null
    : t.status === 'da_fare' ? <Button variant="outlined" startIcon={<PlayArrowRoundedIcon />} onClick={() => void p.onPatch({ status: 'in_corso' }, 'Stato: In corso')} sx={{ ...bandButtonSx, ...bandSolidSx }}>Inizia</Button>
      : t.status === 'in_corso' ? <Button variant="outlined" startIcon={<CheckIcon sx={{ fontSize: 16 }} />} onClick={() => void p.onPatch({ status: 'completato' }, 'Task completato')} sx={{ ...bandButtonSx, ...bandSolidSx }}>Completa</Button>
        : t.status === 'in_attesa' ? <Button variant="outlined" startIcon={<PlayArrowRoundedIcon />} onClick={() => void p.onPatch({ status: 'in_corso' }, 'Stato: In corso')} sx={{ ...bandButtonSx, ...bandSolidSx }}>Riprendi</Button>
          : <Button variant="outlined" onClick={() => void p.onPatch({ status: 'in_corso' }, 'Task riaperto')} sx={bandButtonSx}>Riapri</Button>
  const files = t.drive_files_detail
  const link = `${window.location.origin}/tasks${buildQuery({ open: t.id })}`
  const assignee = t.assigned_to_name
    ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Avatar sx={{ width: 20, height: 20, fontSize: 9, fontWeight: 700, bgcolor: 'archie.field', color: 'primary.main' }}>{personInitials(t.assigned_to_name)}</Avatar>{t.assigned_to_name}</Box>
    : <Box component="span" sx={{ color: open ? 'warning.main' : 'text.secondary', fontWeight: 550 }}>Da assegnare</Box>

  return (
    <RecordModal open onClose={p.onClose} ariaLabel={`Task ${t.id}`} compact
      title={<><Box component="span" sx={{ ...mono, fontSize: 15, fontWeight: 500, opacity: 0.75 }}>T-{t.id}</Box>{v.title.trim() || t.title}</>}
      status={<>
        <BandChip>{STATUS_META[t.status].label}</BandChip>
        {!edit ? <BandChip><CampoIcon name="lock" size={11} />Sola lettura</BandChip> : null}
        {editing ? <BandEditing /> : null}
      </>}
      subtitle={<>Area <Box component="b" sx={{ fontWeight: 600 }}>{t.area_label}</Box> · creato{t.created_by_name ? ` da ${t.created_by_name}` : ''} il {ddmmyyyy(t.created_at)}</>}
      tags={<>
        {chip(<>priorità <b>{PRIO_LABEL[t.priority].toLowerCase()}</b></>, t.priority === 'critical')}
        {chip(t.assigned_to_name ? <>assegnato a <b>{t.assigned_to_name}</b></> : 'da assegnare', open && !t.assigned_to)}
        {t.due_date && open ? chip(late ? <>scaduto il <b>{ddmmyyyy(t.due_date)}</b></> : <>scade il <b>{ddmmyyyy(t.due_date)}</b></>, late || soon) : null}
        <BandStat n={p.comments.length} one=" commento" many=" commenti" onClick={() => scrollTo('att')} />
        <BandStat n={files.length} one=" allegato" many=" allegati" onClick={() => scrollTo('file')} />
      </>}
      position={p.position} onPrev={p.onPrev} onNext={p.onNext}
      actions={<>
        {primary}
        <Tooltip title="Altre azioni"><IconButton aria-label="Altre azioni" onClick={(e) => setMenu(e.currentTarget)} sx={{ color: 'rgb(255 255 255 / .85)', '&:hover': { bgcolor: 'rgb(255 255 255 / .14)' } }}><CampoIcon name="more" /></IconButton></Tooltip>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem disabled={!canAct || editing} onClick={() => { setMenu(null); setEditing(true) }}><ListItemIcon><CampoIcon name="columns" size={16} /></ListItemIcon>Modifica</MenuItem>
          <MenuItem disabled={!canAct} onClick={() => { setMenu(null); p.onEdit() }}><ListItemIcon><CampoIcon name="filter" size={16} /></ListItemIcon>Tutti i campi…</MenuItem>
          {t.status === 'in_corso' && canAct ? <MenuItem onClick={() => { setMenu(null); void p.onPatch({ status: 'in_attesa' }, 'Stato: In attesa') }}><ListItemIcon><CampoIcon name="clock" size={16} /></ListItemIcon>Metti in attesa</MenuItem> : null}
          {p.canLinkFiles && canAct ? <MenuItem onClick={() => { setMenu(null); p.onLinkFiles() }}><ListItemIcon><CampoIcon name="folder" size={16} /></ListItemIcon>Collega file da Drive</MenuItem> : null}
          {issueId ? <MenuItem onClick={() => { setMenu(null); p.onOpenIssue(issueId) }}><ListItemIcon><CampoIcon name="alert" size={16} /></ListItemIcon>Apri la issue #{issueId}</MenuItem>
            : p.canConvert && open ? <MenuItem onClick={() => { setMenu(null); p.onConvert() }}><ListItemIcon><CampoIcon name="alert" size={16} /></ListItemIcon>Trasforma in issue</MenuItem> : null}
          <MenuItem onClick={() => { setMenu(null); void copyToClipboard(link).then(() => toast.success('Link copiato')) }}><ListItemIcon><CampoIcon name="copy" size={16} /></ListItemIcon>Copia il link</MenuItem>
          <MenuItem disabled={!edit} onClick={() => { setMenu(null); p.onDelete() }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><CampoIcon name="trash" size={16} /></ListItemIcon>Elimina</MenuItem>
        </Menu>
      </>}
      editing={editing} dirtyCount={editing ? changed.length : 0} saving={busy} onSave={() => void save()} onDiscard={() => { reset(); setEditing(false) }}>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
        {/* ── Colonna principale ── */}
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          {issueId ? (
            <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '10px 12px', borderRadius: '10px', border: '1px solid', borderColor: 'info.main', bgcolor: 'info.light' }}>
              <Box sx={{ color: 'info.main', display: 'inline-flex', flex: 'none' }}><CampoIcon name="alert" size={16} /></Box>
              <Typography sx={{ fontSize: 13, flex: 1, minWidth: 0 }}>Trasformato nella <b>issue #{issueId}</b>{t.converted_to_issue_title ? <> · {t.converted_to_issue_title}</> : null}: il lavoro continua lì.</Typography>
              <Button size="small" variant="outlined" onClick={() => p.onOpenIssue(issueId)}>Apri la issue</Button>
            </Box>
          ) : null}

          <RecordSection title="Descrizione">
            {editing ? <RecordNotes value={draft.description} onChange={set('description')} dirty={isDirty('description')} placeholder="Il contesto per chi prende il task" ariaLabel="Descrizione" />
              : <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: t.description ? 'text.primary' : 'text.disabled' }}>{t.description || 'Nessuna descrizione.'}</Typography>}
          </RecordSection>

          <Box id="task-file" sx={{ scrollMarginTop: 16 }}>
            <RecordSection title={<>Allegati<Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{files.length}</Box></>}
              end={p.canLinkFiles && canAct ? <Button size="small" onClick={p.onLinkFiles}>+ Collega da Drive</Button> : undefined}>
              {files.length ? (
                <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                  {files.map((f) => {
                    const ext = (f.name.split('.').pop() || '').slice(0, 4).toUpperCase()
                    return (
                      <Box component="li" key={f.id} sx={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr) auto', gap: 1.25, alignItems: 'center', py: 1, '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
                        <Box sx={{ width: 32, height: 32, borderRadius: '7px', display: 'grid', placeItems: 'center', ...mono, fontSize: 9, fontWeight: 650, ...(ext === 'PDF' ? { bgcolor: 'error.light', color: 'error.main' } : { bgcolor: 'archie.neutralBg', color: 'text.secondary' }) }}>{ext || 'FILE'}</Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{f.name}</Typography>
                          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{formatBytes(f.size)} · in Drive</Typography>
                        </Box>
                        <Box sx={{ display: 'inline-flex' }}>
                          <Tooltip title="Scarica"><IconButton size="small" aria-label={`Scarica ${f.name}`} component="a" href={`/api/drive-files/${f.id}/download/`} target="_blank" rel="noopener"><CampoIcon name="download" size={15} /></IconButton></Tooltip>
                          {canAct ? (
                            <Tooltip title="Scollega dal task (il file resta in Drive)">
                              <span><IconButton size="small" aria-label={`Scollega ${f.name}`} disabled={p.unlinkingId !== null} onClick={() => p.onUnlinkFile(f.id)}>
                                {p.unlinkingId === f.id ? <CircularProgress size={14} /> : <CampoIcon name="x" size={15} />}
                              </IconButton></span>
                            </Tooltip>
                          ) : null}
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              ) : <RecordEmpty>Nessun file collegato.</RecordEmpty>}
              <Typography sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mt: 1, fontSize: 11, color: 'text.disabled' }}><CampoIcon name="folder" size={12} />I file restano nella loro cartella di Drive: il task ne tiene solo il collegamento.</Typography>
            </RecordSection>
          </Box>

          <Box id="task-att" sx={{ scrollMarginTop: 16 }}>
            <RecordSection title={<>Attività<Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 400, color: 'text.secondary' }}>{items.length}</Box></>}
              end={
                <Box role="group" aria-label="Filtra attività" sx={{ display: 'inline-flex', gap: '2px', p: '2px', borderRadius: '7px', bgcolor: 'archie.neutralBg' }}>
                  {([['all', 'Tutto', items.length], ['cm', 'Commenti', p.comments.length], ['ev', 'Modifiche', visible.length]] as const).map(([k, l, n]) => (
                    <ButtonBase key={k} aria-pressed={feed === k} onClick={() => setFeed(k)} sx={{
                      height: 24, px: 1, gap: 0.5, borderRadius: '5px', fontSize: 11.5, fontWeight: 550, color: feed === k ? 'text.primary' : 'text.secondary',
                      bgcolor: feed === k ? 'background.paper' : 'transparent', boxShadow: feed === k ? (th) => `0 1px 2px rgb(16 40 34 / .12), inset 0 0 0 1px ${th.palette.divider}` : 'none',
                    }}>{l} {n}</ButtonBase>
                  ))}
                </Box>
              }>
              {p.commentsLoading || events === null ? <RecordLoader /> : shownItems.length ? (
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  {shownItems.map((it) => it.kind === 'cm' ? (
                    <Box key={`c${it.c.id}`} sx={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 1, alignItems: 'start' }}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: 9, fontWeight: 700, bgcolor: 'archie.field', color: 'primary.main' }}>{personInitials(it.c.author_name)}</Avatar>
                      <Box sx={{ bgcolor: 'archie.surface2', border: '1px solid', borderColor: 'divider', borderRadius: '4px 10px 10px 10px', px: 1.25, py: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.25 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{it.c.author_name}</Typography>
                          <Typography sx={{ ml: 'auto', fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>{fmtTaskDateTime(it.c.created_at)}</Typography>
                        </Box>
                        <Typography sx={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{it.c.body}</Typography>
                      </Box>
                    </Box>
                  ) : (
                    <Box key={`e${it.e.id}`} sx={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 1, alignItems: 'center', fontSize: 12, color: 'text.secondary', '& b': { color: 'text.primary', fontWeight: 600 } }}>
                      <Box sx={{ display: 'grid', placeItems: 'center', color: 'text.disabled' }}><CampoIcon name="history" size={14} /></Box>
                      <span><b>{it.e.actor_username || 'Sistema'}</b> {describe(it.e)}</span>
                      <Box component="time" sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtTaskDateTime(it.e.created_at)}</Box>
                    </Box>
                  ))}
                </Box>
              ) : <RecordEmpty>{feed === 'ev' ? 'Nessuna modifica registrata.' : canAct ? 'Nessun commento. Scrivi il primo qui sotto.' : 'Nessun commento.'}</RecordEmpty>}
              {canAct ? (
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <InputBase multiline minRows={2} maxRows={6} value={p.newComment} onChange={(e) => p.onNewCommentChange(e.target.value)} disabled={p.sendingComment}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) p.onSendComment() }}
                    placeholder="Scrivi un commento… (Ctrl+Invio per inviare)" inputProps={{ 'aria-label': 'Scrivi un commento' }}
                    sx={{ flex: 1, px: 1.25, py: 0.75, fontSize: 13, bgcolor: 'background.paper', border: '1px solid', borderColor: 'archie.borderStrong', borderRadius: '8px', '&.Mui-focused': { borderColor: 'primary.main', boxShadow: (th) => th.palette.archie.focusRing } }} />
                  <Button variant="contained" onClick={p.onSendComment} disabled={!p.newComment.trim() || p.sendingComment}>
                    {p.sendingComment ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : 'Commenta'}
                  </Button>
                </Box>
              ) : null}
            </RecordSection>
          </Box>
        </Box>

        {/* ── Colonna laterale ── */}
        <Box component="aside" aria-label="Task" sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <RecordSection title="Dettagli">
            <RecordGrid>
              {editing ? <RecordField editing label="Titolo" value={draft.title} onChange={set('title')} dirty={isDirty('title')} wide /> : null}
              <QuickPick label="Stato" disabled={!canAct} value={<TaskStatusBadge status={t.status} />}
                options={STATUS_ORDER.map((s) => ({ value: s, label: <TaskStatusBadge status={s} />, selected: t.status === s }))}
                onPick={(val) => void p.onPatch({ status: val as TaskStatus }, `Stato: ${STATUS_META[val as TaskStatus].label}`)} />
              <QuickPick label="Priorità" disabled={!canAct} value={<IssuePriorityMark priority={t.priority} />}
                options={(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map((k) => ({ value: k, label: <IssuePriorityMark priority={k} />, selected: t.priority === k }))}
                onPick={(val) => void p.onPatch({ priority: val as TaskPriority }, 'Priorità aggiornata')} />
              <QuickPick label="Assegnato a" wide disabled={!canAct} value={assignee}
                options={[{ value: '', label: <Box component="span" sx={{ color: 'text.secondary' }}>Nessuno</Box>, selected: !t.assigned_to }, ...users.map((u) => ({ value: String(u.id), label: u.label, selected: t.assigned_to === u.id }))]}
                onPick={(val) => void p.onPatch({ assigned_to: val ? Number(val) : null }, 'Assegnatario aggiornato')}
                after={!t.assigned_to && canAct && open && p.meId != null ? <Button size="small" onClick={() => void p.onPatch({ assigned_to: p.meId }, 'Assegnato a te')} sx={{ minWidth: 0, px: 0.5 }}>Assegna a me</Button> : null} />
              <RecordField editing={editing} type="date" label="Scadenza" value={v.due_date} onChange={set('due_date')} dirty={isDirty('due_date')} show={(x) => ddmmyyyy(x)} />
              <RecordValue label="Area">{t.area_label}</RecordValue>
              <RecordValue label="Creato" wide>{ddmmyyyy(t.created_at)}{t.created_by_name ? ` · ${t.created_by_name}` : ''}</RecordValue>
            </RecordGrid>
          </RecordSection>

          <RecordSection title="Tempo"><TaskTimeline task={t} /></RecordSection>

          {open && p.canConvert ? (
            <ButtonBase onClick={p.onConvert} aria-label="Trasforma in issue: serve un intervento su un cliente" sx={{
              display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', gap: 1.25, alignItems: 'center', p: '12px 14px', borderRadius: '10px', border: '1px dashed', borderColor: 'archie.borderStrong',
              bgcolor: 'background.paper', textAlign: 'left', justifyContent: 'stretch', '&:hover': { bgcolor: 'archie.surface2', borderColor: 'primary.main' }, '&.Mui-focusVisible': { boxShadow: (th) => th.palette.archie.focusRing },
            }}>
              <Box sx={{ width: 28, height: 28, borderRadius: '7px', display: 'grid', placeItems: 'center', bgcolor: 'archie.field', color: 'primary.main' }}><CampoIcon name="alert" size={15} /></Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Serve un intervento su un cliente?</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.4 }}>Trasforma il task in issue: eredita titolo, priorità e commenti, il task si chiude.</Typography>
              </Box>
            </ButtonBase>
          ) : null}
        </Box>
      </Box>
    </RecordModal>
  )
}
