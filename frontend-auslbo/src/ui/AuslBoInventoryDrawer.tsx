import * as React from 'react'
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { DrawerShell, HERO_ICON_BTN_SX, FEATURE_CHIP_SX } from '@shared/ui/DrawerShell'
import { DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import type { InventoryReadDetail } from '@shared/inventory/inventoryTypes'
import InventoryReadContent from '@shared/inventory/InventoryReadContent'

// AuslBoInventoryDetail estende InventoryReadDetail senza aggiungere campi
// (alias esplicito per chiarezza nei consumer)
export type AuslBoInventoryDetail = InventoryReadDetail

export interface AuslBoInventoryDrawerProps {
  id: number | null
  onClose: () => void
}

export default function AuslBoInventoryDrawer({ id, onClose }: AuslBoInventoryDrawerProps) {
  const open = id !== null
  const [drawerTab, setDrawerTab] = React.useState(0)
  const [detail, setDetail] = React.useState<AuslBoInventoryDetail | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!id) return
    setDetail(null); setError(null); setLoading(true); setDrawerTab(0)
    api.get<AuslBoInventoryDetail>(`/inventories/${id}/`)
      .then((res) => setDetail(res.data))
      .catch((e) => setError(apiErrorToMessage(e)))
      .finally(() => setLoading(false))
  }, [id])

  const handleClose = () => {
    onClose()
    setTimeout(() => { setDetail(null); setError(null) }, 300)
  }

  const title = detail?.hostname || detail?.name || detail?.knumber || (id ? `#${id}` : '—')
  const subtitleParts = [
    detail?.name && detail?.hostname && detail.name !== detail.hostname ? detail.name : null,
    detail?.site_display_name || detail?.site_name,
  ].filter(Boolean) as string[]

  const statusSlot = (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Tooltip title="Chiudi">
        <IconButton size="small" onClick={handleClose} sx={HERO_ICON_BTN_SX}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {detail?.status_label ? (
        <Box
          sx={{
            bgcolor: 'rgba(93,174,240,0.20)', color: '#93C9F8', fontWeight: 700,
            fontSize: 10, letterSpacing: '0.07em', border: '1px solid rgba(147,201,248,0.3)',
            borderRadius: '4px', px: 1, py: 0.25, display: 'inline-flex', alignItems: 'center', gap: 0.5,
          }}
        >
          ● {detail.status_label}
        </Box>
      ) : null}
    </Stack>
  )

  const actions = (
    <Tooltip title="Chiudi">
      <IconButton size="small" onClick={handleClose} sx={HERO_ICON_BTN_SX}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )

  const extraChips = detail?.type_label ? (
    <Chip size="small" label={detail.type_label} sx={FEATURE_CHIP_SX} />
  ) : undefined

  return (
    <DrawerShell
      open={open} onClose={handleClose} width={368} gradient="blue"
      statusSlot={statusSlot} actions={actions}
      title={title}
      subtitle={subtitleParts.join(' · ') || undefined}
      loading={loading}
      tabs={['Dettagli']}
      tabValue={drawerTab} onTabChange={setDrawerTab}
      extraChips={extraChips}
    >
      {loading ? <DrawerLoadingState /> : null}
      {error && !loading ? (
        <Typography variant="body2" color="error">{error}</Typography>
      ) : null}
      {!loading && detail ? <InventoryReadContent detail={detail} /> : null}
      {!loading && !detail && !error ? <DrawerEmptyState /> : null}
    </DrawerShell>
  )
}
