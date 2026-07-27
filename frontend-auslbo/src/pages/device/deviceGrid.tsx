import { Box, Chip, Typography } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import type { RispacsLink, WifiDetail } from '@shared/device/deviceTypes'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeviceRow = {
  id: number
  customer: number | null
  customer_name: string | null
  customer_code: string | null
  site: number | null
  site_name: string | null
  site_display_name: string | null
  type: number | null
  type_name: string | null
  type_dose_sr: boolean
  status: number | null
  status_name: string | null
  manufacturer: number | null
  manufacturer_name: string | null
  manufacturer_logo_url: string | null
  model: string | null
  aetitle: string | null
  serial_number: string | null
  inventario: string | null
  reparto: string | null
  room: string | null
  ip: string | null
  vlan: boolean
  wifi: boolean
  rispacs: boolean
  dose: boolean
  updated_at: string | null
  deleted_at: string | null
}

export type DeviceDetail = DeviceRow & {
  note: string | null
  location: string | null
  custom_fields: Record<string, unknown> | null
  rispacs_links: RispacsLink[]
  wifi_detail: WifiDetail | null
}

// ─── Status colours ───────────────────────────────────────────────────────────

export function statusColor(name: string | null): { bg: string; fg: string; border: string } {
  const lower = (name ?? '').toLowerCase()
  if (lower.includes('attiv') || lower.includes('operativ'))
    return { bg: 'rgba(16,185,129,0.10)', fg: '#065f46', border: 'rgba(16,185,129,0.28)' }
  if (lower.includes('manutenzione') || lower.includes('riparazione'))
    return { bg: 'rgba(245,158,11,0.10)', fg: '#92400e', border: 'rgba(245,158,11,0.28)' }
  if (lower.includes('dismess') || lower.includes('fuori'))
    return { bg: 'rgba(148,163,184,0.12)', fg: '#475569', border: 'rgba(148,163,184,0.30)' }
  return { bg: 'rgba(99,102,241,0.10)', fg: '#3730a3', border: 'rgba(99,102,241,0.28)' }
}

// ─── Flag badge helper ─────────────────────────────────────────────────────────

export function FlagBadge({ label, active }: { label: string; active: boolean }) {
  if (!active) return null
  return (
    <Chip size="small" label={label} sx={{
      height: 18, fontSize: '0.65rem', fontWeight: 700,
      bgcolor: 'rgba(26,107,181,0.10)', color: '#1A4F7A',
      border: '1px solid rgba(26,107,181,0.22)',
      '& .MuiChip-label': { px: 0.6 },
    }} />
  )
}

// ─── Columns ──────────────────────────────────────────────────────────────────

export const FLAG_CHIP_SX = {
  height: 16, fontSize: '0.60rem', fontWeight: 700,
  bgcolor: 'rgba(26,107,181,0.10)', color: '#1A4F7A',
  border: '1px solid rgba(26,107,181,0.22)',
  '& .MuiChip-label': { px: 0.5 },
} as const

export const deviceGridColumns: GridColDef<DeviceRow>[] = [
  { field: 'inventario', headerName: 'Inventario', width: 140 },
  {
    field: 'type_name', headerName: 'Tipo', width: 140,
    renderCell: (p) => {
      const label = p.value as string | null
      if (!label) return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Chip size="small" label={label} sx={{
            height: 22, fontSize: '0.72rem', fontWeight: 600,
            bgcolor: 'rgba(26,107,181,0.08)', color: 'text.primary',
            border: '1px solid rgba(26,107,181,0.18)',
            '& .MuiChip-label': { px: 0.75 },
          }} />
        </Box>
      )
    },
  },
  { field: 'manufacturer_name', headerName: 'Produttore', width: 140 },
  {
    field: 'model', headerName: 'Modello', flex: 1, minWidth: 160,
    renderCell: (p) => {
      const label = p.value as string | null
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%', minWidth: 0 }}>
          <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: label ? 'text.primary' : 'text.disabled' }}>
            {label ?? '—'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.3, flexShrink: 0 }}>
            {p.row.vlan    && <Chip size="small" label="VLAN"    sx={FLAG_CHIP_SX} />}
            {p.row.wifi    && <Chip size="small" label="WiFi"    sx={FLAG_CHIP_SX} />}
            {p.row.rispacs && <Chip size="small" label="PACS"    sx={FLAG_CHIP_SX} />}
            {p.row.dose && <Chip size="small" label="DoseSR" sx={FLAG_CHIP_SX} />}
          </Box>
        </Box>
      )
    },
  },
  {
    field: 'aetitle', headerName: 'AE Title', width: 130,
    renderCell: (p) => (
      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: p.value ? 'text.primary' : 'text.disabled' }}>
        {p.value ?? '—'}
      </Typography>
    ),
  },
  {
    field: 'site_display_name', headerName: 'Sede', width: 160,
    valueGetter: (_v, row) => row.site_display_name || row.site_name || '—',
  },
  { field: 'reparto', headerName: 'Reparto', width: 130 },
  { field: 'room',    headerName: 'Stanza',  width: 110 },
  {
    field: 'status_name', headerName: 'Stato', width: 140,
    renderCell: (p) => {
      const label = p.value as string | null
      if (!label) return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
      const c = statusColor(label)
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Chip size="small" label={label} sx={{
            height: 22, fontSize: '0.72rem', fontWeight: 600,
            bgcolor: c.bg, color: c.fg, border: `1px solid ${c.border}`,
            '& .MuiChip-label': { px: 0.75 },
          }} />
        </Box>
      )
    },
  },
]

// ─── Mobile card ──────────────────────────────────────────────────────────────

export const renderDeviceCard: MobileCardRenderFn<DeviceRow> = ({ row, onOpen }) => {
  const sc = statusColor(row.status_name)
  const meta: { label: string; value: string | null | undefined; mono?: boolean }[] = [
    { label: 'Sede',    value: row.site_display_name || row.site_name },
    { label: 'IP',      value: row.ip, mono: true },
    { label: 'Seriale', value: row.serial_number, mono: true },
    { label: 'Inv.',    value: row.inventario },
  ]
  return (
    <Box onClick={() => onOpen(row.id)} sx={{
      bgcolor: 'background.paper', border: '0.5px solid', borderColor: 'divider',
      borderRadius: 1, p: 1.25, cursor: 'pointer', display: 'flex',
      flexDirection: 'column', gap: 0.75, '&:active': { bgcolor: 'action.hover' },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.model || row.type_name || `Device #${row.id}`}
          </Typography>
          {(row.manufacturer_name || row.type_name) && (
            <Typography variant="caption" color="text.secondary">
              {[row.manufacturer_name, row.type_name].filter(Boolean).join(' · ')}
            </Typography>
          )}
        </Box>
        {row.status_name && (
          <Box sx={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 600, px: 0.75, py: 0.2, borderRadius: 20, bgcolor: sc.bg, color: sc.fg, border: `0.5px solid ${sc.border}`, whiteSpace: 'nowrap' }}>
            {row.status_name}
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {meta.map(({ label, value, mono }) => (
          <Box key={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', lineHeight: 1 }}>{label}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: value ? 'text.secondary' : 'text.disabled', fontStyle: value ? 'normal' : 'italic', fontFamily: mono && value ? 'monospace' : 'inherit', lineHeight: 1.3 }}>
              {value || '—'}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, flexWrap: 'wrap' }}>
        <FlagBadge label="VLAN" active={row.vlan} />
        <FlagBadge label="WiFi" active={row.wifi} />
        <FlagBadge label="PACS" active={row.rispacs} />
        <FlagBadge label="DoseSR" active={row.dose} />
      </Box>
      {(row.site_display_name || row.site_name) && (
        <Box sx={{ borderTop: '0.5px solid', borderColor: 'divider', pt: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.5, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary">{row.site_display_name || row.site_name}</Typography>
        </Box>
      )}
    </Box>
  )
}
