import * as React from 'react'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Stack,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined'
import DownloadIcon from '@mui/icons-material/Download'

import { useAuth } from '../auth/AuthProvider'
import { useNavigate } from 'react-router-dom'
import { apiErrorToMessage } from '@shared/api/error'
import {
  fetchVlans,
  type VlanRow,
} from '../api/vlanApi'
import { apiGet } from '@shared/api/client'

import KpiCard from './vlan/KpiCard'
import VlanCard from './vlan/VlanCard'
import VlanDialog from './vlan/VlanDialog'
import DeleteVlanDialog from './vlan/DeleteVlanDialog'

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
        apiGet<{ results: Array<{ id: number; name: string; display_name: string | null }> }>(
          '/sites/',
          { params: { customer: customerId, page_size: 200 } },
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
