import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'

import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'

import { buildQuery } from '../../utils/nav'
import { ActionIconButton } from '../../ui/ActionIconButton'
import type { ContactDetail } from './types'

type ContactDrawerProps = {
  open: boolean
  detail: ContactDetail | null
  detailLoading: boolean
  selectedId: number | null
  canChange: boolean
  canDelete: boolean
  deleteBusy: boolean
  restoreBusy: boolean
  onClose: () => void
  onEdit: () => void | Promise<void>
  onDelete: () => void
  onRestore: () => void | Promise<void>
  onCopied: () => void
}

function customerLabel(detail: ContactDetail | null) {
  return detail?.customer_display_name || detail?.customer_name || detail?.customer_code || ''
}

function siteLabel(detail: ContactDetail | null) {
  return detail?.site_display_name || detail?.site_name || ''
}

async function copyToClipboard(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

export default function ContactDrawer({
  open,
  detail,
  detailLoading,
  selectedId,
  canChange,
  canDelete,
  deleteBusy,
  restoreBusy,
  onClose,
  onEdit,
  onDelete,
  onRestore,
  onCopied,
}: ContactDrawerProps) {
  const navigate = useNavigate()

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 460 } } }}
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
              label={detail?.is_primary ? '● Primario' : '● Non primario'}
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

          <Box sx={{ position: 'relative', zIndex: 1 }}>
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
              {detail?.name || (selectedId ? `Contatto #${selectedId}` : 'Contatto')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.58)' }}>
              {[customerLabel(detail), siteLabel(detail)].filter(Boolean).join(' · ') || ' '}
            </Typography>
            {detail?.department ? (
              <Typography
                variant="caption"
                sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mt: 0.25 }}
              >
                {detail.department}
              </Typography>
            ) : null}
          </Box>
        </Box>

        {detailLoading ? <LinearProgress sx={{ height: 2 }} /> : null}

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
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {detail.customer ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/customers${buildQuery({ open: detail.customer })}`)}
                  >
                    Apri cliente
                  </Button>
                ) : null}
                {detail.site ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      navigate(
                        `/sites${buildQuery({ open: detail.site, customer: detail.customer ?? '' })}`,
                      )
                    }
                  >
                    Apri sito
                  </Button>
                ) : null}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    navigate(
                      `/inventory${buildQuery({
                        customer: detail.customer ?? '',
                        site: detail.site ?? '',
                      })}`,
                    )
                  }
                >
                  Apri inventario
                </Button>
              </Stack>

              <Box
                sx={{
                  bgcolor: '#f8fafc',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 2,
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
                    display: 'block',
                    mb: 1,
                  }}
                >
                  Dati contatto
                </Typography>
                <Stack spacing={0.75}>
                  {(
                    [
                      { label: 'Nome', value: detail.name, mono: false },
                      { label: 'Email', value: detail.email, mono: true },
                      { label: 'Telefono', value: detail.phone, mono: true },
                      { label: 'Reparto', value: detail.department, mono: false },
                      { label: 'Cliente', value: customerLabel(detail), mono: false },
                      { label: 'Sito', value: siteLabel(detail), mono: false },
                    ] as { label: string; value?: string | null; mono: boolean }[]
                  )
                    .filter(
                      (row): row is { label: string; value: string; mono: boolean } => Boolean(row.value),
                    )
                    .map((row) => (
                      <Stack
                        key={row.label}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 70 }}>
                          {row.label}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, fontFamily: row.mono ? 'monospace' : undefined }}
                          >
                            {row.value}
                          </Typography>
                          {row.mono && row.value ? (
                            <ActionIconButton
                              label="Copia"
                              icon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
                              size="small"
                              onClick={async () => {
                                await copyToClipboard(row.value)
                                onCopied()
                              }}
                            />
                          ) : null}
                        </Stack>
                      </Stack>
                    ))}
                </Stack>
              </Box>

              {detail.notes ? (
                <Box
                  sx={{
                    bgcolor: '#fafafa',
                    border: '1px solid',
                    borderColor: 'grey.100',
                    borderRadius: 2,
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
                      display: 'block',
                      mb: 0.75,
                    }}
                  >
                    Note
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
                  >
                    {detail.notes}
                  </Typography>
                </Box>
              ) : null}
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
