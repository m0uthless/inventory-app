import * as React from 'react'
import {
  Box, Breadcrumbs, Button, Checkbox, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Link, Stack, Typography,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { formatBytes, type TaskDriveFile } from './types'

type PickerFolder = { id: number; name: string }
type Crumb = { id: number; name: string }

type Props = {
  open: boolean
  excludeIds: number[]
  busy?: boolean
  onClose: () => void
  onConfirm: (files: TaskDriveFile[]) => void
}

function toFile(raw: Record<string, unknown>): TaskDriveFile {
  return {
    id: raw.id as number,
    name: raw.name as string,
    mime_type: (raw.mime_type as string) ?? '',
    size: (raw.size as number) ?? 0,
    folder: (raw.folder as number | null) ?? null,
  }
}

export default function DriveFilePickerDialog({ open, excludeIds, busy = false, onClose, onConfirm }: Props) {
  const toast = useToast()
  const [folderId, setFolderId] = React.useState<number | null>(null)
  const [crumbs, setCrumbs] = React.useState<Crumb[]>([])
  const [folders, setFolders] = React.useState<PickerFolder[]>([])
  const [files, setFiles] = React.useState<TaskDriveFile[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selected, setSelected] = React.useState<Map<number, TaskDriveFile>>(new Map())
  const requestId = React.useRef(0)

  // Reset alla chiusura: alla riapertura il primo render mostra lo spinner, non dati/selezione vecchi.
  React.useEffect(() => {
    if (!open) {
      requestId.current++
      setFolderId(null)
      setCrumbs([])
      setFolders([])
      setFiles([])
      setSelected(new Map())
      setLoading(true)
    }
  }, [open])

  React.useEffect(() => {
    if (!open) {
      requestId.current++
      return
    }
    const id = ++requestId.current
    setLoading(true)
    const load = async () => {
      try {
        if (folderId === null) {
          const [fRes, fileRes] = await Promise.all([
            api.get('/drive-folders/', { params: { root: 'true', page_size: 200 } }),
            api.get('/drive-files/', { params: { root: 'true', page_size: 200 } }),
          ])
          if (id !== requestId.current) return
          setFolders((fRes.data?.results ?? fRes.data ?? []) as PickerFolder[])
          setFiles(((fileRes.data?.results ?? fileRes.data ?? []) as Record<string, unknown>[]).map(toFile))
          setCrumbs([])
        } else {
          const res = await api.get(`/drive-folders/${folderId}/children/`)
          if (id !== requestId.current) return
          setFolders((res.data?.folders ?? []) as PickerFolder[])
          setFiles(((res.data?.files ?? []) as Record<string, unknown>[]).map(toFile))
          const bc = await api.get(`/drive-folders/${folderId}/breadcrumb/`)
          if (id !== requestId.current) return
          setCrumbs((bc.data ?? []) as Crumb[])
        }
      } catch (e) {
        if (id === requestId.current) toast.error(apiErrorToMessage(e))
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }
    void load()
  }, [open, folderId, toast])

  const toggle = (file: TaskDriveFile) => {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(file.id)) next.delete(file.id)
      else next.set(file.id, file)
      return next
    })
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Collega file da Drive</DialogTitle>
      <DialogContent dividers sx={{ minHeight: 320 }}>
        <Breadcrumbs sx={{ mb: 1.5, fontSize: '0.85rem' }}>
          <Link component="button" type="button" underline="hover" onClick={() => setFolderId(null)}>
            Drive
          </Link>
          {crumbs.map((c) => (
            <Link key={c.id} component="button" type="button" underline="hover" onClick={() => setFolderId(c.id)}>
              {c.name}
            </Link>
          ))}
        </Breadcrumbs>

        {loading ? (
          <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={24} /></Stack>
        ) : folders.length === 0 && files.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            Nessun file in questa cartella.
          </Typography>
        ) : (
          <Stack spacing={0.25}>
            {folders.map((f) => (
              <Box
                key={f.id}
                onClick={() => setFolderId(f.id)}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <FolderIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{f.name}</Typography>
              </Box>
            ))}
            {files.map((file) => {
              const already = excludeIds.includes(file.id)
              return (
                <Box key={file.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, opacity: already ? 0.5 : 1 }}>
                  <Checkbox
                    size="small"
                    disabled={already}
                    checked={selected.has(file.id)}
                    onChange={() => toggle(file)}
                    inputProps={{ 'aria-label': `Seleziona ${file.name}` }}
                  />
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{file.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {already ? 'Già collegato' : formatBytes(file.size)}
                  </Typography>
                </Box>
              )
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="text" onClick={onClose} disabled={busy}>Annulla</Button>
        <Button
          variant="contained"
          disabled={selected.size === 0 || busy}
          onClick={() => onConfirm([...selected.values()])}
        >
          {busy ? <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} /> : null}
          {selected.size > 0 ? `Collega (${selected.size})` : 'Collega'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
