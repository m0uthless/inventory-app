import * as React from 'react'
import { alpha } from '@mui/material/styles'
import { IconButton, ButtonBase, Checkbox, Typography } from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'

import type { DriveFolder } from './types'
import { fmtDate } from './style'
import { DriveItemMenu } from './DriveItemMenu'

// ─── Folder List Row ──────────────────────────────────────────────────────────

export function FolderListRow({
  folder,
  idx,
  total,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onLinkCustomers,
  isSelected,
  onToggleSelect,
}: {
  folder: DriveFolder
  idx: number
  total: number
  onOpen: () => void
  onRename: () => void
  onMove: () => void
  onDelete: () => void
  onLinkCustomers: () => void
  isSelected: boolean
  onToggleSelect: (e: React.MouseEvent) => void
}) {
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null)

  return (
    <ButtonBase
      component="div"
      onClick={onOpen}
      aria-label={`Apri cartella ${folder.name}`}
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        justifyContent: 'flex-start',
        textAlign: 'left',
        px: 2,
        py: 1,
        borderBottom: idx < total - 1 ? '1px solid' : 'none',
        borderColor: 'grey.100',
        bgcolor: (t) => idx % 2 === 1 ? alpha(t.palette.primary.main, 0.015) : t.palette.background.paper,
        transition: 'background 0.1s',
        '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.04), '& .folder-row-menu': { opacity: 1 } },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      <Checkbox
        size="small"
        checked={isSelected}
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelect(e)
        }}
        icon={<CheckBoxOutlineBlankIcon sx={{ fontSize: 18, color: 'grey.300' }} />}
        checkedIcon={<CheckBoxIcon sx={{ fontSize: 18, color: 'primary.main' }} />}
        inputProps={{ 'aria-label': `Seleziona cartella ${folder.name}` }}
        sx={{ p: 0, mr: -0.5 }}
      />
      <FolderIcon sx={{ fontSize: 20, color: 'warning.main' }} />
      <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
        {folder.name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        {folder.files_count} file · {folder.children_count} cartelle
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled', width: 70, textAlign: 'right' }}>
        {fmtDate(folder.updated_at)}
      </Typography>
      <IconButton
        className="folder-row-menu"
        aria-label="Azioni cartella"
        size="small"
        onClick={(e) => {
          e.stopPropagation()
          setMenuAnchor(e.currentTarget)
        }}
        sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'text.disabled' }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <DriveItemMenu
        kind="folder"
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        onOpen={onOpen}
        onLinkCustomers={onLinkCustomers}
        onRename={onRename}
        onMove={onMove}
        onDelete={onDelete}
      />
    </ButtonBase>
  )
}
