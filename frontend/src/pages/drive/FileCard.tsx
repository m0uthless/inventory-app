import * as React from 'react'
import { Box, ButtonBase, IconButton, Menu, MenuItem, Typography } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined'

import type { DriveFile } from './types'
import { fmtDate, fileIconBg, FileTypeIcon } from './style'

// ─── File Card ────────────────────────────────────────────────────────────────

export function FileCard({
  file,
  onSelect,
  selected,
  onRename,
  onMove,
  onDelete,
  onLinkCustomers,
}: {
  file: DriveFile
  onSelect: () => void
  selected: boolean
  onRename: () => void
  onMove: () => void
  onDelete: () => void
  onLinkCustomers: () => void
}) {
  const { bg } = fileIconBg(file.mime_type)
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null)
  const handleDownload = () => window.open(`/api/drive-files/${file.id}/download/`, '_blank')

  return (
    <Box
      sx={{
        bgcolor: selected ? 'rgba(15,118,110,0.07)' : '#fff',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'grey.200',
        borderRadius: 1,
        p: 1.5,
        cursor: 'pointer',
        transition: 'all 0.13s',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        position: 'relative',
        '&:hover': {
          bgcolor: selected ? 'rgba(15,118,110,0.09)' : '#f8fafc',
          borderColor: selected ? 'primary.main' : 'grey.300',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          '& .file-menu-btn': { opacity: 1 },
        },
      }}
    >
      <ButtonBase
        component="div"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Seleziona file ${file.name}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          flex: 1,
          minWidth: 0,
          justifyContent: 'flex-start',
          textAlign: 'left',
          borderRadius: 1,
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            bgcolor: bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FileTypeIcon mime={file.mime_type} size={18} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {file.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {file.size_human} · {fmtDate(file.updated_at)}
          </Typography>
        </Box>
      </ButtonBase>
      <IconButton
        className="file-menu-btn"
        aria-label="Menu file"
        size="small"
        onClick={(e) => {
          e.stopPropagation()
          setMenuAnchor(e.currentTarget)
        }}
        sx={{
          opacity: 0,
          transition: 'opacity 0.15s',
          flexShrink: 0,
          color: 'text.disabled',
          '&:hover': { color: 'text.primary' },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            handleDownload()
          }}
          dense
        >
          <DownloadOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Scarica
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onLinkCustomers()
          }}
          dense
        >
          <PersonAddOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Collega
          clienti
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onRename()
          }}
          dense
        >
          <DriveFileRenameOutlineIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />{' '}
          Rinomina
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onMove()
          }}
          dense
        >
          <DriveFileMoveOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />{' '}
          Sposta in…
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onDelete()
          }}
          dense
          sx={{ color: 'error.main' }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Elimina
        </MenuItem>
      </Menu>
    </Box>
  )
}
