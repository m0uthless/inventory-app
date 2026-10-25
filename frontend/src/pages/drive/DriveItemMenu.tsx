import { Menu, MenuItem } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined'
import FolderIcon from '@mui/icons-material/Folder'

// ─── Drive Item Menu ──────────────────────────────────────────────────────────
// Menu contestuale condiviso tra card/riga di file e cartelle: stesse azioni,
// stesso ordine già usato in FileCard/FileListRow (Scarica→Collega→Rinomina→
// Sposta→Elimina) e in FolderCard/FolderListRow (Apri→Rinomina→Sposta→
// Collega→Elimina).

export function DriveItemMenu({
  kind,
  anchorEl,
  onClose,
  onOpen,
  onDownload,
  onLinkCustomers,
  onRename,
  onMove,
  onDelete,
}: {
  kind: 'file' | 'folder'
  anchorEl: null | HTMLElement
  onClose: () => void
  onOpen?: () => void
  onDownload?: () => void
  onLinkCustomers: () => void
  onRename: () => void
  onMove: () => void
  onDelete: () => void
}) {
  const run = (action: () => void) => () => {
    onClose()
    action()
  }

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose} onClick={(e) => e.stopPropagation()}>
      {kind === 'file' && onDownload && (
        <MenuItem onClick={run(onDownload)} dense>
          <DownloadOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Scarica
        </MenuItem>
      )}
      {kind === 'folder' && onOpen && (
        <MenuItem onClick={run(onOpen)} dense>
          <FolderIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Apri
        </MenuItem>
      )}
      {kind === 'file' && (
        <MenuItem onClick={run(onLinkCustomers)} dense>
          <PersonAddOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Collega clienti
        </MenuItem>
      )}
      <MenuItem onClick={run(onRename)} dense>
        <DriveFileRenameOutlineIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Rinomina
      </MenuItem>
      <MenuItem onClick={run(onMove)} dense>
        <DriveFileMoveOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Sposta in…
      </MenuItem>
      {kind === 'folder' && (
        <MenuItem onClick={run(onLinkCustomers)} dense>
          <PersonAddOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Collega clienti
        </MenuItem>
      )}
      <MenuItem onClick={run(onDelete)} dense sx={{ color: 'error.main' }}>
        <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Elimina
      </MenuItem>
    </Menu>
  )
}
