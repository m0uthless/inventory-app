import * as React from 'react'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'

import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import {
  fetchVlanIpPool,
  excludeVlanIp,
  unexcludeVlanIp,
  type VlanRow,
  type IpPoolEntry,
  type UsedByType,
} from '../../api/vlanApi'
import PortalInventoryDrawer from '../../ui/PortalInventoryDrawer'
import PortalDeviceDrawer from '../../ui/PortalDeviceDrawer'
import IpCell from './IpCell'
import IpRequestDialog from './IpRequestDialog'

// ─── Types per il drawer IP ───────────────────────────────────────────────────

type IpDrawerState = {
  open: boolean
  ip: string
  usedByType: UsedByType
  usedById: number | null
  usedByName: string | null
}

function calcOccupazione(vlan: VlanRow): number {
  if (!vlan.total_hosts) return 0
  return Math.round((vlan.used_count / vlan.total_hosts) * 100)
}

// ─── VLAN Card ────────────────────────────────────────────────────────────────

export default function VlanCard({
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
  const theme = useTheme()
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
  const occColor = occ > 80 ? theme.palette.error.dark : occ > 50 ? theme.palette.warning.dark : theme.palette.success.dark

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
            bgcolor: (theme) => theme.palette.info.light,
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
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: theme.palette.success.dark, lineHeight: 1 }}>
              {vlan.free_count}
            </Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>liberi</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: theme.palette.error.dark, lineHeight: 1 }}>
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
                <IconButton size="small" aria-label="Modifica VLAN" onClick={() => onEdit(vlan)}>
                  <EditOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Elimina VLAN">
                <IconButton size="small" aria-label="Elimina VLAN" color="error" onClick={() => onDelete(vlan)}>
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title={expanded ? 'Chiudi heatmap' : 'Espandi heatmap IP'}>
            <IconButton size="small" aria-label={expanded ? 'Chiudi heatmap' : 'Espandi heatmap IP'} onClick={handleToggle}>
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
            bgcolor: theme.palette.success.light,
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
      <PortalInventoryDrawer
        id={ipDrawer.open && ipDrawer.usedByType === 'inventory' ? ipDrawer.usedById : null}
        onClose={() => setIpDrawer((s) => ({ ...s, open: false }))}
      />
      <PortalDeviceDrawer
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
