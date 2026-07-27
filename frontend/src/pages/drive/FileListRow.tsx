import * as React from 'react'
import { IconButton, Box, ButtonBase, Checkbox, Menu, MenuItem, Typography } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'

import type { DriveFile } from './types'
import { fmtDate, fileIconBg, FileTypeIcon } from './style'

// ─── File List Row ────────────────────────────────────────────────────────────

export function FileListRow({
  file,
  idx,
  globalIdx,
  totalItems,
  selected,
  onSelect,
  onRename,
  onMove,
  onDelete,
  onLinkCustomers,
  isChecked,
  onToggleCheck,
}: {
  file: DriveFile
  idx: number
  globalIdx: number
  totalItems: number
  selected: boolean
  onSelect: () => void
  onRename: () => void
  onMove: () => void
  onDelete: () => void
  onLinkCustomers: () => void
  isChecked: boolean
  onToggleCheck: (e: React.MouseEvent) => void
}) {
  const { bg } = fileIconBg(file.mime_type)
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null)
  const handleDownload = () => window.open(`/api/drive-files/${file.id}/download/`, '_blank')

  return (
    <ButtonBase
      component="div"
      onClick={onSelect}
      aria-label={`Apri file ${file.name}`}
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
        borderBottom: globalIdx < totalItems - 1 ? '1px solid' : 'none',
        borderColor: 'grey.100',
        bgcolor: selected
          ? 'rgba(15,118,110,0.06)'
          : idx % 2 === 1
            ? 'rgba(15,118,110,0.015)'
            : '#fff',
        transition: 'background 0.1s',
        '&:hover': { bgcolor: 'rgba(15,118,110,0.04)', '& .file-row-menu': { opacity: 1 } },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      <Checkbox
        size="small"
        checked={isChecked}
        onClick={(e) => {
          e.stopPropagation()
          onToggleCheck(e)
        }}
        icon={<CheckBoxOutlineBlankIcon sx={{ fontSize: 18, color: 'grey.300' }} />}
        checkedIcon={<CheckBoxIcon sx={{ fontSize: 18, color: 'primary.main' }} />}
        inputProps={{ 'aria-label': `Seleziona file ${file.name}` }}
        sx={{ p: 0, mr: -0.5 }}
      />
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 1,
          bgcolor: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <FileTypeIcon mime={file.mime_type} size={15} />
      </Box>
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {file.name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled', width: 65, textAlign: 'right' }}>
        {file.size_human}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled', width: 80, textAlign: 'right' }}>
        {fmtDate(file.updated_at)}
      </Typography>
      <IconButton
        className="file-row-menu"
        aria-label="Azioni file"
        size="small"
        onClick={(e) => {
          e.stopPropagation()
          setMenuAnchor(e.currentTarget)
        }}
        sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'text.disabled' }}
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
    </ButtonBase>
  )
}
