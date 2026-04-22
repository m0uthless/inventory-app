import * as React from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Menu,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined'
import DownloadIcon from '@mui/icons-material/Download'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'

import { useAuth } from '../auth/AuthProvider'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import {
  fetchVlans,
  fetchVlanIpPool,
  createVlan,
  updateVlan,
  deleteVlan,
  type VlanRow,
  type VlanPayload,
  type IpPoolEntry,
  type UsedByType,
} from '../api/vlanApi'
import { apiGet } from '../api/client'
import AuslBoInventoryDrawer from '../ui/AuslBoInventoryDrawer'
import AuslBoDeviceDrawer from '../ui/AuslBoDeviceDrawer'
import {
  createVlanIpRequest,
  MODALITA_OPTIONS,
  type RispacsLite,
  type RequestModalita,
} from '../api/vlanRequestApi'
import { excludeVlanIp, unexcludeVlanIp } from '../api/vlanApi'

// ─── Types per il drawer IP ───────────────────────────────────────────────────

type IpDrawerState = {
  open: boolean
  ip: string
  usedByType: UsedByType
  usedById: number | null
  usedByName: string | null
}

type DeviceTypeLite   = { id: number; name: string }
type ManufacturerLite = { id: number; name: string }

// ─── IpRequestDialog — richiesta nuova modalità su IP libero ─────────────────

interface RispacsRow {
  rispacs: RispacsLite | null
  etichetta: RequestModalita
}

interface IpRequestDialogProps {
  entry: IpPoolEntry | null
  vlan: VlanRow | null
  customerId: number
  onClose: () => void
  onSaved: () => void
}

function IpRequestDialog({ entry, vlan, customerId, onClose, onSaved }: IpRequestDialogProps) {
  const toast = useToast()
  const [rispacsList, setRispacsList] = React.useState<RispacsLite[]>([])
  const [rispacsRows, setRispacsRows] = React.useState<RispacsRow[]>([])
  const [modalita, setModalita] = React.useState<string>('')
  const [aetitle, setAetitle] = React.useState('')
  const [note, setNote] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [loadingRispacs, setLoadingRispacs] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Nuovi campi
  const [siteId, setSiteId]               = React.useState<number | ''>('')
  const [reparto, setReparto]             = React.useState('')
  const [deviceTypeId, setDeviceTypeId]   = React.useState<number | ''>('')
  const [manufacturerId, setManufacturerId] = React.useState<number | ''>('')
  const [deviceTypes, setDeviceTypes]     = React.useState<DeviceTypeLite[]>([])
  const [manufacturers, setManufacturers] = React.useState<ManufacturerLite[]>([])
  const [loadingLookups, setLoadingLookups] = React.useState(false)

  React.useEffect(() => {
    if (!entry) return
    setRispacsRows([])
    setModalita('')
    setAetitle('')
    setNote('')
    // Preimposta la sede dalla VLAN
    setSiteId(vlan?.site ?? '')
    setReparto('')
    setDeviceTypeId('')
    setManufacturerId('')
    setError(null)

    setLoadingRispacs(true)
    setLoadingLookups(true)

    apiGet<{ results: RispacsLite[] }>('/rispacs/', { params: { page_size: 200 } })
      .then((res) => setRispacsList(res.results))
      .catch(() => setRispacsList([]))
      .finally(() => setLoadingRispacs(false))

    Promise.all([
      apiGet<{ results: DeviceTypeLite[] }>('/device-types/', { params: { page_size: 200 } }),
      apiGet<{ results: ManufacturerLite[] }>('/device-manufacturers/', { params: { page_size: 200 } }),
    ])
      .then(([t, m]) => {
        setDeviceTypes(t.results)
        setManufacturers(m.results)
      })
      .catch(() => {})
      .finally(() => setLoadingLookups(false))
  }, [entry, customerId, vlan])

  const addRow = () =>
    setRispacsRows((rows) => [...rows, { rispacs: null, etichetta: 'pacs' }])

  const removeRow = (i: number) =>
    setRispacsRows((rows) => rows.filter((_, idx) => idx !== i))

  const updateRow = (i: number, patch: Partial<RispacsRow>) =>
    setRispacsRows((rows) => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const handleSave = async () => {
    if (!entry || !vlan) return
    setError(null)
    setSaving(true)
    try {
      const config = rispacsRows
        .filter((r) => r.rispacs !== null)
        .map((r) => ({ rispacs_id: r.rispacs!.id, etichetta: r.etichetta }))

      await createVlanIpRequest({
        customer: customerId,
        vlan: vlan.id,
        ip: entry.ip,
        aetitle: aetitle.trim() || null,
        modalita: modalita.trim() as RequestModalita || 'altro',
        rispacs: config.map((c) => c.rispacs_id),
        rispacs_config: config,
        site: siteId || null,
        reparto: reparto.trim() || null,
        device_type: deviceTypeId || null,
        manufacturer: manufacturerId || null,
        note: note.trim() || null,
      })
      toast.success(`Richiesta per ${entry.ip} inviata.`)
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
    <Dialog open={!!entry} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 15 }}>
        Richiesta nuova modalità
        {entry && (
          <Typography component="span" sx={{ ml: 1, fontSize: 12, color: 'text.secondary', fontWeight: 400 }}>
            IP: <strong style={{ fontFamily: 'monospace' }}>{entry.ip}</strong>
            {vlan && ` — ${vlan.name}`}
          </Typography>
        )}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2.5}>
          {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}

          <TextField
            label="Modalità"
            size="small"
            fullWidth
            value={modalita}
            onChange={(e) => setModalita(e.target.value as RequestModalita)}
            placeholder="es. PACS, Worklist, Altro..."
          />

          <TextField
            select
            label="Tipo Device"
            size="small"
            fullWidth
            value={deviceTypeId}
            onChange={(e) => setDeviceTypeId(Number(e.target.value) || '')}
            disabled={loadingLookups}
          >
            <MenuItem value=""><em>— Nessuno —</em></MenuItem>
            {deviceTypes.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Produttore"
            size="small"
            fullWidth
            value={manufacturerId}
            onChange={(e) => setManufacturerId(Number(e.target.value) || '')}
            disabled={loadingLookups}
          >
            <MenuItem value=""><em>— Nessuno —</em></MenuItem>
            {manufacturers.map((m) => (
              <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Reparto"
            size="small"
            fullWidth
            value={reparto}
            onChange={(e) => setReparto(e.target.value)}
            placeholder="es. Radiologia"
          />

          <TextField
            label="AETitle"
            size="small"
            fullWidth
            value={aetitle}
            onChange={(e) => setAetitle(e.target.value)}
            placeholder="es. PACS_STATION_01"
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>
                Sistemi RIS/PACS
              </Typography>
              <Tooltip title="Aggiungi sistema">
                <IconButton
                  size="small"
                  onClick={addRow}
                  disabled={loadingRispacs}
                  sx={{ bgcolor: 'rgba(26,107,181,0.08)', color: 'primary.main', '&:hover': { bgcolor: 'rgba(26,107,181,0.16)' } }}
                >
                  <AddIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>

            {rispacsRows.length === 0 && (
              <Typography sx={{ fontSize: 12, color: 'text.disabled', fontStyle: 'italic' }}>
                Nessun sistema aggiunto — clicca + per aggiungerne uno.
              </Typography>
            )}

            <Stack spacing={1}>
              {rispacsRows.map((row, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <Autocomplete
                    size="small"
                    sx={{ flex: 2 }}
                    options={rispacsList}
                    loading={loadingRispacs}
                    value={row.rispacs}
                    getOptionLabel={(o) => `${o.name}${o.ip ? ` (${o.ip})` : ''}`}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    onChange={(_e, val) => updateRow(i, { rispacs: val })}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Cerca sistema..." />
                    )}
                    noOptionsText="Nessun sistema disponibile"
                  />
                  <TextField
                    select
                    size="small"
                    sx={{ flex: 1 }}
                    value={row.etichetta}
                    onChange={(e) => updateRow(i, { etichetta: e.target.value as RequestModalita })}
                  >
                    {MODALITA_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </TextField>
                  <IconButton size="small" color="error" onClick={() => removeRow(i)}>
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>

          <TextField
            label="Note"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} variant="outlined" size="small">Annulla</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" size="small">
          {saving && <CircularProgress size={14} sx={{ mr: 1 }} color="inherit" />}
          Invia richiesta
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ipCellColor(entry: IpPoolEntry): {
  bg: string
  text: string
  border: string
} {
  switch (entry.kind) {
    case 'network':
    case 'broadcast':
      return { bg: '#F1EFE8', text: '#5F5E5A', border: '#D3D1C7' }
    case 'gateway':
      return { bg: '#E6F1FB', text: '#185FA5', border: '#B5D4F4' }
    default:
      if (entry.status === 'used')     return { bg: '#FCEBEB', text: '#A32D2D', border: '#F7C1C1' }
      if (entry.status === 'reserved') return { bg: '#FAEEDA', text: '#854F0B', border: '#FAC775' }
      if (entry.status === 'excluded') return { bg: '#FCEBEB', text: '#A32D2D', border: '#F7C1C1' }
      return { bg: '#EAF3DE', text: '#3B6D11', border: '#C0DD97' }
  }
}

function ipCellLabel(entry: IpPoolEntry): string {
  if (entry.kind === 'network') return 'NET'
  if (entry.kind === 'broadcast') return 'BCT'
  if (entry.kind === 'gateway') return 'GW'
  return ''
}

function calcOccupazione(vlan: VlanRow): number {
  if (!vlan.total_hosts) return 0
  return Math.round((vlan.used_count / vlan.total_hosts) * 100)
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  color,
  sub,
}: {
  label: string
  value: number | string
  color: string
  sub?: string
}) {
  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden', borderRadius: '8px',
      p: '10px 14px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      backgroundImage: `linear-gradient(135deg, ${color}99 0%, ${color}ee 100%)`,
      border: `1px solid ${color}40`,
      boxShadow: `0 8px 20px ${color}30`,
      '&::before': { content: '""', position: 'absolute', width: 70, height: 70, borderRadius: '50%', right: -18, top: -18, backgroundColor: 'rgba(255,255,255,0.14)' },
    }}>
      <Box sx={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.70rem', fontWeight: 700, color: 'rgba(255,255,255,0.88)', mb: '4px', lineHeight: 1.2 }}>{label}</Typography>
        <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: -0.5 }}>{value}</Typography>
        {sub && <Typography sx={{ fontSize: '0.66rem', fontWeight: 600, color: 'rgba(255,255,255,0.72)', mt: '3px' }}>{sub}</Typography>}
      </Box>
    </Box>
  )
}

// ─── IP Cell ──────────────────────────────────────────────────────────────────

function IpCell({ entry, onClick, onContextMenu }: { entry: IpPoolEntry; onClick?: (e: IpPoolEntry) => void; onContextMenu?: (e: React.MouseEvent, entry: IpPoolEntry) => void }) {
  const { bg, text, border } = ipCellColor(entry)
  const label = ipCellLabel(entry)

  const tooltipContent =
    entry.kind === 'network'
      ? 'Indirizzo di rete'
      : entry.kind === 'broadcast'
      ? 'Indirizzo broadcast'
      : entry.kind === 'gateway'
      ? 'Gateway'
      : entry.status === 'used'
      ? `Occupato — ${entry.used_by ?? ''}${entry.used_by_type ? ` (${entry.used_by_type})` : ''}`
      : entry.status === 'reserved'
      ? `Riservato — richiesta in attesa`
      : entry.status === 'excluded'
      ? `Escluso — tasto destro per rimuovere l'esclusione`
      : 'Libero — clicca per richiedere'

  const isClickable = entry.kind === 'host' && (entry.status === 'used' || entry.status === 'free') && !!onClick
  const isContextable = entry.kind === 'host' && !!onContextMenu

  return (
    <Tooltip title={tooltipContent} placement="top" arrow>
      <Box
        onClick={isClickable ? () => onClick(entry) : undefined}
        onContextMenu={isContextable ? (e) => { e.preventDefault(); onContextMenu(e, entry) } : undefined}
        sx={{
          width: 90,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '3px',
          border: `1px solid ${border}`,
          bgcolor: bg,
          cursor: isClickable ? 'pointer' : 'default',
          position: 'relative',
          '&:hover': isClickable
            ? { opacity: 0.75, transform: 'scale(1.06)', transition: 'all 80ms', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
            : { opacity: 0.82, transform: 'scale(1.04)', transition: 'all 80ms' },
        }}
      >
        <Typography sx={{ fontSize: 9, fontWeight: 600, color: text, letterSpacing: '0.02em' }}>
          {entry.ip}
        </Typography>
        {label && (
          <Box
            sx={{
              position: 'absolute',
              top: -1,
              right: -1,
              bgcolor: border,
              borderRadius: '0 3px 0 3px',
              px: '3px',
              lineHeight: 1.4,
            }}
          >
            <Typography sx={{ fontSize: 7, fontWeight: 700, color: text }}>{label}</Typography>
          </Box>
        )}
        {entry.status === 'excluded' && (
          <Box sx={{
            position: 'absolute', inset: 0, borderRadius: '3px',
            background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(163,45,45,0.18) 3px, rgba(163,45,45,0.18) 4px)',
            pointerEvents: 'none',
          }} />
        )}
      </Box>
    </Tooltip>
  )
}

// ─── VLAN Card ────────────────────────────────────────────────────────────────

function VlanCard({
  vlan,
  canManage,
  customerId,
  onEdit,
  onDelete,
  onRequestSaved,
}: {
  vlan: VlanRow
  canManage: boolean
  customerId: number
  onEdit: (v: VlanRow) => void
  onDelete: (v: VlanRow) => void
  onRequestSaved: () => void
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [pool, setPool] = React.useState<IpPoolEntry[] | null>(null)
  const [loadingPool, setLoadingPool] = React.useState(false)
  const [poolError, setPoolError] = React.useState<string | null>(null)
  const [ipDrawer, setIpDrawer] = React.useState<IpDrawerState>({
    open: false, ip: '', usedByType: null, usedById: null, usedByName: null,
  })
  const [requestDialogEntry, setRequestDialogEntry] = React.useState<IpPoolEntry | null>(null)

  // Context menu su IP
  const [ctxMenu, setCtxMenu] = React.useState<{ mouseX: number; mouseY: number; entry: IpPoolEntry } | null>(null)
  const [ctxBusy, setCtxBusy] = React.useState(false)
  const toast = useToast()

  const handleContextMenu = (e: React.MouseEvent, entry: IpPoolEntry) => {
    setCtxMenu({ mouseX: e.clientX, mouseY: e.clientY, entry })
  }

  const handleExclude = async () => {
    if (!ctxMenu) return
    const { entry } = ctxMenu
    setCtxMenu(null)
    setCtxBusy(true)
    try {
      await excludeVlanIp(vlan.id, entry.ip)
      toast.success(`IP ${entry.ip} escluso.`)
      setPool(null)
      const data = await fetchVlanIpPool(vlan.id)
      setPool(data)
    } catch {
      toast.error("Errore durante l'esclusione.")
    } finally {
      setCtxBusy(false)
    }
  }

  const handleUnexclude = async () => {
    if (!ctxMenu) return
    const { entry } = ctxMenu
    setCtxMenu(null)
    setCtxBusy(true)
    try {
      await unexcludeVlanIp(vlan.id, entry.ip)
      toast.success(`Esclusione di ${entry.ip} rimossa.`)
      setPool(null)
      const data = await fetchVlanIpPool(vlan.id)
      setPool(data)
    } catch {
      toast.error("Errore durante la rimozione dell'esclusione.")
    } finally {
      setCtxBusy(false)
    }
  }

  const handleIpClick = (entry: IpPoolEntry) => {
    if (entry.status === 'free') {
      setRequestDialogEntry(entry)
    } else {
      setIpDrawer({
        open: true,
        ip: entry.ip,
        usedByType: entry.used_by_type,
        usedById: entry.used_by_id,
        usedByName: entry.used_by,
      })
    }
  }

  const occ = calcOccupazione(vlan)
  const occColor = occ > 80 ? '#A32D2D' : occ > 50 ? '#BA7517' : '#3B6D11'

  const handleToggle = async () => {
    if (!expanded && pool === null) {
      setLoadingPool(true)
      setPoolError(null)
      try {
        const data = await fetchVlanIpPool(vlan.id)
        setPool(data)
      } catch (e) {
        setPoolError(apiErrorToMessage(e))
      } finally {
        setLoadingPool(false)
      }
    }
    setExpanded((v) => !v)
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {/* Header — cliccabile per aprire/chiudere la heatmap */}
      <Box
        onClick={handleToggle}
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { bgcolor: 'grey.100' },
          transition: 'background-color 150ms ease',
        }}
      >
        {/* VLAN ID badge */}
        <Chip
          label={`VLAN ${vlan.vlan_id}`}
          size="small"
          sx={{
            bgcolor: '#E6F1FB',
            color: '#185FA5',
            fontWeight: 700,
            fontSize: 11,
            height: 22,
          }}
        />

        {/* Nome e metadati */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>
            {vlan.name}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
            {vlan.network} &nbsp;|&nbsp; mask {vlan.subnet} &nbsp;|&nbsp; gw {vlan.gateway}
            {vlan.lan ? ` | LAN ${vlan.lan}` : ''}
          </Typography>
        </Box>

        {/* Contatori */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#3B6D11', lineHeight: 1 }}>
              {vlan.free_count}
            </Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>liberi</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#A32D2D', lineHeight: 1 }}>
              {vlan.used_count}
            </Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>occupati</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary', lineHeight: 1 }}>
              {vlan.total_hosts}
            </Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>totali</Typography>
          </Box>
        </Stack>

        {/* Azioni */}
        <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
          {canManage && (
            <>
              <Tooltip title="Modifica VLAN">
                <IconButton size="small" onClick={() => onEdit(vlan)}>
                  <EditOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Elimina VLAN">
                <IconButton size="small" color="error" onClick={() => onDelete(vlan)}>
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title={expanded ? 'Chiudi heatmap' : 'Espandi heatmap IP'}>
            <IconButton size="small" onClick={handleToggle}>
              {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Barra occupazione */}
      <Box sx={{ px: 2, pt: 0.75, pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
            Occupazione
          </Typography>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: occColor }}>
            {occ}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={occ}
          sx={{
            height: 4,
            borderRadius: 2,
            bgcolor: '#EAF3DE',
            '& .MuiLinearProgress-bar': { bgcolor: occColor, borderRadius: 2 },
          }}
        />
      </Box>

      {/* Heatmap IP */}
      <Collapse in={expanded} timeout={200}>
        <Box sx={{ px: 2, py: 1.5 }}>
          {/* Legenda */}
          <Stack direction="row" spacing={2} sx={{ mb: 1.25, flexWrap: 'wrap', gap: 1 }}>
            {[
              { color: '#C0DD97', label: 'Libero' },
              { color: '#FAC775', label: 'Riservato' },
              { color: '#F7C1C1', label: 'Occupato / Escluso' },
              { color: '#B5D4F4', label: 'Gateway' },
              { color: '#D3D1C7', label: 'Net / Broadcast' },
            ].map((l) => (
              <Stack key={l.label} direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: l.color, border: '1px solid rgba(0,0,0,0.12)' }} />
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{l.label}</Typography>
              </Stack>
            ))}
          </Stack>

          {loadingPool && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
              <CircularProgress size={14} />
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Caricamento pool IP...</Typography>
            </Box>
          )}
          {poolError && (
            <Alert severity="error" sx={{ fontSize: 12 }}>{poolError}</Alert>
          )}
          {pool && !loadingPool && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
              {pool.map((entry) => (
                <IpCell key={entry.ip} entry={entry} onClick={handleIpClick} onContextMenu={handleContextMenu} />
              ))}
            </Box>
          )}
        </Box>
      </Collapse>

      {/* IP Detail Drawers (standalone) */}
      <AuslBoInventoryDrawer
        id={ipDrawer.open && ipDrawer.usedByType === 'inventory' ? ipDrawer.usedById : null}
        onClose={() => setIpDrawer((s) => ({ ...s, open: false }))}
      />
      <AuslBoDeviceDrawer
        id={ipDrawer.open && ipDrawer.usedByType === 'device' ? ipDrawer.usedById : null}
        onClose={() => setIpDrawer((s) => ({ ...s, open: false }))}
      />

      {/* Context menu IP */}
      <Menu
        open={!!ctxMenu}
        onClose={() => setCtxMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined}
      >
        {ctxMenu?.entry.status !== 'excluded' && (
          <MenuItem onClick={handleExclude} disabled={ctxBusy}>
            <BlockOutlinedIcon sx={{ fontSize: 16, mr: 1, color: 'error.main' }} />
            <Typography sx={{ fontSize: 13, color: 'error.main', fontWeight: 600 }}>Escludi</Typography>
          </MenuItem>
        )}
        {ctxMenu?.entry.status === 'excluded' && (
          <MenuItem onClick={handleUnexclude} disabled={ctxBusy}>
            <RemoveCircleOutlineIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
            <Typography sx={{ fontSize: 13 }}>Rimuovi esclusione</Typography>
          </MenuItem>
        )}
      </Menu>

      {/* Dialog richiesta nuova modalità (IP libero) */}
      <IpRequestDialog
        entry={requestDialogEntry}
        vlan={vlan}
        customerId={customerId}
        onClose={() => setRequestDialogEntry(null)}
        onSaved={() => {
          setRequestDialogEntry(null)
          setPool(null)
          setExpanded(false)
          onRequestSaved()
        }}
      />
    </Paper>
  )
}

// ─── Dialog VLAN (create / edit) ──────────────────────────────────────────────

interface VlanDialogProps {
  open: boolean
  vlan: VlanRow | null  // null = create mode
  customerId: number
  sites: Array<{ id: number; name: string; display_name: string | null }>
  onClose: () => void
  onSaved: () => void
}

const EMPTY_FORM: VlanPayload = {
  customer: 0,
  site: 0,
  vlan_id: 0,
  name: '',
  network: '',
  subnet: '',
  gateway: '',
  lan: '',
  note: '',
}

function VlanDialog({ open, vlan, customerId, sites, onClose, onSaved }: VlanDialogProps) {
  const toast = useToast()
  const [form, setForm] = React.useState<VlanPayload>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      if (vlan) {
        setForm({
          customer: vlan.customer,
          site: vlan.site,
          vlan_id: vlan.vlan_id,
          name: vlan.name,
          network: vlan.network,
          subnet: vlan.subnet,
          gateway: vlan.gateway,
          lan: vlan.lan ?? '',
          note: vlan.note ?? '',
        })
      } else {
        setForm({ ...EMPTY_FORM, customer: customerId })
      }
      setErrors({})
    }
  }, [open, vlan, customerId])

  const set = (field: keyof VlanPayload, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => { const n = { ...e }; delete n[field]; return n })
  }

  const handleSave = async () => {
    // Validazione base
    const errs: Record<string, string> = {}
    if (!form.site) errs.site = 'Campo obbligatorio'
    if (!form.vlan_id) errs.vlan_id = 'Campo obbligatorio'
    if (!form.name.trim()) errs.name = 'Campo obbligatorio'
    if (!form.network.trim()) errs.network = 'Campo obbligatorio'
    if (!form.subnet.trim()) errs.subnet = 'Campo obbligatorio'
    if (!form.gateway.trim()) errs.gateway = 'Campo obbligatorio'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const payload: VlanPayload = {
        ...form,
        lan: form.lan || null,
        note: form.note || null,
      }
      if (vlan) {
        await updateVlan(vlan.id, payload)
        toast.success('VLAN aggiornata.')
      } else {
        await createVlan(payload)
        toast.success('VLAN creata.')
      }
      onSaved()
    } catch (e: unknown) {
      // Provo a estrarre errori di campo dal backend
      const data = (e as { response?: { data?: unknown } })?.response?.data
      if (data && typeof data === 'object') {
        const fieldErrs: Record<string, string> = {}
        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
          fieldErrs[k] = Array.isArray(v) ? v[0] : String(v)
        }
        setErrors(fieldErrs)
      } else {
        toast.error(apiErrorToMessage(e))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 15 }}>
        {vlan ? `Modifica VLAN ${vlan.vlan_id}` : 'Nuova VLAN'}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              label="Sede *"
              fullWidth
              size="small"
              value={form.site || ''}
              onChange={(e) => set('site', Number(e.target.value))}
              error={!!errors.site}
              helperText={errors.site}
            >
              {sites.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.display_name || s.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="VLAN ID *"
              fullWidth
              size="small"
              type="number"
              value={form.vlan_id || ''}
              onChange={(e) => set('vlan_id', Number(e.target.value))}
              error={!!errors.vlan_id}
              helperText={errors.vlan_id}
              inputProps={{ min: 1, max: 4094 }}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Nome / Descrizione *"
              fullWidth
              size="small"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
              placeholder="Es. Radiologia Area Blu"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Network (CIDR) *"
              fullWidth
              size="small"
              value={form.network}
              onChange={(e) => set('network', e.target.value)}
              error={!!errors.network}
              helperText={errors.network || 'Es. 10.241.0.64/26'}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Subnet mask *"
              fullWidth
              size="small"
              value={form.subnet}
              onChange={(e) => set('subnet', e.target.value)}
              error={!!errors.subnet}
              helperText={errors.subnet || 'Es. 255.255.255.192'}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Gateway *"
              fullWidth
              size="small"
              value={form.gateway}
              onChange={(e) => set('gateway', e.target.value)}
              error={!!errors.gateway}
              helperText={errors.gateway || 'Es. 10.241.0.65'}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="LAN"
              fullWidth
              size="small"
              value={form.lan ?? ''}
              onChange={(e) => set('lan', e.target.value)}
              error={!!errors.lan}
              helperText={errors.lan || 'Es. 172.26.99.0/24'}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Note"
              fullWidth
              size="small"
              multiline
              minRows={2}
              value={form.note ?? ''}
              onChange={(e) => set('note', e.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} variant="outlined" size="small">
          Annulla
        </Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" size="small">
          {saving ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
          {vlan ? 'Salva modifiche' : 'Crea VLAN'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteVlanDialog({
  vlan,
  onClose,
  onDeleted,
}: {
  vlan: VlanRow | null
  onClose: () => void
  onDeleted: () => void
}) {
  const toast = useToast()
  const [deleting, setDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!vlan) return
    setDeleting(true)
    try {
      await deleteVlan(vlan.id)
      toast.success('VLAN eliminata.')
      onDeleted()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={!!vlan} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 15 }}>Elimina VLAN</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14 }}>
          Sei sicuro di voler eliminare{' '}
          <strong>VLAN {vlan?.vlan_id} — {vlan?.name}</strong>?
          <br />
          L'operazione non può essere annullata.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={deleting} variant="outlined" size="small">
          Annulla
        </Button>
        <Button onClick={handleDelete} disabled={deleting} variant="contained" color="error" size="small">
          {deleting ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
          Elimina
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function VlanPage() {
  const { me } = useAuth()
  const nav = useNavigate()
  const customerId = me?.customer.id ?? 0

  const [vlans, setVlans] = React.useState<VlanRow[]>([])
  const [sites, setSites] = React.useState<Array<{ id: number; name: string; display_name: string | null }>>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Filtro per sede
  const [siteFilter, setSiteFilter] = React.useState<number | 'all'>('all')

  // Dialogs
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editVlan, setEditVlan] = React.useState<VlanRow | null>(null)
  const [deleteVlanTarget, setDeleteVlanTarget] = React.useState<VlanRow | null>(null)

  // Verifica se l'utente può gestire le VLAN (staff o vlan_manager)
  // Per semplicità sul portal mostriamo i bottoni solo agli staff;
  // la verifica server-side è comunque nel backend.
  const canManage = me?.user != null  // il backend fa la vera verifica

  // ── Caricamento dati ───────────────────────────────────────────────────────

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [vlanRes, siteRes] = await Promise.all([
        fetchVlans({ customer: customerId }),
        // Riuso endpoint sites già esistente
        import('../api/client').then(({ apiGet }) =>
          apiGet<{ results: Array<{ id: number; name: string; display_name: string | null }> }>(
            '/sites/',
            { params: { customer: customerId, page_size: 200 } },
          )
        ),
      ])
      setVlans(vlanRes.results)
      setSites(siteRes.results)
    } catch (e) {
      setError(apiErrorToMessage(e))
    } finally {
      setLoading(false)
    }
  }, [customerId])

  React.useEffect(() => { load() }, [load])

  // ── KPI aggregati ──────────────────────────────────────────────────────────

  const kpi = React.useMemo(() => {
    const src = vlans
    const totalVlan = src.length
    const totalIp = src.reduce((a, v) => a + v.total_hosts, 0)
    const usedIp = src.reduce((a, v) => a + v.used_count, 0)
    const freeIp = src.reduce((a, v) => a + v.free_count, 0)
    const pctFree = totalIp ? Math.round((freeIp / totalIp) * 100) : 0
    return { totalVlan, totalIp, usedIp, freeIp, pctFree }
  }, [vlans])

  // ── VLAN filtrate per sede ─────────────────────────────────────────────────

  const filteredVlans = React.useMemo(() => {
    if (siteFilter === 'all') return vlans
    return vlans.filter((v) => v.site === siteFilter)
  }, [vlans, siteFilter])

  // ── Raggruppamento per sede ────────────────────────────────────────────────

  const grouped = React.useMemo(() => {
    const map = new Map<number, { siteLabel: string; vlans: VlanRow[] }>()
    for (const v of filteredVlans) {
      if (!map.has(v.site)) {
        map.set(v.site, {
          siteLabel: v.site_display_name || v.site_name || `Sede #${v.site}`,
          vlans: [],
        })
      }
      map.get(v.site)!.vlans.push(v)
    }
    return Array.from(map.entries()).map(([siteId, data]) => ({ siteId, ...data }))
  }, [filteredVlans])

  // ── Export CSV ─────────────────────────────────────────────────────────────

  const handleExport = () => {
    const rows = [
      ['VLAN ID', 'Nome', 'Sede', 'Network', 'Subnet', 'Gateway', 'LAN', 'Totali', 'Occupati', 'Liberi'],
      ...vlans.map((v) => [
        v.vlan_id,
        v.name,
        v.site_display_name || v.site_name,
        v.network,
        v.subnet,
        v.gateway,
        v.lan ?? '',
        v.total_hosts,
        v.used_count,
        v.free_count,
      ]),
    ]
    const csv = rows.map((r) => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vlan-export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleEdit = (v: VlanRow) => { setEditVlan(v); setDialogOpen(true) }
  const handleNew = () => { setEditVlan(null); setDialogOpen(true) }
  const handleDialogClose = () => { setDialogOpen(false); setEditVlan(null) }
  const handleSaved = () => { handleDialogClose(); load() }
  const handleDeleted = () => { setDeleteVlanTarget(null); load() }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* KPI */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, flexWrap: 'wrap' }}>
        <KpiCard label="VLAN totali"  value={kpi.totalVlan} color="#1A6BB5" sub="in questo customer" />
        <KpiCard label="IP totali"    value={kpi.totalIp}   color="#6366f1" sub="su tutte le VLAN" />
        <KpiCard label="IP liberi"    value={kpi.freeIp}    color="#16a34a" sub={`${kpi.pctFree}% disponibili`} />
        <KpiCard label="IP occupati"  value={kpi.usedIp}    color="#dc2626" sub="da inventory / device" />
      </Stack>

      {/* Filtro sede */}
      {sites.length > 1 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', alignSelf: 'center' }}>
            Sede:
          </Typography>
          <Chip
            label="Tutte"
            size="small"
            onClick={() => setSiteFilter('all')}
            color={siteFilter === 'all' ? 'primary' : 'default'}
            variant={siteFilter === 'all' ? 'filled' : 'outlined'}
            sx={{ fontSize: 11 }}
          />
          {sites.map((s) => (
            <Chip
              key={s.id}
              label={s.display_name || s.name}
              size="small"
              onClick={() => setSiteFilter(s.id)}
              color={siteFilter === s.id ? 'primary' : 'default'}
              variant={siteFilter === s.id ? 'filled' : 'outlined'}
              sx={{ fontSize: 11 }}
            />
          ))}
        </Stack>
      )}

      {/* Loading / Error */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      )}
      {error && !loading && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* Nessuna VLAN */}
      {!loading && !error && vlans.length === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <RouterOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
            Nessuna VLAN configurata.
            {canManage && ' Clicca "+ Nuova VLAN" per iniziare.'}
          </Typography>
        </Paper>
      )}

      {/* VLAN raggruppate per sede */}
      {!loading && !error && grouped.map(({ siteId, siteLabel, vlans: siteVlans }) => (
        <Box key={siteId} sx={{ mb: 3 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              mb: 1,
              pl: 0.5,
            }}
          >
            {siteLabel}
          </Typography>
          <Stack spacing={1.5}>
            {siteVlans.map((v) => (
              <VlanCard
                key={v.id}
                vlan={v}
                canManage={canManage}
                customerId={customerId}
                onEdit={handleEdit}
                onDelete={setDeleteVlanTarget}
                onRequestSaved={() => nav('/richieste')}
              />
            ))}
          </Stack>
        </Box>
      ))}

      {/* SpeedDial FAB */}
      <SpeedDial
        ariaLabel="Azioni VLAN"
        sx={{
          position: 'fixed',
          bottom: { xs: 16, md: 20 },
          right: { xs: 16, md: 24 },
          zIndex: (t) => t.zIndex.appBar - 1,
          display: { xs: 'none', md: 'inline-flex' },
          '& .MuiSpeedDial-fab': {
            width: 52, height: 52,
            boxShadow: '0 8px 24px rgba(26,107,181,0.35)',
          },
          '& .MuiSpeedDialAction-staticTooltipLabel': {
            whiteSpace: 'nowrap',
            backgroundColor: 'rgba(26,107,181,0.10)',
            color: 'primary.main',
            fontWeight: 600,
            fontSize: 12,
            boxShadow: 'none',
            border: '1px solid rgba(26,107,181,0.18)',
          },
        }}
        icon={<SpeedDialIcon />}
      >
        {canManage && (
          <SpeedDialAction
            icon={<AddIcon />}
            tooltipTitle="Nuova VLAN"
            tooltipOpen
            onClick={handleNew}
          />
        )}
        <SpeedDialAction
          icon={<DownloadIcon />}
          tooltipTitle="Esporta CSV"
          tooltipOpen
          onClick={handleExport}
        />
      </SpeedDial>

      {/* Dialog crea/modifica */}
      <VlanDialog
        open={dialogOpen}
        vlan={editVlan}
        customerId={customerId}
        sites={sites}
        onClose={handleDialogClose}
        onSaved={handleSaved}
      />

      {/* Dialog elimina */}
      <DeleteVlanDialog
        vlan={deleteVlanTarget}
        onClose={() => setDeleteVlanTarget(null)}
        onDeleted={handleDeleted}
      />
    </Box>
  )
}
