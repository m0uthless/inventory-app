import * as React from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CloseIcon from '@mui/icons-material/Close'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'

import { Can } from '../../auth/Can'
import { PERMS } from '../../auth/perms'
import LeafletMap from '../../ui/LeafletMap'
import type { SiteDetail } from './types'

type Props = {
  open: boolean
  detail: SiteDetail | null
  selectedId: number | null
  detailLoading: boolean
  drawerTab: number
  contactCount: number | null
  invCount: number | null
  contactsTabContent: React.ReactNode
  inventoriesTabContent: React.ReactNode
  onClose: () => void
  onTabChange: (value: number) => void
  onRestore: () => void
  onEdit: () => void
  onDeleteRequest: () => void
  restoreBusy: boolean
  deleteBusy: boolean
  onCopy: (text: string) => void | Promise<void>
}

function customerLabel(site: SiteDetail | null) {
  return site?.customer_display_name || site?.customer_name || site?.customer_code || ''
}

export default function SiteDrawer(props: Props) {
  const {
    open,
    detail,
    selectedId,
    detailLoading,
    drawerTab,
    contactCount,
    invCount,
    contactsTabContent,
    inventoriesTabContent,
    onClose,
    onTabChange,
    onRestore,
    onEdit,
    onDeleteRequest,
    restoreBusy,
    deleteBusy,
    onCopy,
  } = props

  const siteAddress = React.useMemo(() => {
    if (!detail) return null
    const parts = [detail.address_line1?.trim(), detail.city?.trim()].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  }, [detail])

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
              <Can perm={PERMS.crm.site.change}>
                {detail?.deleted_at ? (
                  <Tooltip title="Ripristina">
                    <span>
                      <IconButton
                        aria-label="Ripristina"
                        size="small"
                        onClick={onRestore}
                        disabled={!detail || restoreBusy}
                        sx={{
                          color: 'rgba(255,255,255,0.85)',
                          bgcolor: 'rgba(255,255,255,0.12)',
                          borderRadius: 1.5,
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                        }}
                      >
                        <RestoreFromTrashIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : (
                  <Tooltip title="Modifica">
                    <span>
                      <IconButton
                        aria-label="Modifica"
                        size="small"
                        onClick={onEdit}
                        disabled={!detail}
                        sx={{
                          color: 'rgba(255,255,255,0.85)',
                          bgcolor: 'rgba(255,255,255,0.12)',
                          borderRadius: 1.5,
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </Can>
              <Can perm={PERMS.crm.site.delete}>
                {!detail?.deleted_at && (
                  <Tooltip title="Elimina">
                    <span>
                      <IconButton
                        aria-label="Elimina"
                        size="small"
                        onClick={onDeleteRequest}
                        disabled={!detail || deleteBusy}
                        sx={{
                          color: 'rgba(255,255,255,0.85)',
                          bgcolor: 'rgba(255,255,255,0.12)',
                          borderRadius: 1.5,
                          '&:hover': { bgcolor: 'rgba(239,68,68,0.28)', color: '#fca5a5' },
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </Can>
              <Tooltip title="Chiudi">
                <IconButton
                  aria-label="Chiudi"
                  size="small"
                  onClick={onClose}
                  sx={{
                    color: 'rgba(255,255,255,0.85)',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    borderRadius: 1.5,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            {detail?.deleted_at && (
              <Chip size="small" color="error" label="Eliminato" sx={{ mb: 0.75, height: 20, fontSize: 10 }} />
            )}
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
              {detail?.display_name || detail?.name || (selectedId ? `Sito #${selectedId}` : 'Sito')}
            </Typography>
            {detail?.city && (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
                📍 {detail.city}
                {detail.postal_code ? ` ${detail.postal_code}` : ''}
              </Typography>
            )}
          </Box>
        </Box>

        {detailLoading ? <LinearProgress sx={{ height: 2 }} /> : null}
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2.5 }}>
          <Tabs value={drawerTab} onChange={(_, v) => onTabChange(v)}>
            <Tab label="Dettagli" sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
            <Tab label={contactCount != null ? `Contatti (${contactCount})` : 'Contatti'} sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
            <Tab label={invCount != null ? `Inventari (${invCount})` : 'Inventari'} sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
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
          {detailLoading ? (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Caricamento…
              </Typography>
            </Stack>
          ) : detail ? (
            <>
              {drawerTab === 0 && (
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
                      <BusinessOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      Identificazione
                    </Typography>
                    <Stack spacing={0.5}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          Nome
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {detail.name || '—'}
                          </Typography>
                          {detail.name && (
                            <Tooltip title="Copia">
                              <IconButton aria-label="Copia" size="small" onClick={() => void onCopy(detail.name)}>
                                <ContentCopyIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Stack>
                      {detail.display_name && detail.display_name !== detail.name && (
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                            Nome visualizzato
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {detail.display_name}
                          </Typography>
                        </Stack>
                      )}
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          Cliente
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {customerLabel(detail) || '—'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>

                  {siteAddress && (
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
                          {siteAddress}
                        </Typography>
                      </Box>
                      <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100' }}>
                        <LeafletMap address={siteAddress} height={320} zoom={15} />
                      </Box>
                    </Box>
                  )}

                  {detail.notes && (
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
                      <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
                      >
                        {detail.notes}
                      </Typography>
                    </Box>
                  )}
                </>
              )}

              {drawerTab === 1 && contactsTabContent}
              {drawerTab === 2 && inventoriesTabContent}
            </>
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Nessun dettaglio disponibile.
            </Typography>
          )}
        </Box>
      </Stack>
    </Drawer>
  )
}
