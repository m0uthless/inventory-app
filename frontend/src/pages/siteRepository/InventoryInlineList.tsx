import * as React from 'react'
import { Box, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

import { getInventoryTypeIcon, getInventoryTypeFamily } from '@shared/ui/inventoryTypeIcon'

import type { InventoryRow } from './types'
import { FS, ICON, COL_GRID, MonoField, toneColors, inventoryStatusTone, issuePriorityTone } from './style'
import { SignalChip, IpCell, ActiveIssueIcon } from './primitives'

// ─── InventoryInlineList ──────────────────────────────────────────────────────

export function InventoryInlineList({
  rows,
  onOpenDrawer,
  onRowContextMenu,
}: {
  rows: InventoryRow[]
  onOpenDrawer: (id: number) => void
  onRowContextMenu: (row: InventoryRow, e: React.MouseEvent) => void
}) {
  const theme = useTheme()

  if (!rows.length) return (
    <Box sx={{ px: 3, py: 1.5 }}>
      <Typography sx={{ fontSize: FS.body, color: 'text.secondary' }}>Nessun asset in questo sito.</Typography>
    </Box>
  )

  return (
    <Box>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: COL_GRID,
        px: 3, py: 0.625,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}>
        {['TIPO', 'NOME', 'HOSTNAME', 'K#', 'MODELLO', 'SERIALE', 'STATO', 'IP LOCALE', 'IP SRSA'].map((h) => (
          <Typography key={h}
            sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.06em', fontSize: FS.micro }}>
            {h}
          </Typography>
        ))}
      </Box>

      {rows.map((row, idx) => {
        const TypeIcon  = getInventoryTypeIcon(row.type_key)
        const typeLabel = row.type_label ?? ''
        const typeFamily = getInventoryTypeFamily(row.type_key)
        const zebraBg = idx % 2 === 0 ? 'background.paper' : 'grey.50'
        const issueColor = row.has_active_issue ? toneColors(theme, issuePriorityTone(row.active_issue_priority)) : null

        return (
          <Box
            key={row.id}
            onClick={() => onOpenDrawer(row.id)}
            onContextMenu={(e) => { e.preventDefault(); onRowContextMenu(row, e) }}
            sx={{
              display: 'grid',
              gridTemplateColumns: COL_GRID,
              px: 3, py: 0.75,
              alignItems: 'center',
              borderBottom: idx < rows.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
              cursor: 'pointer',
              bgcolor: zebraBg,
              // Indicatore "segnale" per asset con issue attiva: barra inset, nessuno shift di layout
              boxShadow: issueColor ? `inset 3px 0 0 ${issueColor.solid}` : 'none',
              transition: 'background 0.12s',
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
            }}
          >
            {/* Tipo — badge a sfondo pieno per famiglia, larghezza fissa per coerenza in colonna */}
            <Box>
              {typeLabel ? (
                <Tooltip title={`${typeLabel} — ${typeFamily.label}`} arrow>
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    width: 132, height: 22, px: 1, borderRadius: '6px',
                    bgcolor: typeFamily.color,
                    color: '#fff',
                  }}>
                    <TypeIcon sx={{ fontSize: `${ICON.inline}px !important`, color: '#fff', flexShrink: 0 }} />
                    <Typography sx={{
                      fontSize: FS.micro, fontWeight: 600, color: '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {typeLabel}
                    </Typography>
                  </Box>
                </Tooltip>
              ) : (
                <Typography sx={{ fontSize: FS.body, color: 'text.disabled' }}>—</Typography>
              )}
            </Box>

            {/* Nome */}
            <Typography sx={{
              fontSize: FS.body,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {row.name || '—'}
            </Typography>

            {/* Hostname */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
              {row.has_active_issue && <ActiveIssueIcon priority={row.active_issue_priority} />}
              <Typography fontWeight={500} sx={{
                color: 'primary.main', fontSize: FS.body,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                '&:hover': { textDecoration: 'underline' },
              }}>
                {row.hostname || '—'}
              </Typography>
            </Box>

            {/* K# */}
            <MonoField value={row.knumber} />

            {/* Modello */}
            <MonoField value={row.model} />

            {/* Seriale */}
            <MonoField value={row.serial_number} />

            {/* Stato — badge "segnale": è lo stato operativo dell'asset */}
            <Box>
              {row.status_label ? (
                <SignalChip label={row.status_label} tone={inventoryStatusTone(row.status_key)} />
              ) : (
                <Typography sx={{ fontSize: FS.body, color: 'text.disabled' }}>—</Typography>
              )}
            </Box>

            {/* IP Locale */}
            <IpCell ip={row.local_ip} />

            {/* IP SRSA */}
            <IpCell ip={row.srsa_ip} />
          </Box>
        )
      })}
    </Box>
  )
}
