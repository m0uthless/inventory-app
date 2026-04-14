import * as React from 'react'
import { Typography } from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { DrawerLoadingState, DrawerEmptyState } from '@shared/ui/DrawerParts'
import DeviceDrawerFrame, { getDeviceDrawerTabs } from '@shared/device/DeviceDrawerFrame'
import DeviceReadContent from '@shared/device/DeviceReadContent'
import type { DeviceReadDetail } from '@shared/device/deviceTypes'

export type AuslBoDeviceDetail = DeviceReadDetail & {
  id: number
  status_name: string | null
  manufacturer_logo_url: string | null
  vlan: boolean
  wifi: boolean
  rispacs: boolean
  dose: boolean
}

export interface AuslBoDeviceDrawerProps {
  id: number | null
  onClose: () => void
}

export default function AuslBoDeviceDrawer({ id, onClose }: AuslBoDeviceDrawerProps) {
  const open = id !== null
  const [drawerTab, setDrawerTab] = React.useState(0)
  const [detail, setDetail] = React.useState<AuslBoDeviceDetail | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!id) return
    setDetail(null)
    setError(null)
    setLoading(true)
    setDrawerTab(0)

    api
      .get<AuslBoDeviceDetail>(`/devices/${id}/`)
      .then((res) => setDetail(res.data))
      .catch((error) => setError(apiErrorToMessage(error)))
      .finally(() => setLoading(false))
  }, [id])

  const handleClose = () => {
    onClose()
    setTimeout(() => {
      setDetail(null)
      setError(null)
    }, 300)
  }

  const hasRispacs = (detail?.rispacs_links?.length ?? 0) > 0
  const hasWifi = !!detail?.wifi_detail
  const tabs = getDeviceDrawerTabs(hasRispacs, hasWifi)

  return (
    <DeviceDrawerFrame
      open={open}
      onClose={handleClose}
      detail={detail}
      title={detail?.model || detail?.type_name || (id ? `Device #${id}` : '—')}
      subtitle={detail?.site_display_name || detail?.site_name || undefined}
      loading={loading}
      tabs={tabs}
      tabValue={drawerTab}
      onTabChange={setDrawerTab}
    >
      {loading ? <DrawerLoadingState /> : null}
      {error && !loading ? (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      ) : null}
      {!loading && detail ? <DeviceReadContent detail={detail} tabValue={drawerTab} /> : null}
      {!loading && !detail && !error ? <DrawerEmptyState /> : null}
    </DeviceDrawerFrame>
  )
}
