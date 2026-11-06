import * as React from 'react'
import { Avatar, Box, Button, ButtonBase, CircularProgress, IconButton, InputBase, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CheckIcon from '@mui/icons-material/Check'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import { CampoIcon, DetailSection, FloatingDetail, LinkButton, Properties } from '../../ui/campo'
import { Empty, Loading } from '../../ui/campo/ListRows'
import { AuditFeedPanel } from '../customers/CustomerTabs'
import { IssuePriorityMark } from '../issues/IssueBadges'
import { TaskStatusBadge, daysTo, ddmmyyyy, isOpenTask } from './taskUi'
import {
  STATUS_META, STATUS_ORDER, fmtTaskDateTime, formatBytes, personInitials,
  type AreaTaskComment, type AreaTaskRow, type AreaUser, type TaskPriority, type TaskStatus,
} from './types'

export type AreaTaskTab = 'det' | 'cm' | 'all' | 'att'
export type AreaTaskPatch = Partial<Pick<AreaTaskRow, 'status' | 'priority' | 'assigned_to' | 'due_date' | 'description'>>

type Props = {
  task: AreaTaskRow
  meId: number | null
  users: AreaUser[]
  tab: AreaTaskTab
  onTab: (t: AreaTaskTab) => void
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
  onPatch: (patch: AreaTaskPatch, label: string) => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
  position?: string
  onPrev?: () => void
  onNext?: () => void
}

const DAY = 864e5
const dur = (ms: number) => { const g = Math.floor(Math.abs(ms) / DAY); return `${g} ${g === 1 ? 'giorno' : 'giorni'}` }
const none = (t: string) => <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>{t}</Box>
const ava = (name?: string | null) => (
  <Avatar sx={{ width: 18, height: 18, fontSize: 8, fontWeight: 700, bgcolor: 'archie.field', color: 'primary.main' }}>{personInitials(name)}</Avatar>
)

/** Da quanto è aperto e quanto manca alla scadenza (come nel pannello Issue). */
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

function CommentBubble({ c }: { c: AreaTaskComment }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 1, alignItems: 'start' }}>
      <Avatar sx={{ width: 24, height: 24, fontSize: 9, fontWeight: 700, bgcolor: 'archie.field', color: 'primary.main' }}>{personInitials(c.author_name)}</Avatar>
      <Box sx={{ bgcolor: 'archie.surface2', border: '1px solid', borderColor: 'divider', borderRadius: '4px 10px 10px 10px', px: 1.25, py: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.25 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{c.author_name}</Typography>
          <Typography sx={{ ml: 'auto', fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>{fmtTaskDateTime(c.created_at)}</Typography>
        </Box>
        <Typography sx={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</Typography>
      </Box>
    </Box>
  )
}

function Description({ task, onSave }: { task: AreaTaskRow; onSave: (v: string) => void }) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(task.description)
  React.useEffect(() => { setEditing(false); setDraft(task.description) }, [task.id, task.description])
  return (
    <DetailSection title="Descrizione" end={task.can_edit && !editing ? <LinkButton onClick={() => setEditing(true)}>{task.description ? 'Modifica' : 'Aggiungi'}</LinkButton> : undefined}>
      {editing ? (
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          <InputBase autoFocus multiline minRows={3} maxRows={10} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); setDraft(task.description) } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { setEditing(false); onSave(draft.trim()) } }}
            inputProps={{ 'aria-label': 'Descrizione' }}
            sx={{ px: 1.25, py: 1, fontSize: 13, lineHeight: 1.5, border: '1px solid', borderColor: 'primary.main', borderRadius: '8px', boxShadow: (t) => t.palette.archie.focusRing }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
            <Button size="small" onClick={() => { setEditing(false); setDraft(task.description) }}>Annulla</Button>
            <Button size="small" variant="contained" onClick={() => { setEditing(false); if (draft.trim() !== task.description) onSave(draft.trim()) }}>Salva</Button>
          </Box>
        </Box>
      ) : (
        <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: task.description ? 'text.primary' : 'text.disabled' }}>
          {task.description || (task.can_edit ? 'Nessuna descrizione. Aggiungi il contesto per chi prende il task.' : 'Nessuna descrizione.')}
        </Typography>
      )}
    </DetailSection>
  )
}

/** Pannello del task di area (anteprima t-base), nello stile del pannello Issue. */
export default function AreaTaskDetailCard(p: Props) {
  const t = p.task
  const edit = t.can_edit
  const open = isOpenTask(t)
  const issueId = t.converted_to_issue
  const users = t.assigned_to != null && !p.users.some((u) => u.id === t.assigned_to)
    ? [{ id: t.assigned_to, label: t.assigned_to_name ?? String(t.assigned_to) }, ...p.users] : p.users

  const props = [
    {
      key: 'status', label: 'Stato', disabled: !edit, current: t.status,
      options: STATUS_ORDER.map((s) => ({ value: s, label: <TaskStatusBadge status={s} /> })),
      display: <TaskStatusBadge status={t.status} />,
      onChange: (v: string) => p.onPatch({ status: v as TaskStatus }, `Stato: ${STATUS_META[v as TaskStatus].label}`),
    },
    {
      key: 'priority', label: 'Priorità', disabled: !edit, current: t.priority,
      options: (['critical', 'high', 'medium', 'low'] as TaskPriority[]).map((k) => ({ value: k, label: <IssuePriorityMark priority={k} /> })),
      display: <IssuePriorityMark priority={t.priority} />,
      onChange: (v: string) => p.onPatch({ priority: v as TaskPriority }, 'Priorità aggiornata'),
    },
    {
      key: 'assigned', label: 'Assegnato a', disabled: !edit, current: t.assigned_to ? String(t.assigned_to) : '',
      options: [{ value: '', label: <Box component="span" sx={{ color: 'text.secondary' }}>Nessuno</Box> }, ...users.map((u) => ({ value: String(u.id), label: u.label }))],
      display: t.assigned_to_name ? <>{ava(t.assigned_to_name)}{t.assigned_to_name}</> : none('Nessuno'),
      onChange: (v: string) => p.onPatch({ assigned_to: v ? Number(v) : null }, 'Assegnatario aggiornato'),
    },
    {
      key: 'due', label: 'Scadenza', disabled: !edit,
      text: { value: t.due_date ?? '', type: 'date' as const },
      display: t.due_date ? ddmmyyyy(t.due_date) : none('Nessuna'),
      onChange: (v: string) => p.onPatch({ due_date: v || null }, 'Scadenza aggiornata'),
    },
    { key: 'area', label: 'Area', disabled: true, display: t.area_label },
    { key: 'created', label: 'Creato', disabled: true, full: true, display: <>{ddmmyyyy(t.created_at)}{t.created_by_name ? ` · ${t.created_by_name}` : ''}</> },
  ]

  const last = p.comments.length ? p.comments[p.comments.length - 1] : null
  const details = (
    <>
      {issueId ? (
        <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '9px 12px', borderRadius: '8px', border: '1px solid', borderColor: 'info.main', bgcolor: 'info.light' }}>
          <Box sx={{ color: 'info.main', display: 'inline-flex', flex: 'none' }}><CampoIcon name="alert" size={16} /></Box>
          <Typography sx={{ fontSize: 13, flex: 1, minWidth: 0 }}>
            Trasformato nella <b>issue #{issueId}</b>{t.converted_to_issue_title ? <> · {t.converted_to_issue_title}</> : null}: il lavoro continua lì.
          </Typography>
          <LinkButton onClick={() => p.onOpenIssue(issueId)}>Apri</LinkButton>
        </Box>
      ) : null}

      <Properties
        storageKey="areatask-props-open"
        props={props}
        summary={<><IssuePriorityMark priority={t.priority} /><Box component="span" sx={{ color: t.assigned_to_name ? 'text.primary' : 'warning.main', fontWeight: 500 }}>{t.assigned_to_name || 'Da assegnare'}</Box></>}
      />
      <TaskTimeline task={t} />
      <Description task={t} onSave={(v) => p.onPatch({ description: v }, 'Descrizione aggiornata')} />

      {open && p.canConvert ? (
        <ButtonBase onClick={p.onConvert} sx={{
          display: 'flex', alignItems: 'center', gap: 1.25, p: '10px 12px', borderRadius: '8px', border: '1px dashed', borderColor: 'archie.borderStrong',
          justifyContent: 'flex-start', textAlign: 'left', '&:hover': { bgcolor: 'archie.surface2', borderColor: 'primary.main' },
          '&.Mui-focusVisible': { boxShadow: (th) => th.palette.archie.focusRing },
        }}>
          <Box sx={{ width: 28, height: 28, flex: 'none', borderRadius: '7px', display: 'grid', placeItems: 'center', bgcolor: 'archie.field', color: 'primary.main' }}><CampoIcon name="alert" size={15} /></Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Trasforma in issue</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Se serve un intervento su un cliente: la issue eredita titolo, priorità e commenti, il task si chiude.</Typography>
          </Box>
        </ButtonBase>
      ) : null}

      <DetailSection title="Ultimo commento" end={p.comments.length ? <LinkButton onClick={() => p.onTab('cm')}>Tutti i commenti ({p.comments.length})</LinkButton> : undefined}>
        {p.commentsLoading ? <Loading /> : last ? <CommentBubble c={last} /> : (
          <ButtonBase disabled={!edit} onClick={() => p.onTab('cm')} sx={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 1, p: 1.5, justifyContent: 'flex-start', borderRadius: '8px',
            border: '1px dashed', borderColor: 'archie.borderStrong', fontSize: 13, color: 'text.secondary', '&:hover': { bgcolor: 'archie.surface2', color: 'text.primary' },
          }}>
            <CampoIcon name="chat" size={15} />{edit ? 'Scrivi il primo commento' : 'Nessun commento'}
          </ButtonBase>
        )}
      </DetailSection>
    </>
  )

  const comments = p.commentsLoading ? <Loading /> : p.comments.length ? (
    <Box sx={{ display: 'grid', gap: 1.5 }}>{p.comments.map((c) => <CommentBubble key={c.id} c={c} />)}</Box>
  ) : (
    <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
      <Box sx={{ color: 'text.disabled', display: 'inline-flex', mb: 1 }}><CampoIcon name="chat" size={26} /></Box>
      <Typography sx={{ fontSize: 13 }}>{edit ? 'Nessun commento. Scrivi il primo qui sotto.' : 'Nessun commento.'}</Typography>
    </Box>
  )

  const files = t.drive_files_detail
  const attachments = (
    <>
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', p: '10px 12px', borderRadius: '8px', bgcolor: 'archie.surface2', fontSize: 12, color: 'text.secondary', lineHeight: 1.45 }}>
        <Box sx={{ color: 'primary.main', display: 'inline-flex', flex: 'none', mt: '1px' }}><CampoIcon name="folder" size={16} /></Box>
        <span><Box component="b" sx={{ display: 'block', color: 'text.primary', fontSize: 13, fontWeight: 600 }}>Allegati da Drive</Box>I file restano nella loro cartella di Drive: il task ne tiene solo il collegamento.</span>
      </Box>
      {files.length ? (
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', borderTop: '1px solid', borderColor: 'divider' }}>
          {files.map((f) => {
            const ext = (f.name.split('.').pop() || '').slice(0, 4).toUpperCase()
            return (
              <Box component="li" key={f.id} sx={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr) auto', gap: 1.25, alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '7px', display: 'grid', placeItems: 'center', fontFamily: '"Geist Mono", monospace', fontSize: 9, fontWeight: 650, ...(ext === 'PDF' ? { bgcolor: 'error.light', color: 'error.main' } : { bgcolor: 'archie.neutralBg', color: 'text.secondary' }) }}>{ext || 'FILE'}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{f.name}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{formatBytes(f.size)}</Typography>
                </Box>
                <Box sx={{ display: 'inline-flex' }}>
                  <Tooltip title="Scarica"><IconButton size="small" aria-label={`Scarica ${f.name}`} component="a" href={`/api/drive-files/${f.id}/download/`} target="_blank" rel="noopener"><CampoIcon name="download" size={15} /></IconButton></Tooltip>
                  {edit ? (
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
      ) : <Empty text="Nessun file collegato." />}
    </>
  )

  const assignedToMe = p.meId != null && t.assigned_to === p.meId
  const footer = !edit ? (
    <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: 'text.secondary', ml: 'auto' }}><CampoIcon name="lock" size={13} />Sola lettura · area {t.area_label}</Typography>
  ) : p.tab === 'det' ? (
    <>
      {open && !assignedToMe && p.meId != null ? <Button variant="outlined" startIcon={<PersonOutlineIcon />} onClick={() => p.onPatch({ assigned_to: p.meId }, 'Assegnato a te')}>Assegna a me</Button> : null}
      {t.status === 'in_corso' ? <Button variant="outlined" startIcon={<CampoIcon name="clock" />} onClick={() => p.onPatch({ status: 'in_attesa' }, 'Stato: In attesa')}>Metti in attesa</Button> : null}
      <Box sx={{ flex: 1 }} />
      {t.status === 'da_fare' ? <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => p.onPatch({ status: 'in_corso' }, 'Stato: In corso')}>Inizia</Button>
        : t.status === 'in_corso' ? <Button variant="contained" startIcon={<CheckIcon />} onClick={() => p.onPatch({ status: 'completato' }, 'Task completato')}>Completa</Button>
        : t.status === 'in_attesa' ? <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => p.onPatch({ status: 'in_corso' }, 'Stato: In corso')}>Riprendi</Button>
        : issueId ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Chiuso diventando la issue #{issueId}</Typography>
        : <Button variant="outlined" onClick={() => p.onPatch({ status: 'in_corso' }, 'Task riaperto')}>Riapri</Button>}
    </>
  ) : p.tab === 'cm' ? (
    <Box sx={{ display: 'grid', gap: 0.5, width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <InputBase multiline maxRows={4} value={p.newComment} onChange={(e) => p.onNewCommentChange(e.target.value)} disabled={p.sendingComment}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) p.onSendComment() }}
          placeholder="Scrivi un commento… (Ctrl+Invio per inviare)" inputProps={{ 'aria-label': 'Scrivi un commento' }}
          sx={{ flex: 1, minHeight: 34, px: 1.25, py: 0.75, fontSize: 13, bgcolor: 'background.paper', border: '1px solid', borderColor: 'archie.borderStrong', borderRadius: '8px', '&.Mui-focused': { borderColor: 'primary.main', boxShadow: (th) => th.palette.archie.focusRing } }} />
        <Button variant="contained" onClick={p.onSendComment} disabled={!p.newComment.trim() || p.sendingComment}>
          {p.sendingComment ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : 'Commenta'}
        </Button>
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
        {t.assigned_to && !assignedToMe ? `${t.assigned_to_name} riceverà un'email` : 'Nessuna email: il task è tuo o non è assegnato'}
      </Typography>
    </Box>
  ) : p.tab === 'all' ? (
    <>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Solo file già presenti in Drive.</Typography>
      <Box sx={{ flex: 1 }} />
      {p.canLinkFiles ? <Button variant="contained" startIcon={<CampoIcon name="folder" />} onClick={p.onLinkFiles}>Collega da Drive</Button> : null}
    </>
  ) : undefined

  const late = open && t.due_date && daysTo(t.due_date) < 0
  return (
    <FloatingDetail
      open
      onClose={p.onClose}
      ariaLabel="Dettaglio task"
      idLabel={`Task #${t.id}`}
      status={<TaskStatusBadge status={t.status} onDark />}
      title={t.title}
      subtitle={<>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 20, px: 0.875, borderRadius: '5px', fontSize: 11, fontWeight: 600, border: '1px solid rgb(255 255 255 / .3)' }}>{t.area_label}</Box>
        <span>creato da {t.created_by_name || '—'} il {ddmmyyyy(t.created_at)}</span>
        {!edit ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>· <CampoIcon name="lock" size={12} />sola lettura</Box> : null}
        {late ? <span>· scaduto</span> : null}
      </>}
      tabs={[
        { key: 'det', label: 'Dettagli' },
        { key: 'cm', label: 'Commenti', count: p.commentsLoading ? null : p.comments.length },
        { key: 'all', label: 'Allegati', count: files.length },
        { key: 'att', label: 'Attività' },
      ]}
      tab={p.tab}
      onTab={(k) => p.onTab(k as AreaTaskTab)}
      position={p.position}
      onPrev={p.onPrev}
      onNext={p.onNext}
      menu={[
        { label: 'Modifica tutti i campi', icon: <EditIcon />, onClick: p.onEdit, disabled: !edit },
        ...(issueId ? [{ label: `Apri la issue #${issueId}`, icon: <CampoIcon name="alert" />, onClick: () => p.onOpenIssue(issueId) }]
          : p.canConvert ? [{ label: 'Trasforma in issue', icon: <CampoIcon name="alert" />, onClick: p.onConvert }] : []),
        { label: 'Elimina', icon: <DeleteOutlineIcon />, onClick: p.onDelete, danger: true, disabled: !edit },
      ]}
      footer={footer}
    >
      {p.tab === 'det' ? details
        : p.tab === 'cm' ? comments
        : p.tab === 'all' ? attachments
        : <AuditFeedPanel appLabel="core" model="areatask" objectId={t.id} noun="il task"
            fields={{ title: 'il titolo', description: 'la descrizione', status: 'lo stato', priority: 'la priorità', due_date: 'la scadenza', assigned_to: "l'assegnatario", drive_files: 'gli allegati', converted_to_issue: 'la issue collegata' }} />}
    </FloatingDetail>
  )
}

