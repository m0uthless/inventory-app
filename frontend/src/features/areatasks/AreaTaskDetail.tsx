import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { buildQuery } from '@shared/utils/nav'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { useAuth } from '../../auth/AuthProvider'
import { PERMS } from '../../auth/perms'
import { useUndoToast } from '../../ui/campo'
import AreaTaskDetailCard, { type AreaTaskPatch, type AreaTaskTab } from './AreaTaskDetailCard'
import AreaTaskDialog from './AreaTaskDialog'
import ConvertToIssueDialog from './ConvertToIssueDialog'
import DriveFilePickerDialog from './DriveFilePickerDialog'
import {
  createEmptyTaskForm, extractFieldErrors, formToPayload, taskToForm,
  type AreaTaskComment, type AreaTaskRow, type AreaUser, type TaskDriveFile, type TaskFormData,
} from './types'

type Props = {
  task: AreaTaskRow | null
  onClose: () => void
  onChanged: (task: AreaTaskRow) => void
  onDeleted: (id: number) => void
  /** Scheda iniziale al primo render per questo task (0 = Dettagli, 1 = Commenti). Default 0. */
  initialTab?: number
  /** Scorrimento nella lista della pagina (facoltativo). */
  position?: string
  onPrev?: () => void
  onNext?: () => void
}

const RENDERED_ERROR_KEYS = ['title', 'assigned_to', 'due_date', 'detail', 'non_field_errors']

// Messaggi 400 su campi che il dialog non mostra (status, priority, description, ...).
function hiddenFieldMessages(e: unknown): string {
  const data = (e as { response?: { data?: unknown } })?.response?.data
  if (!data || typeof data !== 'object') return ''
  return Object.entries(data as Record<string, unknown>)
    .filter(([k]) => !RENDERED_ERROR_KEYS.includes(k))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : String(v)}`)
    .join(' | ')
}

type RawUser = { id: number; full_name?: string; username?: string }
const TABS: AreaTaskTab[] = ['det', 'cm', 'all', 'att']

/**
 * Pannello del task di area con la sua logica (commenti, allegati Drive, modifica,
 * conversione in issue, eliminazione). Usato dalla pagina Task di area e dalla
 * card della Dashboard.
 */
export default function AreaTaskDetail({ task, onClose, onChanged, onDeleted, initialTab, position, onPrev, onNext }: Props) {
  const toast = useToast()
  const undoToast = useUndoToast()
  const navigate = useNavigate()
  const { me, hasPerm } = useAuth()

  const [current, setCurrentState] = React.useState<AreaTaskRow | null>(task)
  // Ultimo valore noto di `current`, sempre aggiornato in modo sincrono (evita closure obsolete nelle richieste async).
  const currentRef = React.useRef<AreaTaskRow | null>(task)
  const setCurrent = React.useCallback((next: AreaTaskRow | null) => {
    currentRef.current = next
    setCurrentState(next)
  }, [])
  const [tab, setTab] = React.useState<AreaTaskTab>('det')
  const [comments, setComments] = React.useState<AreaTaskComment[]>([])
  const [commentsLoading, setCommentsLoading] = React.useState(false)
  const [newComment, setNewComment] = React.useState('')
  const [sendingComment, setSendingComment] = React.useState(false)
  const [users, setUsers] = React.useState<AreaUser[]>([])

  const [editOpen, setEditOpen] = React.useState(false)
  const [form, setForm] = React.useState<TaskFormData>(createEmptyTaskForm)
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [linking, setLinking] = React.useState(false)
  const [unlinkingId, setUnlinkingId] = React.useState<number | null>(null)

  const [convertOpen, setConvertOpen] = React.useState(false)

  // Riparte da zero quando cambia il task mostrato.
  React.useEffect(() => {
    if (!task) { setCommentsLoading(false); return }
    setCurrent(task)
    setTab(TABS[initialTab ?? 0] ?? 'det')
    setComments([])
    setNewComment('')
    setEditOpen(false)
    setPickerOpen(false)
    setConvertOpen(false)
    let alive = true
    setCommentsLoading(true)
    api.get<AreaTaskComment[]>(`/area-tasks/${task.id}/comments/`)
      .then((r) => { if (alive) setComments(Array.isArray(r.data) ? r.data : []) })
      .catch((e) => { if (alive) toast.error(apiErrorToMessage(e)) })
      .finally(() => { if (alive) setCommentsLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  // Il task può cambiare da fuori (lista ricaricata): allinea senza perdere lo stato del pannello.
  React.useEffect(() => { if (task && task.id === currentRef.current?.id) setCurrent(task) }, [task, setCurrent])

  // Persone dell'area del task (assegnatario nelle Proprietà e nel dialogo).
  const areaId = task?.area ?? null
  React.useEffect(() => {
    if (areaId == null) return
    let alive = true
    api.get<RawUser[]>('/users/', { params: { leave_area: areaId, page_size: 200 } })
      .then((r) => { if (alive) setUsers((Array.isArray(r.data) ? r.data : []).map((u) => ({ id: u.id, label: u.full_name || u.username || String(u.id) }))) })
      .catch(() => { if (alive) setUsers([]) })
    return () => { alive = false }
  }, [areaId])

  const apply = React.useCallback((next: AreaTaskRow) => {
    setCurrent(next)
    onChanged(next)
  }, [onChanged, setCurrent])

  // ── Modifica sul posto, con annulla ─────────────────────────────────────────
  const patch = async (p: AreaTaskPatch, label: string) => {
    const cur = currentRef.current
    if (!cur) return
    const prev: Record<string, unknown> = {}
    for (const k of Object.keys(p)) prev[k] = (cur as Record<string, unknown>)[k] ?? null
    try {
      const r = await api.patch<AreaTaskRow>(`/area-tasks/${cur.id}/`, p)
      apply(r.data)
      undoToast.show(`${label} · salvato`, async () => {
        try {
          const back = await api.patch<AreaTaskRow>(`/area-tasks/${cur.id}/`, prev)
          apply(back.data)
        } catch (e) { toast.error(apiErrorToMessage(e)) }
      })
    } catch (e) {
      const fields = extractFieldErrors(e)
      toast.error(Object.values(fields)[0] || apiErrorToMessage(e))
    }
  }

  // ── Commenti ────────────────────────────────────────────────────────────────
  const sendComment = async () => {
    const body = newComment.trim()
    if (!current || !body || sendingComment) return
    setSendingComment(true)
    try {
      const r = await api.post<AreaTaskComment>(`/area-tasks/${current.id}/comments/`, { body })
      setComments((prev) => [...prev, r.data])
      setNewComment('')
      const latest = currentRef.current
      if (latest && latest.id === current.id) apply({ ...latest, comments_count: latest.comments_count + 1 })
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSendingComment(false)
    }
  }

  // ── Modifica completa ───────────────────────────────────────────────────────
  const openEdit = () => {
    if (!current) return
    setForm(taskToForm(current))
    setErrors({})
    setEditOpen(true)
  }

  const save = async () => {
    if (!current || saving) return
    setSaving(true)
    setErrors({})
    try {
      const r = await api.patch<AreaTaskRow>(`/area-tasks/${current.id}/`, formToPayload(form))
      apply(r.data)
      setEditOpen(false)
    } catch (e) {
      const fields = extractFieldErrors(e)
      if (Object.keys(fields).length > 0) {
        setErrors(fields)
        const hidden = hiddenFieldMessages(e)
        if (hidden) toast.error(hidden)
      } else toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // ── Eliminazione ────────────────────────────────────────────────────────────
  const remove = async () => {
    if (!current || deleting) return
    setDeleting(true)
    try {
      await api.delete(`/area-tasks/${current.id}/`)
      const id = current.id
      setConfirmDelete(false)
      onDeleted(id)
      onClose()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  // ── Allegati Drive ──────────────────────────────────────────────────────────
  const visibleIds = (t: AreaTaskRow) => t.drive_files_detail.map((f) => f.id)

  const linkFiles = async (files: TaskDriveFile[]) => {
    if (!current || linking) return
    setLinking(true)
    try {
      const ids = [...visibleIds(current), ...files.map((f) => f.id)]
      const r = await api.patch<AreaTaskRow>(`/area-tasks/${current.id}/`, { drive_files: ids })
      apply(r.data)
      setPickerOpen(false)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setLinking(false)
    }
  }

  const unlinkFile = async (fileId: number) => {
    if (!current || unlinkingId !== null) return
    setUnlinkingId(fileId)
    try {
      const ids = visibleIds(current).filter((id) => id !== fileId)
      const r = await api.patch<AreaTaskRow>(`/area-tasks/${current.id}/`, { drive_files: ids })
      apply(r.data)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setUnlinkingId(null)
    }
  }

  // ── Trasforma in issue ──────────────────────────────────────────────────────
  const handleConverted = (result: { task: AreaTaskRow; issue: { id: number; title: string } }) => {
    apply(result.task)
    setTab('det')
    toast.success(`Task trasformato nella issue #${result.issue.id}.`)
  }

  const canConvert = Boolean(current?.can_edit) && !current?.converted_to_issue && hasPerm(PERMS.issues.issue.add)

  return (
    <>
      {task && current ? (
        <AreaTaskDetailCard
          task={current}
          meId={typeof me?.id === 'number' ? me.id : null}
          users={users}
          tab={tab}
          onTab={setTab}
          comments={comments}
          commentsLoading={commentsLoading}
          newComment={newComment}
          sendingComment={sendingComment}
          onNewCommentChange={setNewComment}
          onSendComment={() => { void sendComment() }}
          canLinkFiles={Boolean(current.can_edit) && hasPerm('drive.view_drivefile')}
          unlinkingId={unlinkingId}
          onLinkFiles={() => setPickerOpen(true)}
          onUnlinkFile={(id) => { void unlinkFile(id) }}
          canConvert={canConvert}
          onConvert={() => setConvertOpen(true)}
          onOpenIssue={(id) => navigate(`/issues${buildQuery({ open: id })}`)}
          onPatch={(p, label) => { void patch(p, label) }}
          onEdit={openEdit}
          onDelete={() => setConfirmDelete(true)}
          onClose={onClose}
          position={position}
          onPrev={onPrev}
          onNext={onNext}
        />
      ) : null}
      <ConvertToIssueDialog
        open={convertOpen}
        task={current}
        onClose={() => setConvertOpen(false)}
        onConverted={handleConverted}
      />
      <AreaTaskDialog
        open={editOpen}
        task={current}
        areaLabel={current?.area_label ?? ''}
        form={form}
        users={current?.assigned_to != null && !users.some((u) => u.id === current.assigned_to)
          ? [{ id: current.assigned_to, label: current.assigned_to_name ?? String(current.assigned_to) }, ...users] : users}
        saving={saving}
        errors={errors}
        onFormChange={setForm}
        onSave={() => { void save() }}
        onClose={() => setEditOpen(false)}
      />
      <DriveFilePickerDialog
        open={pickerOpen}
        excludeIds={current ? visibleIds(current) : []}
        busy={linking}
        onClose={() => setPickerOpen(false)}
        onConfirm={(files) => { void linkFiles(files) }}
      />
      <ConfirmDeleteDialog
        open={confirmDelete}
        busy={deleting}
        title="Eliminare il task?"
        description={`Il task «${current?.title ?? ''}» verrà spostato nel cestino.`}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { void remove() }}
      />
    </>
  )
}
