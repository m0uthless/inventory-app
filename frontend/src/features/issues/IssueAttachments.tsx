import * as React from 'react'
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'

import { CampoDialog, CampoIcon } from '../../ui/campo'
import { FileIcon } from '../drive/DriveIcons'
import { kindOf } from '../drive/driveModel'

export type IssueAttachment = {
  id: number; name: string; size: number; mime_type: string; from_task: boolean; url: string
  uploaded_by_name: string | null; created_at: string
}

/** Dimensione leggibile: «2 KB», «1,4 MB». */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/**
 * Allegati della issue (spec 2026-11-20): elenco, «Allega file» o trascinamento, togli con conferma.
 * Quelli ereditati da un task di area sono file del Drive («[Task] …») e si aprono dal Drive.
 */
export default function IssueAttachments({ issueId, canEdit, onChanged, onCount }: { issueId: number; canEdit: boolean; onChanged?: () => void; onCount?: (n: number) => void }) {
  const toast = useToast()
  const [rows, setRows] = React.useState<IssueAttachment[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [over, setOver] = React.useState(false)
  const [toDelete, setToDelete] = React.useState<IssueAttachment | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(() => {
    api.get<IssueAttachment[]>(`/issues/${issueId}/attachments/`).then((r) => { setRows(r.data); onCount?.(r.data.length) }).catch(() => setRows([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId])
  React.useEffect(() => { setRows(null); load() }, [load])

  const upload = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? [])
    if (!list.length || busy) return
    const body = new FormData()
    list.forEach((f) => body.append('file', f))
    setBusy(true)
    try {
      await api.post(`/issues/${issueId}/attachments/`, body)
      toast.success(list.length === 1 ? 'File allegato' : `${list.length} file allegati`)
      load(); onChanged?.()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }
  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    try {
      await api.delete(`/issues/${issueId}/attachments/${toDelete.id}/`)
      toast.success('Allegato tolto'); setToDelete(null); load(); onChanged?.()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }

  const ext = (name: string) => (name.includes('.') ? name.split('.').pop()!.toUpperCase().slice(0, 4) : '')
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      {rows === null ? <CircularProgress size={18} /> : rows.length ? (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
          {rows.map((a) => (
            <Box component="li" key={a.id} sx={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', gap: 1.25, alignItems: 'center', py: 0.75, '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
              <FileIcon kind={kindOf(a.name, a.mime_type)} ext={ext(a.name)} size={28} />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{a.name}</Typography>
                <Typography noWrap sx={{ fontSize: 11.5, color: 'text.secondary' }}>{fmtBytes(a.size)} · {a.from_task ? 'dal task di area' : a.uploaded_by_name ?? '—'}</Typography>
              </Box>
              <Box sx={{ display: 'inline-flex' }}>
                <Tooltip title="Apri"><IconButton size="small" component="a" href={a.url} target="_blank" rel="noopener" aria-label={`Apri ${a.name}`}><CampoIcon name="eye" size={15} /></IconButton></Tooltip>
                {canEdit ? <Tooltip title="Togli"><IconButton size="small" aria-label={`Togli ${a.name}`} onClick={() => setToDelete(a)}><CampoIcon name="trash" size={15} /></IconButton></Tooltip> : null}
              </Box>
            </Box>
          ))}
        </Box>
      ) : <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Nessun allegato.</Typography>}

      {canEdit ? (
        <Box data-testid="attach-drop"
          onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void upload(e.dataTransfer?.files ?? null) }}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '10px 12px', borderRadius: '8px', border: '1px dashed', borderColor: over ? 'primary.main' : 'archie.borderStrong', bgcolor: over ? 'archie.field' : 'transparent' }}>
          {busy ? <CircularProgress size={16} /> : <CampoIcon name="upload" size={18} />}
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', flex: 1 }}>Trascina qui screenshot, log o documenti (fino a 25 MB)</Typography>
          <Button size="small" variant="outlined" component="label" disabled={busy}>
            Allega file
            <input ref={inputRef} hidden type="file" multiple aria-label="Allega file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.log,.csv,.zip,.docx,.xlsx" onChange={(e) => void upload(e.target.files)} />
          </Button>
        </Box>
      ) : null}

      <CampoDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} title="Togliere l'allegato?" width={420} busy={busy} labelId="issue-att-del-title"
        sub={toDelete?.from_task ? 'Il file resta nel Drive: si toglie solo dalla issue.' : 'Il file viene cancellato.'}
        footer={<><Button onClick={() => setToDelete(null)} disabled={busy}>Annulla</Button><Button variant="contained" color="error" onClick={() => void remove()} disabled={busy}>Togli</Button></>}>
        <Typography sx={{ fontSize: 13 }}>{toDelete?.name}</Typography>
      </CampoDialog>
    </Box>
  )
}
