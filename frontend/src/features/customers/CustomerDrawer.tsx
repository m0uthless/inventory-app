import {
  Box,
  Chip,
  CircularProgress,
  Drawer,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'

import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import MonitorOutlinedIcon from '@mui/icons-material/MonitorOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'

import { ActionIconButton } from '@shared/ui/ActionIconButton'
import LeafletMap from '../../ui/LeafletMap'
import type { CustomerDetail } from './types'

type CustomerDrawerProps = {
  open: boolean
  detail: CustomerDetail | null
  detailLoading: boolean
  selectedId: number | null
  drawerTab: number
  sitesCount: number | null
  inventoriesCount: number | null
  driveCount: number | null
  address: string | null
  canChange: boolean
  canDelete: boolean
  deleteBusy: boolean
  restoreBusy: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void | Promise<void>
  onTabChange: (value: number) => void
  sitesTabContent: React.ReactNode
  inventoriesTabContent: React.ReactNode
  driveTabContent: React.ReactNode
  activityTabContent: React.ReactNode
}

export default function CustomerDrawer({
  open,
  detail,
  detailLoading,
  selectedId,
  drawerTab,
  sitesCount,
  inventoriesCount,
  driveCount,
  address,
  canChange,
  canDelete,
  deleteBusy,
  restoreBusy,
  onClose,
  onEdit,
  onDelete,
  onRestore,
  onTabChange,
  sitesTabContent,
  inventoriesTabContent,
  driveTabContent,
  activityTabContent,
}: CustomerDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 368 } } }}
    >
      <Stack sx={{ height: '100%', overflow: 'hidden' }}>
        <Box
          sx={{
            background: 'linear-gradient(140deg, #0f766e 0%, #0d9488 55%, #0e7490 100%)',
            px: 2.5,
            pt: 2.25,
            pb: 2.25,
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -44,
              right: -44,
              width: 130,
              height: 130,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -26,
              left: 52,
              width: 90,
              height: 90,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.04)',
              pointerEvents: 'none',
            }}
          />

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}
          >
            <Chip
              size="small"
              label={`● ${detail?.status_label ?? '—'}`}
              sx={{
                bgcolor: 'rgba(20,255,180,0.18)',
                color: '#a7f3d0',
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: '0.07em',
                border: '1px solid rgba(167,243,208,0.3)',
                height: 22,
              }}
            />
            <Stack direction="row" spacing={0.75}>
              {canChange ? (
                detail?.deleted_at ? (
                  <ActionIconButton
                    label="Ripristina"
                    icon={<RestoreFromTrashIcon fontSize="small" />}
                    size="small"
                    onClick={onRestore}
                    disabled={!detail || restoreBusy}
                    sx={{
                      color: 'rgba(255,255,255,0.85)',
                      bgcolor: 'rgba(255,255,255,0.12)',
                      borderRadius: 1.5,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                    }}
                  />
                ) : (
                  <ActionIconButton
                    label="Modifica"
                    icon={<EditIcon fontSize="small" />}
                    size="small"
                    onClick={onEdit}
                    disabled={!detail}
                    sx={{
                      color: 'rgba(255,255,255,0.85)',
                      bgcolor: 'rgba(255,255,255,0.12)',
                      borderRadius: 1.5,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                    }}
                  />
                )
              ) : null}
              {canDelete && !detail?.deleted_at ? (
                <ActionIconButton
                  label="Elimina"
                  icon={<DeleteOutlineIcon fontSize="small" />}
                  size="small"
                  onClick={onDelete}
                  disabled={!detail || deleteBusy}
                  sx={{
                    color: 'rgba(255,255,255,0.85)',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    borderRadius: 1.5,
                    '&:hover': { bgcolor: 'rgba(239,68,68,0.28)', color: '#fca5a5' },
                  }}
                />
              ) : null}
              <ActionIconButton
                label="Chiudi"
                icon={<CloseIcon fontSize="small" />}
                size="small"
                onClick={onClose}
                sx={{
                  color: 'rgba(255,255,255,0.85)',
                  bgcolor: 'rgba(255,255,255,0.12)',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                }}
              />
            </Stack>
          </Stack>

          <Box sx={{ position: 'relative', zIndex: 1, mb: 2 }}>
            {detail?.deleted_at ? (
              <Chip size="small" color="error" label="Eliminato" sx={{ mb: 0.75, height: 20, fontSize: 10 }} />
            ) : null}
            <Typography
              sx={{
                color: '#fff',
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                mb: 0.5,
              }}
            >
              {detail?.display_name || (selectedId ? `Cliente #${selectedId}` : 'Cliente')}
            </Typography>
            {detail?.city ? (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
                📍 {detail.city}
              </Typography>
            ) : null}
          </Box>
        </Box>

        {detailLoading ? <LinearProgress sx={{ height: 2 }} /> : null}

        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2.5 }}>
          <Tabs value={drawerTab} onChange={(_, value) => onTabChange(value)}>
            <Tab label="Dettagli" sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
            <Tab
              label={sitesCount != null ? `Siti (${sitesCount})` : 'Siti'}
              sx={{ fontSize: 13, minWidth: 0, px: 1.5 }}
            />
            <Tab
              label={inventoriesCount != null ? `Inventari (${inventoriesCount})` : 'Inventari'}
              sx={{ fontSize: 13, minWidth: 0, px: 1.5 }}
            />
            <Tab
              label={driveCount != null ? `Drive (${driveCount})` : 'Drive'}
              sx={{ fontSize: 13, minWidth: 0, px: 1.5 }}
            />
            <Tab label="Attività" sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
          </Tabs>
        </Box>

        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 2.5,
            py: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {!detail && !detailLoading ? (
            <Typography variant="body2" sx={{ opacity: 0.6 }}>
              Nessun dettaglio disponibile.
            </Typography>
          ) : null}

          {drawerTab === 0 && detail ? (
            <>
              <Box
                sx={{
                  bgcolor: '#f8fafc',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 1,
                  p: 1.75,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: 'text.disabled',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mb: 1,
                  }}
                >
                  <PersonOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  Contatto primario
                </Typography>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      {detail.primary_contact_name || '—'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {detail.primary_contact_email || ''}
                    </Typography>
                  </Box>
                  {detail.primary_contact_phone ? (
                    <Chip
                      size="small"
                      label={detail.primary_contact_phone}
                      sx={{
                        bgcolor: '#f0fdf4',
                        color: '#0f766e',
                        border: '1px solid #bbf7d0',
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                    />
                  ) : null}
                </Stack>
              </Box>

              <Box
                sx={{
                  bgcolor: '#f8fafc',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 1,
                  p: 1.75,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: 'text.disabled',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mb: 1,
                  }}
                >
                  <MonitorOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  Informazioni
                </Typography>
                <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'grey.50' }} />}>
                  {detail.vat_number ? (
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        P.IVA
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>
                        {detail.vat_number}
                      </Typography>
                    </Stack>
                  ) : null}
                  {detail.custom_fields && typeof detail.custom_fields === 'object'
                    ? Object.entries(detail.custom_fields)
                        .filter(
                          ([k, v]) =>
                            v !== '' &&
                            v !== null &&
                            v !== undefined &&
                            k.trim().toLowerCase() !== 'indirizzo',
                        )
                        .map(([k, v]) => (
                          <Stack key={k} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
                            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                              {k}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                maxWidth: 220,
                                textAlign: 'right',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {String(v)}
                            </Typography>
                          </Stack>
                        ))
                    : null}
                </Stack>
              </Box>

              {address ? (
                <Box
                  sx={{
                    bgcolor: '#fff',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        color: 'text.disabled',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        mb: 0.5,
                      }}
                    >
                      <LocationOnOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      Indirizzo
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {address}
                    </Typography>
                  </Box>
                  <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100' }}>
                    <LeafletMap address={address} height={320} zoom={15} />
                  </Box>
                </Box>
              ) : null}

              <Box
                sx={{
                  bgcolor: '#fafafa',
                  border: '1px solid',
                  borderColor: 'grey.100',
                  borderRadius: 1,
                  p: 1.75,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: 'text.disabled',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mb: 0.75,
                  }}
                >
                  <NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  Note
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {detail.notes || '—'}
                </Typography>
              </Box>
            </>
          ) : null}

          {drawerTab === 1 ? sitesTabContent : null}
          {drawerTab === 2 ? inventoriesTabContent : null}
          {drawerTab === 3 ? driveTabContent : null}
          {drawerTab === 4 ? activityTabContent : null}

          {detailLoading ? (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Caricamento…
              </Typography>
            </Stack>
          ) : null}
        </Box>
      </Stack>
    </Drawer>
  )
}
