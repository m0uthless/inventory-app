/**
 * BugFeatureDrawer — drawer di dettaglio per segnalazioni bug/feature.
 * Estratto dall'inline di BugFeature.tsx.
 */
import { Box, Button, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined'
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined'
import { DrawerShell } from '@shared/ui/DrawerShell'

export type ReportKind = 'bug' | 'feature'
export type ReportStatus = 'open' | 'resolved' | 'rejected'

export type BugFeatureRow = {
  id: number
  kind: ReportKind
  kind_label: string
  status: ReportStatus
  status_label: string
  section: string
  section_label: string
  description: string
  screenshot_url?: string | null
  can_resolve?: boolean
  created_by_username?: string | null
  created_by_full_name?: string | null
  created_at: string
  updated_at: string
  resolved_at?: string | null
  resolved_by_username?: string | null
  resolved_by_full_name?: string | null
  rejection_reason?: string | null
  rejected_at?: string | null
  rejected_by_username?: string | null
  rejected_by_full_name?: string | null
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(value))
  } catch { return value }
}

function KindChip({ kind }: { kind: ReportKind }) {
  const isBug = kind === 'bug'
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', px: 1, py: 0.25,
      borderRadius: 1, fontSize: '0.72rem', fontWeight: 700,
      bgcolor: isBug ? 'rgba(185,28,28,0.12)' : 'rgba(15,118,110,0.12)',
      color: isBug ? (theme) => theme.palette.error.dark : (theme) => theme.palette.primary.main,
      border: `1px solid ${isBug ? 'rgba(185,28,28,0.25)' : 'rgba(15,118,110,0.25)'}`,
    }}>
      {isBug ? '🐛 Bug' : '✨ Feature'}
    </Box>
  )
}

function StatusChip({ status }: { status: ReportStatus }) {
  const config = {
    open: {
      label: '⏳ Aperta',
      bgcolor: 'rgba(234,179,8,0.12)',
      border: 'rgba(234,179,8,0.3)',
      color: (theme: Theme) => theme.palette.warning.dark,
    },
    resolved: {
      label: '✅ Resolved',
      bgcolor: 'rgba(16,185,129,0.12)',
      border: 'rgba(16,185,129,0.3)',
      color: (theme: Theme) => theme.palette.success.dark,
    },
    rejected: {
      label: '⛔ Rifiutata',
      bgcolor: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.3)',
      color: (theme: Theme) => theme.palette.error.dark,
    },
  } as const
  const c = config[status]
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', px: 1, py: 0.25,
      borderRadius: 1, fontSize: '0.72rem', fontWeight: 700,
      bgcolor: c.bgcolor,
      color: c.color,
      border: `1px solid ${c.border}`,
    }}>
      {c.label}
    </Box>
  )
}

export interface BugFeatureDrawerProps {
  selected: BugFeatureRow | null
  onClose: () => void
  isResolvedPage: boolean
  actionBusyId: number | null
  onResolve: (row: BugFeatureRow) => void
  onReject: (row: BugFeatureRow) => void
}

export default function BugFeatureDrawer({
  selected, onClose, isResolvedPage, actionBusyId, onResolve, onReject,
}: BugFeatureDrawerProps) {
  const theme = useTheme()
  const isBug = selected?.kind === 'bug'
  const gradient = isBug
    ? `linear-gradient(135deg, ${theme.palette.error.dark} 0%, #dc2626 60%, #f97316 100%)`
    : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, #0d9488 55%, #0891b2 100%)`

  const statusSlot = (
    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
      <Tooltip title="Chiudi">
        <IconButton size="small" onClick={onClose}
          sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {selected ? (
        <>
          <KindChip kind={selected.kind} />
          <StatusChip status={selected.status} />
        </>
      ) : null}
    </Stack>
  )

  return (
    <DrawerShell
      open={Boolean(selected)}
      onClose={onClose}
      width={420}
      gradient={gradient}
      statusSlot={statusSlot}
      title={selected?.section_label ?? ''}
      subtitle={selected ? `Inserito da ${selected.created_by_full_name || selected.created_by_username || '—'} · ${formatDateTime(selected.created_at)}` : undefined}
    >
      {selected ? (
        <Stack spacing={2}>
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, p: 2.25, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 800 }}>Descrizione</Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{selected.description}</Typography>
          </Box>
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, p: 2.25, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 800 }}>Dettagli</Typography>
            <Box sx={{ mt: 1.25, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
              {[
                { label: 'Tipo', node: <KindChip kind={selected.kind} /> },
                { label: 'Sezione', node: <Typography variant="body2" sx={{ fontWeight: 700 }}>{selected.section_label}</Typography> },
                { label: 'Creato da', node: <Typography variant="body2">{selected.created_by_full_name || selected.created_by_username || '—'}</Typography> },
                { label: 'Ultimo aggiornamento', node: <Typography variant="body2">{formatDateTime(selected.updated_at)}</Typography> },
              ].map(({ label, node }) => (
                <Box key={label}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>{label}</Typography>
                  <Box sx={{ mt: 0.5 }}>{node}</Box>
                </Box>
              ))}
            </Box>
          </Box>
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, p: 2.25, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 800 }}>Stato</Typography>
            <Stack spacing={1.25} sx={{ mt: 1.25 }}>
              <Box><StatusChip status={selected.status} /></Box>
              {selected.status === 'resolved' && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Chiusa il {formatDateTime(selected.resolved_at)} da {selected.resolved_by_full_name || selected.resolved_by_username || '—'}.
                </Typography>
              )}
              {selected.status === 'rejected' && (
                <>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Rifiutata il {formatDateTime(selected.rejected_at)} da {selected.rejected_by_full_name || selected.rejected_by_username || '—'}.
                  </Typography>
                  <Box sx={{ bgcolor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 1, p: 1.5 }}>
                    <Typography variant="caption" sx={{ color: 'error.dark', fontWeight: 700, display: 'block', mb: 0.5 }}>
                      Motivazione del rifiuto
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selected.rejection_reason || '—'}
                    </Typography>
                  </Box>
                </>
              )}
              {selected.status === 'open' && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Segnalazione ancora aperta.</Typography>
              )}
              {!isResolvedPage && selected.status === 'open' && selected.can_resolve ? (
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" startIcon={<DoneAllIcon />}
                    onClick={() => onResolve(selected)} disabled={actionBusyId === selected.id}>
                    Segna come resolved
                  </Button>
                  <Button size="small" variant="outlined" color="error" startIcon={<ThumbDownOutlinedIcon />}
                    onClick={() => onReject(selected)} disabled={actionBusyId === selected.id}>
                    Rifiuta
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Box>
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, p: 2.25, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 800 }}>Timeline</Typography>
            <Stack spacing={0.9} sx={{ mt: 1.25 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Creata il {formatDateTime(selected.created_at)}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Aggiornata il {formatDateTime(selected.updated_at)}</Typography>
              {selected.resolved_at && <Typography variant="body2" sx={{ color: 'text.secondary' }}>Resolved il {formatDateTime(selected.resolved_at)}</Typography>}
              {selected.rejected_at && <Typography variant="body2" sx={{ color: 'text.secondary' }}>Rifiutata il {formatDateTime(selected.rejected_at)}</Typography>}
            </Stack>
          </Box>
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, p: 2.25, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', fontWeight: 800 }}>Allegati</Typography>
            {selected.screenshot_url ? (
              <Stack spacing={1.5} sx={{ mt: 1.25 }}>
                <Box component="img" src={selected.screenshot_url} alt="Screenshot allegato"
                  sx={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: '#fff' }} />
                <Link href={selected.screenshot_url} target="_blank" rel="noreferrer" underline="hover"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, width: 'fit-content' }}>
                  Apri immagine completa <LaunchOutlinedIcon sx={{ fontSize: 16 }} />
                </Link>
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>Nessuno screenshot allegato.</Typography>
            )}
          </Box>
        </Stack>
      ) : null}
    </DrawerShell>
  )
}
