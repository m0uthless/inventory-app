import * as React from 'react'
import { Button, Chip, IconButton, List, ListItem, ListItemText, Stack, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { buildDrfListParams } from '@shared/api/drf'
import { apiErrorToMessage } from '@shared/api/error'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useToast } from '@shared/ui/toast'
import { useAuth } from '../../auth/AuthProvider'
import { PERMS } from '../../auth/perms'
import { RelatedListBody } from '../entityRelations/RelatedListSection'
import DeviceDialog from './DeviceDialog'
import { deviceLabel, type DeviceListItem } from './types'

/** Tab "Device" del drawer Cliente: elenco compatto + creazione/modifica dei campi base. */
export default function CustomerDevicesTab({ customerId }: { customerId: number }) {
  const theme = useTheme()
  const toast = useToast()
  const { hasPerm } = useAuth()
  const canAdd = hasPerm(PERMS.device.device.add)
  const canChange = hasPerm(PERMS.device.device.change)

  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<DeviceListItem | null>(null)

  const params = React.useMemo(
    () => buildDrfListParams({ page0: 0, pageSize: 200, ordering: 'type__name', extra: { customer: customerId } }),
    [customerId],
  )
  const { rows, rowCount, loading, reload } = useDrfList<DeviceListItem>('/devices/', params, (e: unknown) =>
    toast.error(apiErrorToMessage(e)),
  )

  const openCreate = () => {
    setEditing(null)
    setDlgOpen(true)
  }

  return (
    <Stack spacing={1.25} sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
            Device
          </Typography>
          <Chip size="small" label={rowCount} />
        </Stack>
        {canAdd ? (
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Nuovo device
          </Button>
        ) : null}
      </Stack>

      <RelatedListBody loading={loading} isEmpty={rows.length === 0} emptyText="Nessun device per questo cliente.">
        <List dense disablePadding sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
          {rows.map((d, idx) => (
            <ListItem
              key={d.id}
              sx={{
                py: 0.75,
                bgcolor: idx % 2 === 1 ? alpha(theme.palette.text.primary, 0.03) : 'transparent',
              }}
              secondaryAction={
                canChange ? (
                  <Tooltip title="Modifica device">
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label="Modifica device"
                      onClick={() => {
                        setEditing(d)
                        setDlgOpen(true)
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : undefined
              }
            >
              <ListItemText
                primary={deviceLabel(d)}
                secondary={[d.site_display_name || d.site_name, d.inventario ? `Inv. ${d.inventario}` : null]
                  .filter(Boolean)
                  .join(' · ') || undefined}
                primaryTypographyProps={{ noWrap: true, variant: 'body2', sx: { fontWeight: 600 } }}
                secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
              />
              {d.status_name ? <Chip size="small" label={d.status_name} sx={{ ml: 1, mr: canChange ? 3 : 0 }} /> : null}
            </ListItem>
          ))}
        </List>
      </RelatedListBody>

      <DeviceDialog
        open={dlgOpen}
        customerId={customerId}
        device={editing}
        onClose={() => setDlgOpen(false)}
        onSaved={() => {
          setDlgOpen(false)
          reload()
        }}
      />
    </Stack>
  )
}
