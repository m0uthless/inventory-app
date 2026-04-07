import * as React from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Fab,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import WifiOutlinedIcon from '@mui/icons-material/WifiOutlined'
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined'
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined'
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined'
import AddIcon from '@mui/icons-material/Add'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'

import type { GridColDef } from '@mui/x-data-grid'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'

import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useDrfList } from '@shared/hooks/useDrfList'
import { buildDrfListParams } from '@shared/api/drf'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import { useListUrlNumberParam, useListUrlStringParam } from '@shared/hooks/useListUrlParam'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import WifiPasswordIcon from '@mui/icons-material/WifiPassword'
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined'

import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import { useAuth } from '../auth/AuthProvider'
import AuslBoDeviceDrawer from '../ui/AuslBoDeviceDrawer'

// ─── Types ────────────────────────────────────────────────────────────────────

type LookupItem = { id: number; name: string }
type DeviceTypeItem = { id: number; name: string; dose_sr: boolean }
type ManufacturerItem = { id: number; name: string; logo_url: string | null }
type SiteItem   = { id: number; name: string; display_name: string }
type RispacsItem = { id: number; name: string; ip: string | null; aetitle: string | null }

type DeviceRow = {
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

type RispacsLink = {
  id: number
  device: number
  rispacs: number
  rispacs_name: string | null
  rispacs_ip: string | null
  rispacs_port: number | null
  rispacs_aetitle: string | null
}

type WifiDetail = {
  id: number
  ip: string | null
  mac_address: string | null
  certificato_url: string | null
  pass_certificato: string | null
  scad_certificato: string | null
}

type DeviceDetail = DeviceRow & {
  note: string | null
  location: string | null
  custom_fields: Record<string, unknown> | null
  rispacs_links: RispacsLink[]
  wifi_detail: WifiDetail | null
}

// ─── Form state ───────────────────────────────────────────────────────────────

type DeviceFormState = {
  site: number | ''
  type: number | ''
  status: number | ''
  manufacturer: number | ''
  model: string
  aetitle: string
  serial_number: string
  inventario: string
  reparto: string
  room: string
  ip: string
  vlan: boolean
  wifi: boolean
  rispacs: boolean
  dose: boolean
  note: string
  location: string
  // RIS/PACS links (IDs dei sistemi selezionati)
  rispacs_ids: number[]
  // WiFi
  wifi_ip: string
  wifi_mac: string
  wifi_pass: string
  wifi_scad: string
  wifi_cert_file: File | null
}

const emptyForm = (): DeviceFormState => ({
  site: '',
  type: '',
  status: '',
  manufacturer: '',
  model: '',
  aetitle: '',
  serial_number: '',
  inventario: '',
  reparto: '',
  room: '',
  ip: '',
  vlan: false,
  wifi: false,
  rispacs: false,
  dose: false,
  note: '',
  location: '',
  rispacs_ids: [],
  wifi_ip: '',
  wifi_mac: '',
  wifi_pass: '',
  wifi_scad: '',
  wifi_cert_file: null,
})

// ─── Status colours ───────────────────────────────────────────────────────────

function statusColor(name: string | null): { bg: string; fg: string; border: string } {
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

function FlagBadge({ label, active }: { label: string; active: boolean }) {
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

const FLAG_CHIP_SX = {
  height: 16, fontSize: '0.60rem', fontWeight: 700,
  bgcolor: 'rgba(26,107,181,0.10)', color: '#1A4F7A',
  border: '1px solid rgba(26,107,181,0.22)',
  '& .MuiChip-label': { px: 0.5 },
} as const

const cols: GridColDef<DeviceRow>[] = [
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

const renderDeviceCard: MobileCardRenderFn<DeviceRow> = ({ row, onOpen }) => {
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

// ─── Copy helper ──────────────────────────────────────────────────────────────

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* noop */ }
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 1, p: 1.75 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        {icon}{title}
      </Typography>
      <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
        {children}
      </Stack>
    </Box>
  )
}

function DetailRow({ label, value, mono = false, copy = false, minW = 90 }: { label: string; value: string | null | undefined; mono?: boolean; copy?: boolean; minW?: number }) {
  if (!value) return null
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
      <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: minW }}>{label}</Typography>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: mono ? 'monospace' : undefined, fontSize: mono ? 12 : undefined }}>
          {value}
        </Typography>
        {copy && (
          <Tooltip title="Copia">
            <IconButton aria-label="Copia" size="small" onClick={() => copyToClipboard(value)}>
              <ContentCopyIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  )
}

// ─── Form field ───────────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

// ─── Hero banner ──────────────────────────────────────────────────────────────

// Controlla se la scadenza certificato è entro 60 giorni
function certExpiryAlert(scad: string | null | undefined): 'error' | 'warning' | null {
  if (!scad) return null
  const days = Math.ceil((new Date(scad).getTime() - Date.now()) / 86400000)
  if (days < 0)  return 'error'
  if (days < 60) return 'warning'
  return null
}

function DrawerHero({
  detail, selectedId, editMode, canEdit, onClose, onEdit,
}: {
  detail: DeviceDetail | null
  selectedId: number | null
  editMode: boolean
  canEdit: boolean
  onClose: () => void
  onEdit: () => void
}) {
  return (
    <>
    <Box sx={{
      background: 'linear-gradient(140deg, #0B3D6B 0%, #1A6BB5 55%, #4A90D9 100%)',
      px: 2.5, pt: 2.25, pb: 2.25, position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      <Box sx={{ position: 'absolute', top: -44, right: -44, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', bottom: -26, left: 52, width: 90, height: 90, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

      {/* Row 1: back + edit + close (no status chip qui) */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}>
        <Tooltip title="Chiudi">
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Stack direction="row" spacing={0.5}>
          {!editMode && detail && canEdit && (
            <Tooltip title="Modifica">
              <IconButton size="small" onClick={onEdit} sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Chiudi">
            <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Row 2: icona + titolo + status chip sotto */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 1, flexShrink: 0, bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RouterOutlinedIcon sx={{ fontSize: 26, color: 'rgba(255,255,255,0.9)' }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {detail?.model || detail?.type_name || (selectedId ? `Device #${selectedId}` : 'Nuovo device')}
            </Typography>
            {detail?.status_name && (
              <Chip size="small" label={`● ${detail.status_name}`} sx={{ mt: 0.4, bgcolor: 'rgba(93,174,240,0.20)', color: '#93C9F8', fontWeight: 700, fontSize: 10, letterSpacing: '0.07em', border: '1px solid rgba(147,201,248,0.3)', height: 20 }} />
            )}
            {certExpiryAlert(detail?.wifi_detail?.scad_certificato) && (() => {
              const isErr = certExpiryAlert(detail?.wifi_detail?.scad_certificato) === 'error'
              return (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', mt: 0.4,
                  bgcolor: isErr ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)',
                  border: `1px solid ${isErr ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)'}`,
                  borderRadius: 1, px: 0.75, py: 0.15 }}>
                  <Typography sx={{ fontSize: '0.63rem', fontWeight: 700, color: isErr ? '#fca5a5' : '#fcd34d' }}>
                    {isErr ? '⚠ Certificato scaduto' : '⚠ Cert. in scadenza'}
                  </Typography>
                </Box>
              )
            })()}
          </Box>
        </Stack>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
          {detail?.site_display_name || detail?.site_name || ' '}
        </Typography>
        {detail && (detail.vlan || detail.wifi || detail.rispacs) && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
            {detail.vlan    && <Chip size="small" label="VLAN"     sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', '& .MuiChip-label': { px: 0.6 } }} />}
            {detail.wifi    && <Chip size="small" label="WiFi"     sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', '& .MuiChip-label': { px: 0.6 } }} />}
            {detail.rispacs && <Chip size="small" label="RIS/PACS" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', '& .MuiChip-label': { px: 0.6 } }} />}
          </Stack>
        )}
      </Box>
    </Box>

    {/* Logo produttore — sotto l'hero, visibile solo se presente */}
    {detail?.manufacturer_logo_url && (
      <Box sx={{
        px: 2.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0,
      }}>
        <Box
          component="img"
          src={detail.manufacturer_logo_url}
          alt={detail.manufacturer_name ?? 'Logo produttore'}
          sx={{
            height: 32, maxWidth: 140,
            objectFit: 'contain', objectPosition: 'left center',
            display: 'block',
          }}
        />
      </Box>
    )}
    </>
  )
}

// ─── Device form ──────────────────────────────────────────────────────────────

function DeviceForm({
  form, setForm, sites, types, statuses, manufacturers, rispacsList, saving,
  onSave, onCancel,
}: {
  form: DeviceFormState
  setForm: React.Dispatch<React.SetStateAction<DeviceFormState>>
  sites: SiteItem[]
  types: DeviceTypeItem[]
  statuses: LookupItem[]
  manufacturers: ManufacturerItem[]
  rispacsList: RispacsItem[]
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const set = (k: keyof DeviceFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))
  const setSelect = (k: keyof DeviceFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: Number(e.target.value) || '' }))
  const setBool = (k: keyof DeviceFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.checked }))

  const selectedRispacs = rispacsList.filter((r) => (form.rispacs_ids ?? []).includes(r.id))

  const isSm = { size: 'small' as const, fullWidth: true }

  return (
    <Stack spacing={1.25} sx={{ px: 2, py: 1.75 }}>

      {/* Produttore * */}
      <FormField label="Produttore *">
        <TextField {...isSm} select value={form.manufacturer} onChange={setSelect('manufacturer')} error={!form.manufacturer}>
          <MenuItem value=""><em>Seleziona produttore</em></MenuItem>
          {manufacturers.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
        </TextField>
      </FormField>

      {/* Tipo * | Stato * */}
      <Stack direction="row" spacing={1}>
        <FormField label="Tipo *">
          <TextField {...isSm} select value={form.type} onChange={setSelect('type')} error={!form.type}>
            <MenuItem value=""><em>Tipo</em></MenuItem>
            {types.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
          </TextField>
        </FormField>
        <FormField label="Stato *">
          <TextField {...isSm} select value={form.status} onChange={setSelect('status')} error={!form.status}>
            <MenuItem value=""><em>Stato</em></MenuItem>
            {statuses.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
        </FormField>
      </Stack>

      {/* Modello * */}
      <FormField label="Modello *">
        <TextField {...isSm} value={form.model} onChange={set('model')} placeholder="es. PowerEdge R740" />
      </FormField>

      {/* Inventario * | Serial Number */}
      <Stack direction="row" spacing={1}>
        <FormField label="Inventario *">
          <TextField {...isSm} value={form.inventario} onChange={set('inventario')} error={!form.inventario} />
        </FormField>
        <FormField label="Serial Number">
          <TextField {...isSm} value={form.serial_number} onChange={set('serial_number')} />
        </FormField>
      </Stack>

      {/* Sede * */}
      <FormField label="Sede *">
        <TextField {...isSm} select value={form.site} onChange={setSelect('site')} error={!form.site}>
          <MenuItem value=""><em>Seleziona sede</em></MenuItem>
          {sites.map((s) => <MenuItem key={s.id} value={s.id}>{s.display_name || s.name}</MenuItem>)}
        </TextField>
      </FormField>

      {/* Reparto * | Sala */}
      <Stack direction="row" spacing={1}>
        <FormField label="Reparto *">
          <TextField {...isSm} value={form.reparto} onChange={set('reparto')} placeholder="es. Radiologia" error={!form.reparto} />
        </FormField>
        <FormField label="Sala">
          <TextField {...isSm} value={form.room} onChange={set('room')} placeholder="es. Sala 3" />
        </FormField>
      </Stack>

      {/* Posizione */}
      <FormField label="Posizione">
        <TextField {...isSm} value={form.location} onChange={set('location')} placeholder="es. Piano 2, Stanza 14" />
      </FormField>

      {/* IP */}
      <FormField label="Indirizzo IP">
        <TextField {...isSm} value={form.ip} onChange={set('ip')} placeholder="es. 192.168.1.10" inputProps={{ style: { fontFamily: 'monospace' } }} />
      </FormField>

      {/* AETitle */}
      <FormField label="AE Title">
        <TextField {...isSm} value={form.aetitle} onChange={set('aetitle')} placeholder="es. PACS_STATION_01" inputProps={{ style: { fontFamily: 'monospace' } }} />
      </FormField>

      {/* Note */}
      <FormField label="Note">
        <TextField {...isSm} multiline minRows={2} value={form.note} onChange={set('note')} placeholder="Note aggiuntive…" />
      </FormField>

      {/* Flag */}
      <Box>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>Flag</Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          <FormControlLabel control={<Switch size="small" checked={form.vlan} onChange={setBool('vlan')} />} label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>VLAN</Typography>} />
          <FormControlLabel control={<Switch size="small" checked={form.wifi} onChange={setBool('wifi')} />} label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>WiFi</Typography>} />
          <FormControlLabel control={<Switch size="small" checked={form.rispacs} onChange={setBool('rispacs')} />} label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>PACS</Typography>} />
          {types.find((t) => t.id === form.type)?.dose_sr && (
            <FormControlLabel control={<Switch size="small" checked={form.dose} onChange={setBool('dose')} />} label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>DoseSR</Typography>} />
          )}
        </Stack>
      </Box>

      {/* RIS/PACS — visibile solo se rispacs=true */}
      {form.rispacs && (
        <Box sx={{ bgcolor: '#f0f7ff', border: '1px solid rgba(26,107,181,0.18)', borderRadius: 1, p: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            <MedicalServicesOutlinedIcon sx={{ fontSize: 14 }} />Sistemi RIS/PACS
          </Typography>
          <Autocomplete
            multiple
            size="small"
            options={rispacsList}
            value={selectedRispacs}
            getOptionLabel={(o) => `${o.name}${o.ip ? ` (${o.ip})` : ''}${o.aetitle ? ` — ${o.aetitle}` : ''}`}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(_e, val) => setForm((f) => ({ ...f, rispacs_ids: val.map((v) => v.id) }))}
            renderInput={(params) => <TextField {...params} placeholder="Cerca sistema RIS/PACS…" />}
            renderTags={(val, getTagProps) =>
              val.map((opt, idx) => (
                <Chip {...getTagProps({ index: idx })} key={opt.id} label={opt.name} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
              ))
            }
            noOptionsText="Nessun sistema trovato"
          />
        </Box>
      )}

      {/* WiFi — visibile solo se wifi=true */}
      {form.wifi && (
        <Box sx={{ bgcolor: '#f0f7ff', border: '1px solid rgba(26,107,181,0.18)', borderRadius: 1, p: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            <WifiOutlinedIcon sx={{ fontSize: 14 }} />WiFi
          </Typography>
          <Stack spacing={1.5}>
            <FormField label="IP WiFi">
              <TextField {...isSm} value={form.wifi_ip} onChange={set('wifi_ip')} placeholder="es. 192.168.1.20" inputProps={{ style: { fontFamily: 'monospace' } }} />
            </FormField>
            <FormField label="MAC Address">
              <TextField {...isSm} value={form.wifi_mac} onChange={set('wifi_mac')} placeholder="es. AA:BB:CC:DD:EE:FF" inputProps={{ style: { fontFamily: 'monospace' }, maxLength: 17 }} />
            </FormField>
            <FormField label="Password certificato">
              <TextField {...isSm} type="password" value={form.wifi_pass} onChange={set('wifi_pass')} autoComplete="new-password" />
            </FormField>
            <FormField label="Scadenza certificato">
              <TextField {...isSm} type="date" value={form.wifi_scad} onChange={set('wifi_scad')} InputLabelProps={{ shrink: true }} />
            </FormField>
            <FormField label="Certificato (.p12)">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button variant="outlined" size="small" component="label" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {form.wifi_cert_file ? 'Cambia file' : 'Seleziona file'}
                  <input
                    hidden
                    type="file"
                    accept=".p12,.pfx"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      setForm((f) => ({ ...f, wifi_cert_file: file }))
                    }}
                  />
                </Button>
                {form.wifi_cert_file ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {form.wifi_cert_file.name}
                  </Typography>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                    Nessun file selezionato
                  </Typography>
                )}
              </Box>
            </FormField>
          </Stack>
        </Box>
      )}

      <Divider />

      {/* Azioni */}
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button variant="text" size="small" onClick={onCancel} disabled={saving}>
          Annulla
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={onSave}
          disabled={saving || !form.manufacturer || !form.site || !form.type || !form.status}
        >
          Salva
        </Button>
      </Stack>
    </Stack>
  )
}

// ─── WiFi tab (read mode) con password toggle ────────────────────────────────

function WifiTab({ wifiDetail }: { wifiDetail: WifiDetail }) {
  const [showPass, setShowPass] = React.useState(false)

  return (
    <SectionCard icon={<WifiOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="WiFi">
      <DetailRow label="IP WiFi"     value={wifiDetail.ip}               mono copy />
      <DetailRow label="Scad. cert." value={wifiDetail.scad_certificato} mono />

      {/* Password con toggle visibilità */}
      {wifiDetail.pass_certificato && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 90 }}>Password cert.</Typography>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12, letterSpacing: showPass ? 'normal' : '0.15em' }}>
              {showPass ? wifiDetail.pass_certificato : '••••••••'}
            </Typography>
            <Tooltip title={showPass ? 'Nascondi' : 'Mostra'}>
              <IconButton size="small" onClick={() => setShowPass((v) => !v)}>
                {showPass
                  ? <VisibilityOffOutlinedIcon sx={{ fontSize: 14 }} />
                  : <VisibilityOutlinedIcon    sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
            {showPass && (
              <Tooltip title="Copia">
                <IconButton size="small" onClick={() => { void navigator.clipboard.writeText(wifiDetail.pass_certificato!) }}>
                  <ContentCopyIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      )}

      {/* Certificato */}
      {wifiDetail.certificato_url && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 90 }}>Certificato</Typography>
          <Typography
            component="a"
            href={wifiDetail.certificato_url}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ fontWeight: 600, color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            Scarica .p12
          </Typography>
        </Stack>
      )}
    </SectionCard>
  )
}

// ─── WiFi Quick Dialog ────────────────────────────────────────────────────────

interface WifiQuickDialogProps {
  deviceId: number | null
  onClose: () => void
  onSaved: () => void
}

function WifiQuickDialog({ deviceId, onClose, onSaved }: WifiQuickDialogProps) {
  const toast = useToast()
  const [ip, setIp] = React.useState('')
  const [mac, setMac] = React.useState('')
  const [scad, setScad] = React.useState('')
  const [certFile, setCertFile] = React.useState<File | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const certInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (deviceId) { setIp(''); setMac(''); setScad(''); setCertFile(null); setError(null) }
  }, [deviceId])

  const handleSave = async () => {
    if (!deviceId) return
    setError(null)
    setSaving(true)
    try {
      // Prima attiva il flag wifi sul device (PATCH)
      await api.patch(`/devices/${deviceId}/`, { wifi: true })

      // Poi crea/aggiorna il record DeviceWifi via multipart
      const fd = new FormData()
      if (ip) fd.append('ip', ip)
      if (mac) fd.append('mac_address', mac)
      if (scad) fd.append('scad_certificato', scad)
      if (certFile) fd.append('certificato', certFile)

      // Prova PUT su device-wifi esistente, altrimenti POST
      try {
        await api.put(`/device-wifi/${deviceId}/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } catch {
        await api.post('/device-wifi/', (() => {
          fd.append('device', String(deviceId))
          return fd
        })(), { headers: { 'Content-Type': 'multipart/form-data' } })
      }

      toast.success('Configurazione WiFi salvata.')
      onSaved()
    } catch (e: unknown) {
      const data = (e as { response?: { data?: unknown } })?.response?.data
      if (data && typeof data === 'object') {
        const msgs = Object.values(data as Record<string, unknown>)
          .flatMap((v) => (Array.isArray(v) ? v : [v]))
          .join(' ')
        setError(msgs)
      } else {
        setError(apiErrorToMessage(e))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!deviceId} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 15 }}>
        Imposta WiFi
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}
          <TextField
            label="Indirizzo IP WiFi"
            size="small"
            fullWidth
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="es. 192.168.10.20"
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />
          <TextField
            label="MAC Address"
            size="small"
            fullWidth
            value={mac}
            onChange={(e) => setMac(e.target.value)}
            placeholder="es. AA:BB:CC:DD:EE:FF"
            inputProps={{ style: { fontFamily: 'monospace' }, maxLength: 17 }}
          />
          <TextField
            label="Scadenza certificato"
            size="small"
            fullWidth
            type="date"
            value={scad}
            onChange={(e) => setScad(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, display: 'block', mb: 0.5 }}>
              Certificato (.p12)
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => certInputRef.current?.click()} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {certFile ? 'Cambia file' : 'Seleziona file'}
              </Button>
              <input
                hidden
                ref={certInputRef}
                type="file"
                accept=".p12,.pfx"
                onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              />
              <Typography variant="caption" sx={{ color: certFile ? 'text.secondary' : 'text.disabled', fontStyle: certFile ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {certFile ? certFile.name : 'Nessun file selezionato'}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} variant="outlined" size="small">Annulla</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" size="small">
          {saving && <CircularProgress size={14} sx={{ mr: 1 }} color="inherit" />}
          Salva
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// ─── Grafico torta Reparto ────────────────────────────────────────────────────

const PIE_COLORS = ['#1A6BB5', '#6366f1', '#14b8a6', '#f59e0b', '#e24b4a', '#8b5cf6', '#10b981', '#f97316']

function RepartoChart({
  rows,
  repartoF,
  onSelect,
}: {
  rows: DeviceRow[]
  repartoF: string
  onSelect: (v: string) => void
}) {
  const data = React.useMemo(() => {
    const counts: Record<string, number> = {}
    rows.forEach((r) => {
      const key = r.reparto?.trim() || '—'
      counts[key] = (counts[key] ?? 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [rows])

  if (!data.length) {
    return (
      <Box sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: '0.70rem', fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Reparto</Typography>
        <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>Nessun dato</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Titolo */}
      <Box sx={{ px: 1.5, py: 0.9, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Reparto</Typography>
        {repartoF && (
          <Chip size="small" label="✕ reset" onClick={() => onSelect('')}
            sx={{ height: 16, fontSize: '0.60rem', fontWeight: 700, cursor: 'pointer', bgcolor: 'rgba(26,107,181,0.12)', color: 'primary.main', border: '1px solid rgba(26,107,181,0.25)', '& .MuiChip-label': { px: 0.6 }, '&:hover': { bgcolor: 'rgba(26,107,181,0.22)' } }} />
        )}
      </Box>

      {/* Torta + legenda */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, py: 0.5, overflow: 'hidden' }}>
        {/* Pie */}
        <Box sx={{ width: 140, height: '100%', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="30%"
                outerRadius="82%"
                paddingAngle={2}
                dataKey="value"
                onClick={(entry) => {
                  const name = (entry as { name: string }).name
                  onSelect(repartoF === (name === '—' ? '' : name) ? '' : (name === '—' ? '' : name))
                }}
                cursor="pointer"
                stroke="none"
              >
                {data.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                    opacity={repartoF && repartoF !== entry.name ? 0.35 : 1}
                  />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(value: number, name: string) => [value, name]}
                contentStyle={{ fontSize: '0.70rem', borderRadius: 6, border: '1px solid #e2e8f0', padding: '4px 8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>

        {/* Legenda compatta */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.3, overflowY: 'auto', maxHeight: '100%', pr: 0.5 }}>
          {data.map((entry, i) => {
            const color = PIE_COLORS[i % PIE_COLORS.length]
            const active = repartoF === entry.name || (!repartoF)
            return (
              <Box
                key={entry.name}
                onClick={() => onSelect(repartoF === entry.name ? '' : (entry.name === '—' ? '' : entry.name))}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.6, cursor: 'pointer', opacity: active ? 1 : 0.4, transition: 'opacity 0.15s', '&:hover': { opacity: 1 } }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.65rem', color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {entry.name}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', flexShrink: 0 }}>
                  {entry.value}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}

export default function Device() {
  const toast  = useToast()
  const { me } = useAuth()

  // ── Filtri URL ────────────────────────────────────────────────────────────
  const [typeId,         setTypeId]         = useListUrlNumberParam('type')
  const [siteId,         setSiteId]         = useListUrlNumberParam('site')
  const [manufacturerId, setManufacturerId] = useListUrlNumberParam('manufacturer')
  const [repartoF,       setRepartoF]       = useListUrlStringParam('reparto')
  const [wifiF,          setWifiF]          = useListUrlStringParam('wifi')
  const [pacsF,          setPacsF]          = useListUrlStringParam('rispacs')
  const [vlanF,          setVlanF]          = useListUrlStringParam('vlan')
  const [doseF,          setDoseF]          = useListUrlStringParam('dose')

  // ── List ──────────────────────────────────────────────────────────────────

  const grid = useServerGrid({
    defaultOrdering: '-updated_at',
    allowedOrderingFields: ['inventario', 'type_name', 'manufacturer_name', 'model', 'site_display_name', 'reparto', 'room', 'status_name', 'updated_at'],
    defaultPageSize: 25,
  })

  const listParams = React.useMemo(
    () => buildDrfListParams({
      search: grid.search,
      ordering: grid.ordering,
      orderingMap: { type_name: 'type__name', status_name: 'status__name', manufacturer_name: 'manufacturer__name', site_display_name: 'site__name' },
      page0: grid.paginationModel.page,
      pageSize: grid.paginationModel.pageSize,
      extra: {
        ...(typeId         !== '' ? { type: typeId }               : {}),
        ...(siteId         !== '' ? { site: siteId }               : {}),
        ...(manufacturerId !== '' ? { manufacturer: manufacturerId }: {}),
        ...(repartoF               ? { reparto: repartoF }          : {}),
        ...(wifiF   === 'true'     ? { wifi: true }                 : {}),
        ...(pacsF   === 'true'     ? { rispacs: true }              : {}),
        ...(vlanF   === 'true'     ? { vlan: true }                 : {}),
        ...(doseF   === 'true'     ? { dose: true }                 : {}),
      },
    }),
    [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize,
     typeId, siteId, manufacturerId, repartoF, wifiF, pacsF, vlanF, doseF],
  )

  const { rows, rowCount, loading, reload } = useDrfList<DeviceRow>(
    '/devices/', listParams, (e) => toast.error(apiErrorToMessage(e)),
  )

  // Params per il grafico a torta: stessi filtri tranne reparto, pagina unica grande
  const chartParams = React.useMemo(
    () => buildDrfListParams({
      search: grid.search,
      ordering: grid.ordering,
      orderingMap: { type_name: 'type__name', status_name: 'status__name', manufacturer_name: 'manufacturer__name', site_display_name: 'site__name' },
      page0: 0,
      pageSize: 500,
      extra: {
        ...(typeId         !== '' ? { type: typeId }                : {}),
        ...(siteId         !== '' ? { site: siteId }                : {}),
        ...(manufacturerId !== '' ? { manufacturer: manufacturerId } : {}),
        ...(wifiF   === 'true'    ? { wifi: true }                  : {}),
        ...(pacsF   === 'true'    ? { rispacs: true }               : {}),
        ...(vlanF   === 'true'    ? { vlan: true }                  : {}),
        ...(doseF   === 'true'    ? { dose: true }                  : {}),
      },
    }),
    [grid.search, grid.ordering, typeId, siteId, manufacturerId, wifiF, pacsF, vlanF, doseF],
  )

  const { rows: chartRows } = useDrfList<DeviceRow>(
    '/devices/', chartParams, (e) => toast.error(apiErrorToMessage(e)),
  )

  // ── Lookup data ───────────────────────────────────────────────────────────

  const customerId = me?.customer?.id
  const canEdit = me?.auslbo?.can_edit_devices ?? false
  const [sites,         setSites]         = React.useState<SiteItem[]>([])
  const [types,         setTypes]         = React.useState<DeviceTypeItem[]>([])
  const [statuses,      setStatuses]      = React.useState<LookupItem[]>([])
  const [manufacturers, setManufacturers] = React.useState<ManufacturerItem[]>([])
  const [rispacsList,   setRispacsList]   = React.useState<RispacsItem[]>([])

  React.useEffect(() => {
    if (!customerId) return
    void api.get<{ results: SiteItem[] }>('/sites/', { params: { customer: customerId, page_size: 200 } })
      .then((r) => setSites(r.data.results ?? []))
    void api.get<{ results: DeviceTypeItem[] }>('/device-types/', { params: { page_size: 200 } }).then((r) => setTypes(r.data.results ?? []))
    void api.get<{ results: LookupItem[] }>('/device-statuses/',     { params: { page_size: 200 } }).then((r) => setStatuses(r.data.results ?? []))
    void api.get<{ results: ManufacturerItem[] }>('/device-manufacturers/', { params: { page_size: 200 } }).then((r) => setManufacturers(r.data.results ?? []))
    void api.get<{ results: RispacsItem[] }>('/rispacs/',            { params: { page_size: 500 } }).then((r) => setRispacsList(r.data.results ?? []))
  }, [customerId])

  // ── Drawer state ──────────────────────────────────────────────────────────

  // Read-only drawer (usa AuslBoDeviceDrawer standalone)
  const [readDrawerId,   setReadDrawerId]   = React.useState<number | null>(null)

  // Context menu
  const [contextMenu, setContextMenu] = React.useState<{ row: DeviceRow; mouseX: number; mouseY: number } | null>(null)

  // WiFi quick dialog
  const [wifiDialogId, setWifiDialogId] = React.useState<number | null>(null)

  // Create/Edit drawer (nativo con form)
  const [drawerOpen,     setDrawerOpen]     = React.useState(false)
  const [drawerTab,      setDrawerTab]      = React.useState(0)
  const [selectedId,     setSelectedId]     = React.useState<number | null>(null)
  const [detail,         setDetail]         = React.useState<DeviceDetail | null>(null)
  const [detailLoading,  setDetailLoading]  = React.useState(false)
  const [editMode,       setEditMode]       = React.useState(false)
  const [isNew,          setIsNew]          = React.useState(false)
  const [form,           setForm]           = React.useState<DeviceFormState>(emptyForm())
  const [saving,         setSaving]         = React.useState(false)

  // ── Helpers ───────────────────────────────────────────────────────────────

  const detailToForm = (d: DeviceDetail): DeviceFormState => ({
    site:          d.site         ?? '',
    type:          d.type         ?? '',
    status:        d.status       ?? '',
    manufacturer:  d.manufacturer ?? '',
    model:         d.model        ?? '',
    aetitle:       d.aetitle       ?? '',
    serial_number: d.serial_number ?? '',
    inventario:    d.inventario   ?? '',
    reparto:       d.reparto      ?? '',
    room:          d.room         ?? '',
    ip:            d.ip           ?? '',
    note:          d.note          ?? '',
    location:      d.location      ?? '',
    vlan:          d.vlan,
    wifi:          d.wifi,
    rispacs:       d.rispacs,
    dose:          d.dose,
    rispacs_ids:   d.rispacs_links.map((l) => l.rispacs),
    wifi_ip:       d.wifi_detail?.ip ?? '',
    wifi_mac:      d.wifi_detail?.mac_address ?? '',
    wifi_pass:     d.wifi_detail?.pass_certificato ?? '',
    wifi_scad:     d.wifi_detail?.scad_certificato ?? '',
    wifi_cert_file: null,
  })

  const fetchDetail = React.useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await api.get<DeviceDetail>(`/devices/${id}/`)
      setDetail(res.data)
      return res.data
    } catch (e) {
      toast.error(apiErrorToMessage(e))
      return null
    } finally {
      setDetailLoading(false)
    }
  }, [toast])

  const openDrawer = React.useCallback((id: number) => {
    setReadDrawerId(id)
    grid.setOpenId(id)
  }, [grid])

  const openCreate = React.useCallback(() => {
    setSelectedId(null)
    setDetail(null)
    setForm(emptyForm())
    setEditMode(true)
    setIsNew(true)
    setDrawerTab(0)
    setDrawerOpen(true)
    grid.setOpenId(null)
  }, [grid])

  const closeDrawer = React.useCallback(() => {
    setReadDrawerId(null)
    setDrawerOpen(false)
    setSelectedId(null)
    setDetail(null)
    setEditMode(false)
    setIsNew(false)
    grid.setOpenId(null)
  }, [grid])

  // ── Context menu ──────────────────────────────────────────────────────────

  const handleRowContextMenu = React.useCallback(
    (row: DeviceRow, event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault()
      setContextMenu({ row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 })
    },
    [],
  )

  const closeContextMenu = React.useCallback(() => setContextMenu(null), [])

  const contextMenuItems = React.useMemo<RowContextMenuItem[]>(() => {
    const row = contextMenu?.row
    if (!row) return []
    return [
      {
        key: 'open',
        label: 'Apri dettaglio',
        icon: <OpenInNewIcon fontSize="small" />,
        onClick: () => { setReadDrawerId(row.id); grid.setOpenId(row.id) },
      },
      {
        key: 'wifi',
        label: 'Imposta WiFi',
        icon: <WifiPasswordIcon fontSize="small" />,
        onClick: () => setWifiDialogId(row.id),
        hidden: !canEdit,
      },
      {
        key: 'dismiss',
        label: 'Richiedi dismissione',
        icon: <DeleteForeverOutlinedIcon fontSize="small" />,
        onClick: () => toast.info('Funzione non ancora disponibile.'),
        disabled: true,
      },
    ]
  }, [contextMenu, canEdit, grid, toast])

  const startEdit = React.useCallback(() => {
    if (!detail) return
    setForm(detailToForm(detail))
    setEditMode(true)
  }, [detail])

  const cancelEdit = React.useCallback(() => {
    if (isNew) { closeDrawer(); return }
    setEditMode(false)
  }, [isNew, closeDrawer])

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = React.useCallback(async () => {
    if (!customerId) return
    setSaving(true)
    try {
      const payload = {
        customer:      customerId,
        site:          form.site      || undefined,
        type:          form.type      || undefined,
        status:        form.status    || undefined,
        manufacturer:  form.manufacturer || null,
        model:         form.model        || null,
        serial_number: form.serial_number || null,
        inventario:    form.inventario    || null,
        reparto:       form.reparto       || null,
        room:          form.room          || null,
        ip:            form.ip            || null,
        note:          form.note          || null,
        location:      form.location      || null,
        vlan:          form.vlan,
        wifi:          form.wifi,
        rispacs:       form.rispacs,
        dose:          form.dose,
      }

      let savedId: number
      if (isNew) {
        const res = await api.post<DeviceDetail>('/devices/', payload)
        savedId = res.data.id
      } else {
        await api.patch(`/devices/${selectedId!}/`, payload)
        savedId = selectedId!
      }

      // Sincronizza i link RIS/PACS se il flag è attivo
      if (form.rispacs) {
        // Recupera i link attuali
        const linksRes = await api.get<{ results: { id: number; rispacs: number }[] }>(
          '/device-rispacs/', { params: { device: savedId, page_size: 200 } }
        )
        const existing = linksRes.data.results ?? []
        const existingIds  = existing.map((l) => l.rispacs)
        const toAdd    = form.rispacs_ids.filter((id) => !existingIds.includes(id))
        const toRemove = existing.filter((l) => !form.rispacs_ids.includes(l.rispacs))

        await Promise.all([
          ...toAdd.map((rid) => api.post('/device-rispacs/', { device: savedId, rispacs: rid })),
          ...toRemove.map((l) => api.delete(`/device-rispacs/${l.id}/`)),
        ])
      }

      // Sincronizza WiFi se il flag è attivo
      if (form.wifi) {
        const freshDetail = await api.get<DeviceDetail>(`/devices/${savedId}/`)
        const wifiDetail = freshDetail.data.wifi_detail

        // Usa FormData per supportare l'upload del certificato .p12
        const fd = new FormData()
        fd.append('device', String(savedId))
        if (form.wifi_ip)   fd.append('ip', form.wifi_ip)
        if (form.wifi_mac)  fd.append('mac_address', form.wifi_mac)
        if (form.wifi_scad) fd.append('scad_certificato', form.wifi_scad)
        if (form.wifi_pass) fd.append('pass_certificato', form.wifi_pass)
        if (form.wifi_cert_file) fd.append('certificato', form.wifi_cert_file)

        if (wifiDetail) {
          await api.patch(`/device-wifi/${wifiDetail.id}/`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } else {
          await api.post('/device-wifi/', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }
      }

      toast.success(isNew ? 'Device creato con successo.' : 'Device aggiornato.')
      reload()

      // Ricarica il dettaglio e torna in read mode
      const updated = await fetchDetail(savedId)
      if (updated) {
        setSelectedId(savedId)
        setDetail(updated)
      }
      setEditMode(false)
      setIsNew(false)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSaving(false)
    }
  }, [customerId, form, isNew, selectedId, reload, fetchDetail, toast])

  // ── URL open ──────────────────────────────────────────────────────────────

  const lastOpenRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!grid.openId) return
    const id = grid.openId
    if (lastOpenRef.current === id) return
    lastOpenRef.current = id
    void openDrawer(id)
  }, [grid.openId, openDrawer])

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const hasRispacs = detail?.rispacs === true
  const hasWifi    = detail?.wifi === true

  const columns   = React.useMemo(() => cols, [])

  // ── KPI ───────────────────────────────────────────────────────────────────
  const totalDevices = rowCount
  const pacsCount    = rows.filter((r) => r.rispacs).length
  const pacsPercent  = totalDevices > 0 ? Math.round((pacsCount / totalDevices) * 100) : 0

  // Mini-grid cols


  const emptyState = React.useMemo(() => {
    if (!grid.search.trim()) return { title: 'Nessun risultato', subtitle: 'Nessun risultato secondo i filtri applicati.' }
    return { title: 'Nessun risultato', subtitle: 'Prova a cambiare i termini di ricerca.' }
  }, [grid.search])

  // ── Render ────────────────────────────────────────────────────────────────

  // KPI card renderer
  const KpiCard = ({ label, value, sub, accent }: { label: string; value: string | number; sub: string; accent: string }) => (
    <Box sx={{
      position: 'relative', overflow: 'hidden', borderRadius: '8px',
      p: '10px 14px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      backgroundImage: `linear-gradient(135deg, ${accent}99 0%, ${accent}ee 100%)`,
      border: `1px solid ${accent}40`,
      boxShadow: `0 8px 20px ${accent}30`,
      '&::before': { content: '""', position: 'absolute', width: 70, height: 70, borderRadius: '50%', right: -18, top: -18, backgroundColor: 'rgba(255,255,255,0.14)' },
    }}>
      <Box sx={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.70rem', fontWeight: 700, color: 'rgba(255,255,255,0.88)', mb: '4px', lineHeight: 1.2 }}>{label}</Typography>
        <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: -0.5 }}>{value}</Typography>
        <Typography sx={{ fontSize: '0.66rem', fontWeight: 600, color: 'rgba(255,255,255,0.72)', mt: '3px' }}>{sub}</Typography>
      </Box>
    </Box>
  )

  return (
    <Stack spacing={1.5} sx={{ height: '100%' }}>

      {/* ── Riga superiore: 3 mini-grid + colonna KPI (2 impilate) + placeholder ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 1.5, alignItems: 'stretch' }}>

        {/* Mini-grid Sedi */}
        <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 1.5, py: 0.9, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Sedi</Typography>
            {siteId !== '' && (
              <Chip size="small" label="✕ reset" onClick={() => setSiteId('')}
                sx={{ height: 16, fontSize: '0.60rem', fontWeight: 700, cursor: 'pointer', bgcolor: 'rgba(26,107,181,0.12)', color: 'primary.main', border: '1px solid rgba(26,107,181,0.25)', '& .MuiChip-label': { px: 0.6 }, '&:hover': { bgcolor: 'rgba(26,107,181,0.22)' } }} />
            )}
          </Box>
          <Box sx={{
            maxHeight: 180,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}>
            {sites.map((s) => ({ id: s.id, name: s.display_name || s.name })).map((row) => {
              const active = siteId === row.id
              return (
                <Box
                  key={row.id}
                  onClick={() => setSiteId(active ? '' : row.id)}
                  sx={{
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    px: 1.5,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    bgcolor: active ? 'rgba(26,107,181,0.22)' : 'transparent',
                    '&:hover': { bgcolor: active ? 'rgba(26,107,181,0.28)' : 'rgba(26,107,181,0.07)' },
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.name}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Mini-grid Tipi */}
        <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 1.5, py: 0.9, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Tipi</Typography>
            {typeId !== '' && (
              <Chip size="small" label="✕ reset" onClick={() => setTypeId('')}
                sx={{ height: 16, fontSize: '0.60rem', fontWeight: 700, cursor: 'pointer', bgcolor: 'rgba(26,107,181,0.12)', color: 'primary.main', border: '1px solid rgba(26,107,181,0.25)', '& .MuiChip-label': { px: 0.6 }, '&:hover': { bgcolor: 'rgba(26,107,181,0.22)' } }} />
            )}
          </Box>
          <Box sx={{
            maxHeight: 180,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}>
            {types.map((t) => ({ id: t.id, name: t.name })).map((row) => {
              const active = typeId === row.id
              return (
                <Box
                  key={row.id}
                  onClick={() => setTypeId(active ? '' : row.id)}
                  sx={{
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    px: 1.5,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    bgcolor: active ? 'rgba(26,107,181,0.22)' : 'transparent',
                    '&:hover': { bgcolor: active ? 'rgba(26,107,181,0.28)' : 'rgba(26,107,181,0.07)' },
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.name}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Mini-grid Produttori */}
        <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 1.5, py: 0.9, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Produttori</Typography>
            {manufacturerId !== '' && (
              <Chip size="small" label="✕ reset" onClick={() => setManufacturerId('')}
                sx={{ height: 16, fontSize: '0.60rem', fontWeight: 700, cursor: 'pointer', bgcolor: 'rgba(26,107,181,0.12)', color: 'primary.main', border: '1px solid rgba(26,107,181,0.25)', '& .MuiChip-label': { px: 0.6 }, '&:hover': { bgcolor: 'rgba(26,107,181,0.22)' } }} />
            )}
          </Box>
          <Box sx={{
            maxHeight: 180,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}>
            {manufacturers.map((m) => ({ id: m.id, name: m.name })).map((row) => {
              const active = manufacturerId === row.id
              return (
                <Box
                  key={row.id}
                  onClick={() => setManufacturerId(active ? '' : row.id)}
                  sx={{
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    px: 1.5,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    bgcolor: active ? 'rgba(26,107,181,0.22)' : 'transparent',
                    '&:hover': { bgcolor: active ? 'rgba(26,107,181,0.28)' : 'rgba(26,107,181,0.07)' },
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.name}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Colonna KPI: 2 card impilate, ognuna alta metà della mini-grid */}
        <Stack spacing={1} sx={{ height: '100%' }}>
          <KpiCard
            label="Totale Device"
            value={loading ? '…' : totalDevices}
            sub="nel tuo ente"
            accent="#1A6BB5"
          />
          <KpiCard
            label="Device con PACS"
            value={loading ? '…' : `${pacsPercent}%`}
            sub={loading ? '' : `${pacsCount} su ${totalDevices}`}
            accent="#6366f1"
          />
        </Stack>

        {/* Grafico torta Reparto */}
        <RepartoChart rows={chartRows} repartoF={repartoF} onSelect={setRepartoF} />
      </Box>

      <EntityListCard
        mobileCard={renderDeviceCard}
        toolbar={{
          compact: true,
          q: grid.q,
          onQChange: grid.setQ,
          rightActions: (
            <Stack direction="row" spacing={0.5} alignItems="center">
              {([
                { key: 'wifi', label: 'WiFi',   val: wifiF, set: setWifiF },
                { key: 'pacs', label: 'PACS',   val: pacsF, set: setPacsF },
                { key: 'vlan', label: 'VLAN',   val: vlanF, set: setVlanF },
                { key: 'dose', label: 'DoseSR', val: doseF, set: setDoseF },
              ] as { key: string; label: string; val: string; set: (v: string) => void }[]).map(({ key, label, val, set }) => (
                <Chip
                  key={key}
                  size="small"
                  label={label}
                  onClick={() => set(val === 'true' ? '' : 'true')}
                  sx={{
                    height: 24, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                    bgcolor: val === 'true' ? 'rgba(26,107,181,0.18)' : 'transparent',
                    color: val === 'true' ? 'primary.main' : 'text.disabled',
                    border: '1px solid',
                    borderColor: val === 'true' ? 'rgba(26,107,181,0.40)' : 'divider',
                    '& .MuiChip-label': { px: 0.75 },
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </Stack>
          ),
        }}
        grid={{
          pageKey: 'auslbo-device',
          emptyState,
          rows,
          columns,
          loading,
          rowCount,
          paginationModel: grid.paginationModel,
          onPaginationModelChange: grid.onPaginationModelChange,
          sortModel: grid.sortModel,
          onSortModelChange: grid.onSortModelChange,
          onRowClick: openDrawer,
          onRowContextMenu: handleRowContextMenu,
          sx: {
            '--DataGrid-rowHeight': '36px',
            '--DataGrid-headerHeight': '35px',
            '& .MuiDataGrid-cell': { py: 0.25 },
            '& .MuiDataGrid-columnHeader': { py: 0.75 },
            '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(26,107,181,0.02)' },
            '& .MuiDataGrid-row:hover': { backgroundColor: 'rgba(26,107,181,0.06)' },
            '& .MuiDataGrid-row.Mui-selected': { backgroundColor: 'rgba(26,107,181,0.10) !important' },
            '& .MuiDataGrid-row.Mui-selected:hover': { backgroundColor: 'rgba(26,107,181,0.14) !important' },
          },
        }}
      />

      {/* FAB — solo per utenti con permesso edit */}
      {canEdit && <Fab
        color="primary"
        aria-label="Nuovo device"
        onClick={openCreate}
        sx={{
          position: 'fixed',
          right: { xs: 16, md: 24 },
          bottom: { xs: 16, md: 20 },
          zIndex: (t) => t.zIndex.appBar - 1,
          width: 52,
          height: 52,
          boxShadow: '0 8px 24px rgba(26,107,181,0.35)',
        }}
      >
        <AddIcon sx={{ fontSize: 26 }} />
      </Fab>}

      {/* Read-only drawer (standalone) */}
      <AuslBoDeviceDrawer
        id={readDrawerId}
        onClose={() => { setReadDrawerId(null); grid.setOpenId(null) }}
      />

      {/* Context menu tasto destro */}
      <RowContextMenu
        open={Boolean(contextMenu)}
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        onClose={closeContextMenu}
        items={contextMenuItems}
      />

      {/* WiFi quick dialog */}
      <WifiQuickDialog
        deviceId={wifiDialogId}
        onClose={() => setWifiDialogId(null)}
        onSaved={() => { setWifiDialogId(null); reload() }}
      />

      {/* Detail / Edit Drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}>
        <Stack sx={{ height: '100%', overflow: 'hidden' }}>

          {/* Hero */}
          <DrawerHero
            detail={detail}
            selectedId={selectedId}
            editMode={editMode}
            canEdit={canEdit}
            onClose={closeDrawer}
            onEdit={startEdit}
          />

          {detailLoading && <LinearProgress sx={{ height: 2 }} />}

          {/* Tabs — solo in read mode */}
          {!editMode && (
            <Tabs value={drawerTab} onChange={(_, v: number) => setDrawerTab(v)}
              sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, px: 1 }}>
              <Tab label="Dettagli" sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
              {hasRispacs && <Tab label="RIS/PACS" sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />}
              {hasWifi    && <Tab label="WiFi"     sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />}
            </Tabs>
          )}

          {/* Body */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>

            {/* ── FORM (create / edit) ── */}
            {editMode && (
              <DeviceForm
                form={form}
                setForm={setForm}
                sites={sites}
                types={types}
                statuses={statuses}
                manufacturers={manufacturers}
                rispacsList={rispacsList}
                saving={saving}
                onSave={handleSave}
                onCancel={cancelEdit}
              />
            )}

            {/* ── READ MODE ── */}
            {!editMode && (
              <Box sx={{ px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {detailLoading ? (
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" sx={{ opacity: 0.7 }}>Caricamento…</Typography>
                  </Stack>
                ) : detail ? (
                  <>
                    {/* TAB 0 — Dettagli */}
                    {drawerTab === 0 && (
                      <>
                        <SectionCard icon={<FingerprintIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Identificazione">
                          <DetailRow label="AE Title"   value={detail.aetitle}       mono copy />
                          <DetailRow label="Seriale"    value={detail.serial_number} mono copy />
                          <DetailRow label="Inventario" value={detail.inventario}    mono copy />
                          <DetailRow label="Reparto"    value={detail.reparto} />
                          <DetailRow label="Stanza/Sala" value={detail.room} />
                          <DetailRow label="Posizione"  value={detail.location} />
                          <DetailRow label="Sede"       value={detail.site_display_name || detail.site_name} />
                        </SectionCard>

                        {detail.ip && (
                          <SectionCard icon={<WifiOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Rete">
                            <DetailRow label="IP cablato" value={detail.ip} mono copy />
                          </SectionCard>
                        )}

                        {(detail.manufacturer_name || detail.model || detail.type_name) && (
                          <SectionCard icon={<MemoryOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Hardware">
                            <DetailRow label="Produttore" value={detail.manufacturer_name} />
                            <DetailRow label="Modello"    value={detail.model} />
                            <DetailRow label="Tipo"       value={detail.type_name} />
                          </SectionCard>
                        )}

                        {detail.note && (
                          <Box sx={{ bgcolor: '#fafafa', border: '1px solid', borderColor: 'grey.100', borderRadius: 1, p: 1.75 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mb: 0.75 }}>
                              Note
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.note}</Typography>
                          </Box>
                        )}

                        {detail.custom_fields && Object.entries(detail.custom_fields).filter(([, v]) => v != null && v !== '').length > 0 && (
                          <Box sx={{ bgcolor: '#fafafa', border: '1px solid', borderColor: 'grey.100', borderRadius: 1, p: 1.75 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mb: 0.75 }}>
                              Informazioni aggiuntive
                            </Typography>
                            <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                              {Object.entries(detail.custom_fields).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                                <Stack key={k} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75 }}>
                                  <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 90 }}>{k}</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{String(v)}</Typography>
                                </Stack>
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </>
                    )}

                    {/* TAB 1 — RIS/PACS */}
                    {drawerTab === 1 && hasRispacs && (
                      <Stack spacing={1.5}>
                        {detail.rispacs_links.length === 0 && (
                          <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic', py: 1 }}>Nessun sistema RIS/PACS collegato.</Typography>
                        )}
                        {detail.rispacs_links.map((r, idx) => (
                          <Box key={r.id} sx={{ bgcolor: '#f8fafc', border: '1px solid', borderColor: 'grey.200', borderRadius: 1, p: 1.75 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                              <MedicalServicesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                              {r.rispacs_name || `RIS/PACS ${idx + 1}`}
                            </Typography>
                            <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                              <DetailRow label="Nome"     value={r.rispacs_name} />
                              <DetailRow label="IP"       value={r.rispacs_ip}    mono copy />
                              <DetailRow label="Porta"    value={r.rispacs_port != null ? String(r.rispacs_port) : null} mono />
                              <DetailRow label="AE Title" value={r.rispacs_aetitle} mono copy />
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    )}

                    {/* TAB WiFi */}
                    {((drawerTab === 2 && hasRispacs) || (drawerTab === 1 && !hasRispacs)) && hasWifi && (
                      detail.wifi_detail
                        ? <WifiTab wifiDetail={detail.wifi_detail} />
                        : <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic', py: 1 }}>Nessun dato WiFi ancora configurato.</Typography>
                    )}
                  </>
                ) : (
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>Nessun dettaglio disponibile.</Typography>
                )}
              </Box>
            )}
          </Box>
        </Stack>
      </Drawer>
    </Stack>
  )
}
