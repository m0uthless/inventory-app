import * as React from 'react'
import { ButtonBase, IconButton, Menu, MenuItem, Stack, Typography } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined'
import FolderIcon from '@mui/icons-material/Folder'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined'

import type { DriveFolder } from './types'
import { fmtDate } from './style'
import { useWidgetAccents } from '../../theme/AppThemeProvider'

// ─── Folder Card ──────────────────────────────────────────────────────────────

export function FolderCard({
  folder,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onLinkCustomers,
}: {
  folder: DriveFolder
  onOpen: () => void
  onRename: () => void
  onMove: () => void
  onDelete: () => void
  onLinkCustomers: () => void
}) {
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null)
  const widgetAccents = useWidgetAccents()

  return (
    <ButtonBase
      component="div"
      onClick={onOpen}
      aria-label={`Apri cartella ${folder.name}`}
      sx={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'grey.200',
        borderRadius: 1,
        p: 1.5,
        cursor: 'pointer',
        transition: 'all 0.13s',
        position: 'relative',
        '&:hover': {
          bgcolor: widgetAccents.softTealBg,
          borderColor: 'primary.light',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          '& .folder-menu-btn': { opacity: 1 },
        },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{ mb: 0.5 }}
      >
        <FolderIcon sx={{ fontSize: 28, color: 'warning.main' }} />
        <IconButton
          className="folder-menu-btn"
          aria-label="Menu cartella"
          size="small"
          onClick={(e) => {
            e.stopPropagation()
            setMenuAnchor(e.currentTarget)
          }}
          sx={{
            opacity: 0,
            transition: 'opacity 0.15s',
            mt: -0.5,
            mr: -0.75,
            color: 'text.disabled',
            '&:hover': { color: 'text.primary' },
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Stack>
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
        {folder.name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        {folder.files_count} file · {fmtDate(folder.updated_at)}
      </Typography>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onOpen()
          }}
          dense
        >
          <FolderIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Apri
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
            onDelete()
          }}
          dense
          sx={{ color: 'error.main' }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Elimina
        </MenuItem>
      </Menu>
    </ButtonBase>
  )
}
