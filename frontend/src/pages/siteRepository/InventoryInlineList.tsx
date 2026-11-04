import * as React from 'react'
import { Box, Tooltip, Typography, useMediaQuery } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

import { getInventoryTypeIcon, getInventoryTypeFamily } from '@shared/ui/inventoryTypeIcon'

import type { InventoryRow } from './types'
import {
  FS, ICON, MonoField, Highlight,
  toneColors, inventoryStatusTone, issuePriorityTone,
} from './style'
import { RADIUS, LABEL_COLOR, columnHeaderSx } from './tokens'
import { SignalChip, IpCell, ActiveIssueIcon } from './primitives'
import { SHARED } from '../../theme/constants'

// ─── InventoryInlineList ──────────────────────────────────────────────────────
//
// Ordine delle colonne per utilità in campo: prima ciò che si cerca (nome,
// hostname, IP, K#), poi lo stato, infine i dati di contorno. Le colonne
// facoltative vuote in TUTTE le righe mostrate vengono nascoste: prima
// POSIZIONE/TELEFONO/MODELLO erano quasi sempre "—" e spingevano gli IP fuori
// dallo schermo. Sotto md la tabella diventa una lista di card.

type ColKey =
  | 'type' | 'name' | 'hostname' | 'local_ip' | 'srsa_ip' | 'knumber'
  | 'status' | 'model' | 'serial' | 'location' | 'phone'

type ColDef = {
  key: ColKey
  header: string
  width: string
  /** Sempre visibile anche se vuota (colonne identificative). */
  always?: boolean
  value?: (r: InventoryRow) => string | null | undefined
}

const COLUMNS: ColDef[] = [
  { key: 'type',     header: 'Tipo',      width: '150px', always: true },
  { key: 'name',     header: 'Nome',      width: 'minmax(150px, 1.2fr)', always: true },
  { key: 'hostname', header: 'Hostname',  width: 'minmax(150px, 1.2fr)', always: true },
  { key: 'local_ip', header: 'IP locale', width: '150px', value: (r) => r.local_ip },
  { key: 'srsa_ip',  header: 'IP SRSA',   width: '150px', value: (r) => r.srsa_ip },
  { key: 'knumber',  header: 'K#',        width: '120px', value: (r) => r.knumber },
  { key: 'status',   header: 'Stato',     width: '130px', value: (r) => r.status_label },
  { key: 'model',    header: 'Modello',   width: 'minmax(120px, 1fr)', value: (r) => r.model },
  { key: 'serial',   header: 'Seriale',   width: '150px', value: (r) => r.serial_number },
  { key: 'location', header: 'Posizione', width: 'minmax(110px, 1fr)', value: (r) => r.location },
  { key: 'phone',    header: 'Telefono',  width: '130px', value: (r) => r.telefono },
]

function TypeBadge({ row, compact }: { row: InventoryRow; compact?: boolean }) {
  const typeLabel = row.type_label ?? ''
  const typeFamily = getInventoryTypeFamily(row.type_key)
  if (!typeLabel) return <Typography sx={{ fontSize: FS.body, color: 'text.disabled' }}>—</Typography>
  return (
    <Tooltip title={`${typeLabel} — ${typeFamily.label}`} arrow>
      <Box sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5,
        maxWidth: compact ? 'none' : 138, height: 24, px: 1, borderRadius: RADIUS,
        bgcolor: typeFamily.color, color: SHARED.pureWhite, minWidth: 0,
      }}>
        {React.createElement(getInventoryTypeIcon(row.type_key), {
          sx: { fontSize: `${ICON.inline}px !important`, color: SHARED.pureWhite, flexShrink: 0 },
        })}
        <Typography sx={{
          fontSize: FS.label, fontWeight: 600, color: SHARED.pureWhite,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {typeLabel}
        </Typography>
      </Box>
    </Tooltip>
  )
}

function Cell({ row, col, query }: { row: InventoryRow; col: ColKey; query: string }) {
  const textSx = { fontSize: FS.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const
  switch (col) {
    case 'type':
      return <Box sx={{ minWidth: 0 }}><TypeBadge row={row} /></Box>
    case 'name':
      return <Typography sx={textSx}>{row.name ? <Highlight text={row.name} query={query} /> : '—'}</Typography>
    case 'hostname':
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
          {row.has_active_issue && <ActiveIssueIcon priority={row.active_issue_priority} />}
          <Typography fontWeight={600} sx={{ ...textSx, color: row.hostname ? 'primary.dark' : 'text.disabled' }}>
            {row.hostname ? <Highlight text={row.hostname} query={query} /> : '—'}
          </Typography>
        </Box>
      )
    case 'local_ip':
      return <IpCell ip={row.local_ip} query={query} />
    case 'srsa_ip':
      return <IpCell ip={row.srsa_ip} query={query} />
    case 'knumber':
      return <MonoField value={row.knumber} query={query} />
    case 'status':
      return row.status_label
        ? <Box><SignalChip label={row.status_label} tone={inventoryStatusTone(row.status_key)} /></Box>
        : <Typography sx={{ fontSize: FS.body, color: 'text.disabled' }}>—</Typography>
    case 'model':
      return <MonoField value={row.model} />
    case 'serial':
      return <MonoField value={row.serial_number} query={query} />
    case 'location':
      return <Typography sx={{ ...textSx, color: 'text.secondary' }}>{row.location || '—'}</Typography>
    case 'phone':
      return <Typography sx={{ ...textSx, color: 'text.secondary' }}>{row.telefono || '—'}</Typography>
  }
}

// ─── Card mobile ──────────────────────────────────────────────────────────────

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: FS.micro, fontWeight: 600, color: LABEL_COLOR, lineHeight: 1.4 }}>{label}</Typography>
      {children}
    </Box>
  )
}

function MobileAssetRow({ row, query, onOpen, onContextMenu, issueSolid }: {
  row: InventoryRow
  query: string
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
  issueSolid: string | null
}) {
  const theme = useTheme()
  const extra: { label: string; node: React.ReactNode }[] = []
  if (row.local_ip) extra.push({ label: 'IP locale', node: <IpCell ip={row.local_ip} query={query} /> })
  if (row.srsa_ip) extra.push({ label: 'IP SRSA', node: <IpCell ip={row.srsa_ip} query={query} /> })
  if (row.knumber) extra.push({ label: 'K#', node: <MonoField value={row.knumber} query={query} /> })
  if (row.serial_number) extra.push({ label: 'Seriale', node: <MonoField value={row.serial_number} query={query} /> })

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e) }}
      sx={{
        px: 2, py: 1.25,
        display: 'flex', flexDirection: 'column', gap: 0.75,
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: issueSolid ? `inset 3px 0 0 ${issueSolid}` : 'none',
        cursor: 'pointer',
        '&:active': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <TypeBadge row={row} compact />
        <Box sx={{ flex: 1 }} />
        {row.status_label ? <SignalChip label={row.status_label} tone={inventoryStatusTone(row.status_key)} /> : null}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: FS.title, fontWeight: 600, overflowWrap: 'anywhere' }}>
          {row.name ? <Highlight text={row.name} query={query} /> : '—'}
        </Typography>
        {row.hostname ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            {row.has_active_issue && <ActiveIssueIcon priority={row.active_issue_priority} />}
            <Typography sx={{ fontSize: FS.body, fontWeight: 600, color: 'primary.dark', overflowWrap: 'anywhere' }}>
              <Highlight text={row.hostname} query={query} />
            </Typography>
          </Box>
        ) : null}
      </Box>
      {extra.length ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }} onClick={(e) => e.stopPropagation()}>
          {extra.map((f) => <MobileField key={f.label} label={f.label}>{f.node}</MobileField>)}
        </Box>
      ) : null}
    </Box>
  )
}

export function InventoryInlineList({
  rows,
  onOpenDrawer,
  onRowContextMenu,
  searchQuery = '',
}: {
  rows: InventoryRow[]
  onOpenDrawer: (id: number, typeKeyHint?: string | null) => void
  onRowContextMenu: (row: InventoryRow, e: React.MouseEvent) => void
  searchQuery?: string
}) {
  const theme = useTheme()
  const compact = useMediaQuery(theme.breakpoints.down('md'))

  const visibleCols = React.useMemo(
    () => COLUMNS.filter((c) => c.always || rows.some((r) => Boolean(c.value?.(r)?.toString().trim()))),
    [rows],
  )
  const gridTemplate = visibleCols.map((c) => c.width).join(' ')

  if (!rows.length) return (
    <Box sx={{ px: 3, py: 1.5 }}>
      <Typography sx={{ fontSize: FS.body, color: 'text.secondary' }}>Nessun asset in questo sito.</Typography>
    </Box>
  )

  if (compact) {
    return (
      <Box>
        {rows.map((row) => {
          const issueColor = row.has_active_issue ? toneColors(theme, issuePriorityTone(row.active_issue_priority)) : null
          return (
            <MobileAssetRow
              key={row.id}
              row={row}
              query={searchQuery}
              issueSolid={issueColor?.solid ?? null}
              onOpen={() => onOpenDrawer(row.id, row.type_key)}
              onContextMenu={(e) => onRowContextMenu(row, e)}
            />
          )
        })}
      </Box>
    )
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ minWidth: 'max-content' }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          columnGap: 1.5,
          px: 3, py: 0.75,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}>
          {visibleCols.map((c) => (
            <Typography key={c.key} sx={columnHeaderSx}>{c.header}</Typography>
          ))}
        </Box>

        {rows.map((row, idx) => {
          const zebraBg = idx % 2 === 0 ? 'background.paper' : 'grey.50'
          const issueColor = row.has_active_issue ? toneColors(theme, issuePriorityTone(row.active_issue_priority)) : null

          return (
            <Box
              key={row.id}
              role="button"
              tabIndex={0}
              aria-label={`Apri asset ${row.name || row.hostname || row.id}`}
              onClick={() => onOpenDrawer(row.id, row.type_key)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDrawer(row.id, row.type_key) } }}
              onContextMenu={(e) => { e.preventDefault(); onRowContextMenu(row, e) }}
              sx={{
                display: 'grid',
                gridTemplateColumns: gridTemplate,
                columnGap: 1.5,
                px: 3, py: 0.875,
                alignItems: 'center',
                borderBottom: idx < rows.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                cursor: 'pointer',
                bgcolor: zebraBg,
                // Indicatore "segnale" per asset con issue attiva: barra inset, nessuno shift di layout
                boxShadow: issueColor ? `inset 3px 0 0 ${issueColor.solid}` : 'none',
                transition: 'background 0.12s',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
              }}
            >
              {visibleCols.map((c) => <Cell key={c.key} row={row} col={c.key} query={searchQuery} />)}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
