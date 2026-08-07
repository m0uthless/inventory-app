import * as React from 'react'
import { Box, Chip, Stack, Typography } from '@mui/material'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import MonitorOutlinedIcon from '@mui/icons-material/MonitorOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import VpnLockIcon from '@mui/icons-material/VpnLock'

import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList, DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import LeafletMap from '../../ui/LeafletMap'
import { isRecord } from '@shared/utils/guards'
import type { CustomerDetail } from '../../features/customers/types'
import type { SiteDetail } from '../../features/sites/types'

// ─── CustomerInfoDrawer / SiteInfoDrawer ───────────────────────────────────────
//
// Quick-view read-only, aperta senza lasciare Site Repository (a differenza dei
// drawer completi di /customers e /sites, qui non c'è tab Siti/Inventari: sono
// già visibili inline nella pagina stessa, quindi sarebbero ridondanti). Stessi
// componenti condivisi (DrawerShell/DrawerSection/DrawerFieldList) dei drawer
// "ufficiali", per coerenza visiva — ma nessuna azione di modifica/eliminazione:
// quelle restano di competenza delle pagine Clienti/Siti.

function customerAddressFromDetail(detail: CustomerDetail | null): string | null {
  const cf = detail?.custom_fields ?? null
  if (!isRecord(cf)) return null
  const key = Object.keys(cf).find((k) => k.trim().toLowerCase() === 'indirizzo')
  if (!key) return null
  const v = cf[key]
  if (typeof v !== 'string' || !v.trim()) return null
  const parts = [v.trim(), detail?.city?.trim()].filter(Boolean)
  return parts.join(', ')
}

export function CustomerInfoDrawer({
  open, detail, detailLoading, selectedId, onClose,
}: {
  open: boolean
  detail: CustomerDetail | null
  detailLoading: boolean
  selectedId: number | null
  onClose: () => void
}) {
  const address = React.useMemo(() => customerAddressFromDetail(detail), [detail])

  return (
    <DrawerShell
      open={open} onClose={onClose} gradient="teal"
      statusLabel={detail?.status_label ? `● ${detail.status_label}` : undefined}
      title={detail?.display_name || detail?.name || (selectedId ? `Cliente #${selectedId}` : 'Cliente')}
      subtitle={detail?.city || undefined}
      loading={detailLoading}
    >
      {detailLoading ? <DrawerLoadingState /> : !detail ? <DrawerEmptyState /> : (
        <>
          <DrawerSection icon={<PersonOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Contatto primario">
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{detail.primary_contact_name || '—'}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{detail.primary_contact_email || ''}</Typography>
              </Box>
              {detail.primary_contact_phone ? (
                <Chip size="small" label={detail.primary_contact_phone} sx={{ bgcolor: '#f0fdf4', color: (theme) => theme.palette.primary.main, border: '1px solid #bbf7d0', fontWeight: 600, fontSize: 11 }} />
              ) : null}
            </Stack>
          </DrawerSection>

          <DrawerSection icon={<MonitorOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Informazioni">
            <DrawerFieldList rows={[
              { label: 'Codice', value: detail.code, mono: true, copy: true },
              ...(detail.vat_number ? [{ label: 'P.IVA', value: detail.vat_number, mono: true }] : []),
              ...(detail.tax_code ? [{ label: 'Cod. fiscale', value: detail.tax_code, mono: true }] : []),
            ]} />
          </DrawerSection>

          {(detail.tags ?? []).length > 0 && (
            <DrawerSection icon={<LocalOfferOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Tag">
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {(detail.tags ?? []).map((t) => <Chip key={t} size="small" label={t} variant="outlined" />)}
              </Stack>
            </DrawerSection>
          )}

          {detail.has_vpn ? (
            <DrawerSection icon={<VpnLockIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="VPN" variant="muted">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Cliente con accesso VPN configurato.</Typography>
            </DrawerSection>
          ) : null}

          {address ? (
            <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
              <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Indirizzo
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{address}</Typography>
              </Box>
              <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100' }}>
                <LeafletMap address={address} height={280} zoom={15} />
              </Box>
            </Box>
          ) : null}

          <DrawerSection icon={<NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Note" variant="muted">
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.notes || '—'}</Typography>
          </DrawerSection>
        </>
      )}
    </DrawerShell>
  )
}

function siteCustomerLabel(site: SiteDetail | null) {
  return site?.customer_display_name || site?.customer_name || site?.customer_code || ''
}

export function SiteInfoDrawer({
  open, detail, detailLoading, selectedId, onClose,
}: {
  open: boolean
  detail: SiteDetail | null
  detailLoading: boolean
  selectedId: number | null
  onClose: () => void
}) {
  const siteAddress = React.useMemo(() => {
    if (!detail) return null
    const parts = [detail.address_line1?.trim(), detail.city?.trim()].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  }, [detail])

  const subtitle = detail?.city
    ? `${detail.city}${detail.postal_code ? ` ${detail.postal_code}` : ''}`
    : undefined

  return (
    <DrawerShell
      open={open} onClose={onClose} gradient="teal"
      statusLabel={detail?.status_label ? `● ${detail.status_label}` : undefined}
      title={detail?.display_name || detail?.name || (selectedId ? `Sito #${selectedId}` : 'Sito')}
      subtitle={subtitle}
      loading={detailLoading}
    >
      {detailLoading ? <DrawerLoadingState /> : !detail ? <DrawerEmptyState /> : (
        <>
          <DrawerSection icon={<BusinessOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Identificazione">
            <DrawerFieldList rows={[
              { label: 'Nome', value: detail.name, copy: true },
              ...(detail.display_name && detail.display_name !== detail.name ? [{ label: 'Nome visualizzato', value: detail.display_name }] : []),
              { label: 'Cliente', value: siteCustomerLabel(detail) },
            ]} />
          </DrawerSection>

          <DrawerSection icon={<PersonOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Contatto primario">
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{detail.primary_contact_name || '—'}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{detail.primary_contact_email || ''}</Typography>
              </Box>
              {detail.primary_contact_phone ? (
                <Chip size="small" label={detail.primary_contact_phone} sx={{ bgcolor: '#f0fdf4', color: (theme) => theme.palette.primary.main, border: '1px solid #bbf7d0', fontWeight: 600, fontSize: 11 }} />
              ) : null}
            </Stack>
          </DrawerSection>

          {siteAddress ? (
            <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden' }}>
              <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                  <LocationOnOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />Indirizzo
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{siteAddress}</Typography>
              </Box>
              <Box sx={{ borderTop: '1px solid', borderColor: 'grey.100' }}>
                <LeafletMap address={siteAddress} height={280} zoom={15} />
              </Box>
            </Box>
          ) : null}

          {detail.notes ? (
            <DrawerSection icon={<NotesOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />} title="Note" variant="muted">
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.notes}</Typography>
            </DrawerSection>
          ) : null}
        </>
      )}
    </DrawerShell>
  )
}
