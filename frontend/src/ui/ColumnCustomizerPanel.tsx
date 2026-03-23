/**
 * ColumnCustomizerPanel
 *
 * Pannello drag & drop per riordinare e mostrare/nascondere le colonne
 * del DataGrid. Usa le Web API native (draggable) — zero dipendenze esterne.
 *
 * Uso:
 *   <ColumnCustomizerPanel
 *     anchorEl={el}
 *     onClose={() => setAnchorEl(null)}
 *     columns={columns}           // GridColDef[]
 *     columnOrder={order}         // string[] da useColumnPrefs
 *     columnVisibility={vis}      // GridColumnVisibilityModel
 *     onOrderChange={saveOrder}
 *     onVisibilityChange={onColumnVisibilityModelChange}
 *     onReset={resetPrefs}
 *     hasPrefs={hasPrefs}
 *   />
 */

import * as React from 'react'
import {
  Box,
  Button,
  Divider,
  IconButton,
  Popover,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import VisibilityIcon from '@mui/icons-material/Visibility'
import type { GridColDef, GridColumnVisibilityModel } from '@mui/x-data-grid'

type Column = Pick<GridColDef, 'field' | 'headerName'>

type Props = {
  anchorEl: HTMLElement | null
  onClose: () => void
  columns: Column[]
  columnOrder: string[]
  columnVisibility: GridColumnVisibilityModel
  onOrderChange: (order: string[]) => void
  onVisibilityChange: (model: GridColumnVisibilityModel) => void
  onReset: () => void
  hasPrefs: boolean
}

export default function ColumnCustomizerPanel({
  anchorEl,
  onClose,
  columns,
  columnOrder,
  columnVisibility,
  onOrderChange,
  onVisibilityChange,
  onReset,
  hasPrefs,
}: Props) {
  const open = Boolean(anchorEl)

  // ── Ordine interno al pannello ──────────────────────────────────────────
  // Inizializziamo dall'ordine salvato; le colonne non presenti nell'ordine
  // salvato vengono aggiunte in coda (nuove colonne aggiunte al codice).
  const resolvedOrder = React.useMemo(() => {
    if (!columnOrder.length) return columns.map((c) => c.field)
    const saved = columnOrder.filter((f) => columns.some((c) => c.field === f))
    const unsaved = columns.map((c) => c.field).filter((f) => !saved.includes(f))
    return [...saved, ...unsaved]
  }, [columns, columnOrder])

  const [localOrder, setLocalOrder] = React.useState<string[]>(resolvedOrder)

  // Sincronizza se cambia dall'esterno (es. reset)
  React.useEffect(() => {
    setLocalOrder(resolvedOrder)
  }, [resolvedOrder])

  const colByField = React.useMemo(
    () => new Map(columns.map((c) => [c.field, c])),
    [columns],
  )

  // ── Drag state ──────────────────────────────────────────────────────────
  const dragField = React.useRef<string | null>(null)
  const [dragOver, setDragOver] = React.useState<string | null>(null)

  const handleDragStart = (field: string) => {
    dragField.current = field
  }

  const handleDragOver = (e: React.DragEvent, field: string) => {
    e.preventDefault()
    if (dragField.current !== field) setDragOver(field)
  }

  const handleDrop = (targetField: string) => {
    const from = dragField.current
    if (!from || from === targetField) {
      setDragOver(null)
      return
    }
    const next = [...localOrder]
    const fromIdx = next.indexOf(from)
    const toIdx = next.indexOf(targetField)
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, from)
    setLocalOrder(next)
    onOrderChange(next)
    dragField.current = null
    setDragOver(null)
  }

  const handleDragEnd = () => {
    dragField.current = null
    setDragOver(null)
  }

  // ── Visibilità ──────────────────────────────────────────────────────────
  const isVisible = (field: string) => columnVisibility[field] !== false

  const toggleVisibility = (field: string) => {
    onVisibilityChange({ ...columnVisibility, [field]: !isVisible(field) })
  }

  const visibleCount = localOrder.filter((f) => isVisible(f)).length

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            width: 280,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            mt: 0.5,
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <VisibilityIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700}>
            Colonne
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', ml: 0.5 }}>
            {visibleCount}/{localOrder.length} visibili
          </Typography>
        </Box>
        {hasPrefs && (
          <Tooltip title="Ripristina layout predefinito">
            <IconButton
              size="small"
              onClick={onReset}
              sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
            >
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Hint */}
      <Box sx={{ px: 2, pt: 1, pb: 0.25 }}>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          Trascina per riordinare · attiva/disattiva con il toggle
        </Typography>
      </Box>

      <Divider sx={{ mx: 1, my: 0.75 }} />

      {/* Lista colonne */}
      <Box
        sx={{ maxHeight: 360, overflowY: 'auto', px: 1, pb: 1 }}
        onDragOver={(e) => e.preventDefault()}
      >
        {localOrder.map((field) => {
          const col = colByField.get(field)
          if (!col) return null
          const label = col.headerName || field
          const visible = isVisible(field)
          const isOver = dragOver === field

          return (
            <Box
              key={field}
              draggable
              onDragStart={() => handleDragStart(field)}
              onDragOver={(e) => handleDragOver(e, field)}
              onDrop={() => handleDrop(field)}
              onDragEnd={handleDragEnd}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 0.75,
                py: 0.5,
                borderRadius: 1.5,
                cursor: 'grab',
                userSelect: 'none',
                transition: 'all 0.12s',
                borderTop: isOver ? '2px solid' : '2px solid transparent',
                borderColor: isOver ? 'primary.main' : 'transparent',
                backgroundColor: isOver ? 'action.hover' : 'transparent',
                opacity: visible ? 1 : 0.45,
                '&:hover': { backgroundColor: 'action.hover' },
                '&:active': { cursor: 'grabbing' },
              }}
            >
              {/* Drag handle */}
              <DragIndicatorIcon
                sx={{ fontSize: 18, color: 'text.disabled', flexShrink: 0 }}
              />

              {/* Label */}
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  fontWeight: visible ? 500 : 400,
                  color: visible ? 'text.primary' : 'text.disabled',
                  fontSize: '0.82rem',
                }}
              >
                {label}
              </Typography>

              {/* Toggle visibilità */}
              <Switch
                size="small"
                checked={visible}
                onChange={() => toggleVisibility(field)}
                onClick={(e) => e.stopPropagation()}
                sx={{ flexShrink: 0 }}
              />
            </Box>
          )
        })}
      </Box>

      {/* Footer */}
      <Divider />
      <Box sx={{ px: 1.5, py: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onClose} sx={{ fontSize: '0.78rem' }}>
          Chiudi
        </Button>
      </Box>
    </Popover>
  )
}
