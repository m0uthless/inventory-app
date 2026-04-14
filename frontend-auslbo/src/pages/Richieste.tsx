import * as React from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import { useAuth } from '../auth/AuthProvider'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import {
  fetchVlanIpRequests,
  approveVlanIpRequest,
  rejectVlanIpRequest,
  type VlanIpRequest,
  type RequestStato,
} from '../api/vlanRequestApi'
import AuslBoNewDeviceDrawer from '../ui/AuslBoNewDeviceDrawer'
import { type NewDeviceFormState, emptyDeviceForm } from '@shared/device/deviceTypes'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATO_CHIP: Record<RequestStato, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: 'In attesa',  color: '#854F0B', bg: '#FAEEDA', border: '#FAC775' },
  approved: { label: 'Approvata',  color: '#3B6D11', bg: '#EAF3DE', border: '#C0DD97' },
  rejected: { label: 'Rifiutata',  color: '#A32D2D', bg: '#FCEBEB', border: '#F7C1C1' },
}

function StatoBadge({ stato }: { stato: RequestStato }) {
  const s = STATO_CHIP[stato]
  return (
    <Chip
      size="small"
      label={s.label}
      sx={{ bgcolor: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 700, fontSize: 11, height: 22 }}
    />
  )
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmColor,
  onConfirm,
  onClose,
  busy,
  children,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  confirmColor?: 'primary' | 'error'
  onConfirm: () => void
  onClose: () => void
  busy: boolean
  children?: React.ReactNode
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 15 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14 }}>{message}</Typography>
        {children}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={busy} variant="outlined" size="small">Annulla</Button>
        <Button onClick={onConfirm} disabled={busy} variant="contained" color={confirmColor ?? 'primary'} size="small">
          {busy && <CircularProgress size={14} sx={{ mr: 1 }} color="inherit" />}
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Testo Mail ───────────────────────────────────────────────────────────────

function buildMailText(req: VlanIpRequest): string {
  const date = new Date(req.created_at).toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const lines: string[] = []

  lines.push('Oggetto: Richiesta nuova modalità — ' + req.ip)
  lines.push('')
  lines.push('Gentile team,')
  lines.push('')
  lines.push('si richiede la configurazione di una nuova modalità con i seguenti dati:')
  lines.push('')
  lines.push('── DATI RICHIESTA ──────────────────────────────────')
  lines.push(`  Data richiesta : ${date}`)
  lines.push(`  Richiedente    : ${req.richiedente_username ?? '—'}`)
  lines.push(`  Stato          : ${req.stato_label}`)
  lines.push('')
  lines.push('── RETE ────────────────────────────────────────────')
  lines.push(`  IP assegnato   : ${req.ip}`)
  lines.push(`  VLAN           : ${req.vlan_name ?? '—'}`)
  lines.push(`  Network        : ${req.vlan_network ?? '—'}`)
  lines.push(`  Gateway        : ${req.vlan_gateway ?? '—'}`)
  lines.push(`  Subnet mask    : ${req.vlan_subnet ?? '—'}`)
  lines.push('')
  lines.push('── DEVICE ──────────────────────────────────────────')
  lines.push(`  Modalità       : ${req.modalita_label}`)
  if (req.site_name)         lines.push(`  Sede           : ${req.site_name}`)
  if (req.reparto)           lines.push(`  Reparto        : ${req.reparto}`)
  if (req.device_type_name)  lines.push(`  Tipo device    : ${req.device_type_name}`)
  if (req.manufacturer_name) lines.push(`  Produttore     : ${req.manufacturer_name}`)
  if (req.aetitle)           lines.push(`  AE Title       : ${req.aetitle}`)

  if (req.rispacs_detail.length > 0) {
    lines.push('')
    lines.push('── SISTEMI RIS/PACS ─────────────────────────────────')
    req.rispacs_detail.forEach((r, i) => {
      const cfg = req.rispacs_config?.find((c) => c.rispacs_id === r.id)
      const etichetta = cfg?.etichetta ?? '—'
      lines.push(`  ${i + 1}. ${r.name}`)
      lines.push(`     Etichetta  : ${etichetta}`)
      if (r.ip)      lines.push(`     IP         : ${r.ip}`)
      if (r.aetitle) lines.push(`     AE Title   : ${r.aetitle}`)
    })
  }

  if (req.note) {
    lines.push('')
    lines.push('── NOTE ────────────────────────────────────────────')
    lines.push(`  ${req.note}`)
  }

  lines.push('')
  lines.push('────────────────────────────────────────────────────')
  lines.push('Messaggio generato automaticamente da ARCHIE.')

  return lines.join('\n')
}

function MailTextDialog({
  req,
  onClose,
}: {
  req: VlanIpRequest | null
  onClose: () => void
}) {
  const [copied, setCopied] = React.useState(false)
  const text = req ? buildMailText(req) : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Dialog open={!!req} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 1 }}>
        <MarkEmailReadOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        Testo Mail
        {req && (
          <Typography component="span" sx={{ ml: 1, fontSize: 12, color: 'text.secondary', fontWeight: 400 }}>
            IP: <strong style={{ fontFamily: 'monospace' }}>{req.ip}</strong>
          </Typography>
        )}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <TextField
          multiline
          fullWidth
          size="small"
          value={text}
          InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 12 } }}
          minRows={18}
          maxRows={28}
        />
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" size="small">Chiudi</Button>
        <Button
          onClick={handleCopy}
          variant="contained"
          size="small"
          startIcon={<ContentCopyIcon sx={{ fontSize: 15 }} />}
        >
          {copied ? 'Copiato!' : 'Copia testo'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── RequestCard ──────────────────────────────────────────────────────────────

function RequestCard({
  req,
  isAdmin,
  onApprove,
  onReject,
  onMailText,
}: {
  req: VlanIpRequest
  isAdmin: boolean
  onApprove: (r: VlanIpRequest) => void
  onReject: (r: VlanIpRequest) => void
  onMailText: (r: VlanIpRequest) => void
}) {
  const dateStr = new Date(req.created_at).toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.25, bgcolor: 'grey.50',
        borderBottom: '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.4 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'text.primary', letterSpacing: '0.04em', fontFamily: 'monospace' }}>
            #{String(req.id).padStart(4, '0')}
          </Typography>
          <StatoBadge stato={req.stato} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography sx={{ fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>
              {req.ip}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {req.modalita_label}
            </Typography>
          </Stack>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {req.site_name ?? req.vlan_name ?? '—'}
            {req.reparto && <> &nbsp;|&nbsp; {req.reparto}</>}
            {req.aetitle && <> &nbsp;|&nbsp; AE: <strong>{req.aetitle}</strong></>}
          </Typography>
        </Box>

        <Typography sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {dateStr}
        </Typography>

        {/* Azioni */}
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip
            size="small"
            icon={<MarkEmailReadOutlinedIcon sx={{ fontSize: 13, '&&': { ml: '6px' } }} />}
            label="Testo Mail"
            onClick={() => onMailText(req)}
            sx={{
              fontSize: 11, height: 22, cursor: 'pointer',
              bgcolor: 'rgba(26,107,181,0.08)', color: 'primary.main',
              border: '1px solid rgba(26,107,181,0.22)',
              '&:hover': { bgcolor: 'rgba(26,107,181,0.15)' },
            }}
          />
          {isAdmin && req.stato === 'pending' && (
            <>
              <Tooltip title="Approva — apre il form nuovo device">
                <IconButton size="small" color="success" onClick={() => onApprove(req)}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Rifiuta richiesta">
                <IconButton size="small" color="error" onClick={() => onReject(req)}>
                  <CancelOutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      </Box>

      {/* Body */}
      <Box sx={{ px: 2, py: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>

          {/* Sinistra: Rete */}
          <Box sx={{ flex: '0 0 auto', minWidth: 180 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
              Rete
            </Typography>
            <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}>
              GW {req.vlan_gateway}&nbsp;|&nbsp;Mask {req.vlan_subnet}
            </Typography>
          </Box>

          {/* Centro: RIS/PACS */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {req.rispacs_detail.length > 0 && (
              <>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                  Sistemi RIS/PACS
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="center">
                  {req.rispacs_detail.map((r) => (
                    <Chip key={r.id} size="small" label={r.name}
                      sx={{ fontSize: 11, height: 20, bgcolor: 'rgba(26,107,181,0.08)', color: 'primary.main', border: '1px solid rgba(26,107,181,0.18)' }} />
                  ))}
                </Stack>
              </>
            )}
          </Box>

          {/* Destra: Richiesta da + Approvato/Rifiutato da */}
          <Box sx={{ flex: '0 0 auto', display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                Richiesta da
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                {req.richiedente_full_name ?? req.richiedente_username ?? '—'}
              </Typography>
            </Box>

            {req.approvato_da_username && (
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                  {req.stato === 'approved' ? 'Approvata da' : 'Rifiutata da'}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {req.approvato_da_full_name ?? req.approvato_da_username}
                </Typography>
              </Box>
            )}
          </Box>

        </Box>

        {req.note && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1.5, fontStyle: 'italic' }}>
            {req.note}
          </Typography>
        )}
      </Box>
    </Paper>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RichiestePage() {
  const { me } = useAuth()
  const toast = useToast()

  const isAdmin = me?.auslbo?.can_edit_devices ?? false
  const customerId = me?.customer?.id ?? 0

  const [requests, setRequests] = React.useState<VlanIpRequest[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Confirm dialogs
  const [approveTarget, setApproveTarget] = React.useState<VlanIpRequest | null>(null)
  const [rejectTarget, setRejectTarget] = React.useState<VlanIpRequest | null>(null)
  const [rejectMotivo, setRejectMotivo] = React.useState('')
  const [mailTarget, setMailTarget] = React.useState<VlanIpRequest | null>(null)
  const [busy, setBusy] = React.useState(false)

  // Device drawer precompilato dopo approvazione
  const [newDeviceForm, setNewDeviceForm] = React.useState<NewDeviceFormState | null>(null)
  const [pendingApproveId, setPendingApproveId] = React.useState<number | null>(null)

  const buildFormFromRequest = (req: VlanIpRequest): NewDeviceFormState => ({
    ...emptyDeviceForm(),
    ip:           req.ip,
    aetitle:      req.aetitle ?? '',
    vlan:         true,
    rispacs:      req.rispacs_detail.length > 0,
    rispacs_ids:  req.rispacs_detail.map((r) => r.id),
    note:         req.note ?? '',
    site:         req.site ?? '',
    type:         req.device_type ?? '',
    manufacturer: req.manufacturer ?? '',
    reparto:      req.reparto ?? '',
  })

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchVlanIpRequests({ customer: customerId })
      setRequests(res.results)
    } catch (e) {
      setError(apiErrorToMessage(e))
    } finally {
      setLoading(false)
    }
  }, [customerId])

  React.useEffect(() => { load() }, [load])

  const handleApprove = async () => {
    if (!approveTarget) return
    // Apre subito il drawer con i dati precompilati — la richiesta
    // viene marcata come approvata solo dopo il salvataggio del device
    setNewDeviceForm(buildFormFromRequest(approveTarget))
    setPendingApproveId(approveTarget.id)
    setApproveTarget(null)
  }

  const handleDeviceSaved = async () => {
    setNewDeviceForm(null)
    // Ora marca la richiesta come approvata
    if (pendingApproveId !== null) {
      try {
        await approveVlanIpRequest(pendingApproveId)
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setPendingApproveId(null)
      }
    }
    load()
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setBusy(true)
    try {
      await rejectVlanIpRequest(rejectTarget.id, rejectMotivo.trim() || undefined)
      toast.success('Richiesta rifiutata.')
      setRejectTarget(null)
      setRejectMotivo('')
      load()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // Filtraggio per stato
  const pending  = requests.filter((r) => r.stato === 'pending')
  const approved = requests.filter((r) => r.stato === 'approved')
  const rejected = requests.filter((r) => r.stato === 'rejected')

  const Section = ({ title, items }: { title: string; items: VlanIpRequest[] }) => (
    items.length === 0 ? null : (
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', mb: 1, pl: 0.5 }}>
          {title} ({items.length})
        </Typography>
        <Stack spacing={1.5}>
          {items.map((r) => (
            <RequestCard
              key={r.id}
              req={r}
              isAdmin={isAdmin}
              onApprove={setApproveTarget}
              onReject={setRejectTarget}
              onMailText={setMailTarget}
            />
          ))}
        </Stack>
      </Box>
    )
  )

  return (
    <Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {error && !loading && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && requests.length === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
            Nessuna richiesta presente.
          </Typography>
        </Paper>
      )}

      {!loading && !error && (
        <>
          <Section title="In attesa" items={pending} />
          <Section title="Approvate" items={approved} />
          <Section title="Rifiutate" items={rejected} />
        </>
      )}

      {/* Confirm approva */}
      <ConfirmDialog
        open={!!approveTarget}
        title="Approva richiesta"
        message={`Approvare la richiesta per l'IP ${approveTarget?.ip}? L'IP verrà liberato dalla prenotazione e potrai creare il device.`}
        confirmLabel="Approva"
        confirmColor="primary"
        onConfirm={handleApprove}
        onClose={() => setApproveTarget(null)}
        busy={busy}
      />

      {/* Confirm rifiuta */}
      <ConfirmDialog
        open={!!rejectTarget}
        title="Rifiuta richiesta"
        message={`Rifiutare la richiesta per l'IP ${rejectTarget?.ip}? L'IP tornerà disponibile nella heatmap.`}
        confirmLabel="Rifiuta"
        confirmColor="error"
        onConfirm={handleReject}
        onClose={() => { setRejectTarget(null); setRejectMotivo('') }}
        busy={busy}
      >
        <TextField
          label="Motivo rifiuto"
          size="small"
          fullWidth
          multiline
          minRows={2}
          value={rejectMotivo}
          onChange={(e) => setRejectMotivo(e.target.value)}
          placeholder="Opzionale — verrà aggiunto alle note della richiesta"
          sx={{ mt: 2 }}
        />
      </ConfirmDialog>

      {/* Dialog testo mail */}
      <MailTextDialog
        req={mailTarget}
        onClose={() => setMailTarget(null)}
      />

      {/* Drawer nuovo device precompilato */}
      <AuslBoNewDeviceDrawer
        initialForm={newDeviceForm}
        customerId={customerId}
        onClose={() => { setNewDeviceForm(null); setPendingApproveId(null) }}
        onSaved={handleDeviceSaved}
      />
    </Box>
  )
}
