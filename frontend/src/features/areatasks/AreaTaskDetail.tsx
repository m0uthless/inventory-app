import * as React from 'react'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { useAuth } from '../../auth/AuthProvider'
import AreaTaskDrawer from './AreaTaskDrawer'
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
  /** Tab iniziale da mostrare al primo render per questo task (0 = Dettagli, 1 = Commenti). Default 0. */
  initialTab?: number
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

export default function AreaTaskDetail({ task, onClose, onChanged, onDeleted, initialTab }: Props) {
  const toast = useToast()
  const { hasPerm } = useAuth()

  const [current, setCurrentState] = React.useState<AreaTaskRow | null>(task)
  // Ultimo valore noto di `current`, sempre aggiornato in modo sincrono (evita closure obsolete nelle richieste async).
  const currentRef = React.useRef<AreaTaskRow | null>(task)
  const setCurrent = React.useCallback((next: AreaTaskRow | null) => {
    currentRef.current = next
    setCurrentState(next)
  }, [])
  const [tab, setTab] = React.useState(0)
  const [comments, setComments] = React.useState<AreaTaskComment[]>([])
  const [commentsLoading, setCommentsLoading] = React.useState(false)
  const [newComment, setNewComment] = React.useState('')
  const [sendingComment, setSendingComment] = React.useState(false)

  const [editOpen, setEditOpen] = React.useState(false)
  const [form, setForm] = React.useState<TaskFormData>(createEmptyTaskForm)
  const [users, setUsers] = React.useState<AreaUser[]>([])
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
    // Con task nullo il drawer sta scorrendo fuori: non svuotare nulla, il cleanup
    // dell'effect precedente ha gia' invalidato la richiesta commenti in corso.
    if (!task) { setCommentsLoading(false); return }
    setCurrent(task)
    setTab(initialTab ?? 0)
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

  const apply = React.useCallback((next: AreaTaskRow) => {
    setCurrent(next)
    onChanged(next)
  }, [onChanged, setCurrent])

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

  // ── Modifica ────────────────────────────────────────────────────────────────
  const openEdit = async () => {
    if (!current) return
    setForm(taskToForm(current))
    setErrors({})
    setEditOpen(true)
    try {
      const r = await api.get<RawUser[]>('/users/', { params: { leave_area: current.area, page_size: 200 } })
      const list = Array.isArray(r.data) ? r.data : []
      setUsers(list.map((u) => ({ id: u.id, label: u.full_name || u.username || String(u.id) })))
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
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
    toast.success(`Task trasformato in issue #${result.issue.id}.`)
  }

  // Il dialog ha sempre l'assegnatario corrente tra le opzioni, anche se la lista utenti non e' ancora arrivata.
  const dialogUsers = React.useMemo<AreaUser[]>(() => {
    if (current?.assigned_to != null && !users.some((u) => u.id === current.assigned_to)) {
      return [{ id: current.assigned_to, label: current.assigned_to_name ?? String(current.assigned_to) }, ...users]
    }
    return users
  }, [users, current?.assigned_to, current?.assigned_to_name])

  return (
    <>
      <AreaTaskDrawer
        open={Boolean(task)}
        task={current}
        tab={tab}
        comments={comments}
        commentsLoading={commentsLoading}
        newComment={newComment}
        sendingComment={sendingComment}
        canLinkFiles={hasPerm('drive.view_drivefile')}
        unlinkingId={unlinkingId}
        onClose={onClose}
        onEdit={() => { void openEdit() }}
        onDelete={() => setConfirmDelete(true)}
        onTabChange={setTab}
        onNewCommentChange={setNewComment}
        onSendComment={() => { void sendComment() }}
        onLinkFiles={() => setPickerOpen(true)}
        onUnlinkFile={(id) => { void unlinkFile(id) }}
        onConvert={() => setConvertOpen(true)}
      />
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
        users={dialogUsers}
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
