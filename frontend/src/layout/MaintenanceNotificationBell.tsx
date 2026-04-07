import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Box,
  Chip,
  Divider,
  IconButton,
  ListItemButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import { api } from '@shared/api/client'

type DueItem = {
  plan_id: number
  plan_title: string
  inventory_id: number
  inventory_name: string
  customer_name: string
  customer_code: string
  site_name?: string | null
  knumber?: string | null
  hostname?: string | null
  type_label?: string | null
  next_due_date: string
  due_date_override?: string | null
  days_left: number
}

type Props = {
  /** Pass `me` (or any truthy value) to enable fetching; null/undefined disables it. */
  enabled: boolean
}

const POLL_INTERVAL_MS = 5 * 60 * 1000

export default function MaintenanceNotificationBell({ enabled }: Props) {
  const nav = useNavigate()
  const [duePlans, setDuePlans] = React.useState<DueItem[]>([])
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null)

  React.useEffect(() => {
    if (!enabled) return

    const fetchDue = () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const in30Date = new Date(today)
      in30Date.setDate(in30Date.getDate() + 30)
      const todayStr = today.toLocaleDateString('en-CA')   // YYYY-MM-DD locale-safe
      const in30Str  = in30Date.toLocaleDateString('en-CA')

      api
        .get('/maintenance-plans/todo/', {
          params: { due_from: todayStr, due_to: in30Str, ordering: 'next_due_date', page_size: 40 },
        })
        .then((res) => {
          const rows: Record<string, unknown>[] = res.data?.results ?? []
          const enriched: DueItem[] = rows.map((r) => {
            const due = new Date(String(r.next_due_date))
            due.setHours(0, 0, 0, 0)
            const days_left = Math.round((due.getTime() - today.getTime()) / 86_400_000)
            return { ...r, days_left } as DueItem
          })
          enriched.sort((a, b) => a.days_left - b.days_left)
          setDuePlans(enriched)
        })
        .catch(() => {})
    }

    fetchDue()
    const interval = setInterval(fetchDue, POLL_INTERVAL_MS)
    // Aggiorna il badge quando DueDateOverrideDialog salva un override
    window.addEventListener('maintenance-due-date-changed', fetchDue)

    return () => {
      clearInterval(interval)
      window.removeEventListener('maintenance-due-date-changed', fetchDue)
    }
  }, [enabled])

  const close = () => setAnchor(null)
  const goMaintenance = () => { close(); nav('/maintenance') }

  const tooltipTitle = duePlans.length
    ? `${duePlans.length} scadenz${duePlans.length === 1 ? 'a' : 'e'} imminenti`
    : 'Nessuna scadenza imminente'

  return (
    <>
      <Tooltip title={tooltipTitle}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} size="small">
          <Badge badgeContent={duePlans.length || null} color="warning" max={99}>
            <NotificationsOutlinedIcon
              fontSize="small"
              sx={{ color: duePlans.length ? 'warning.main' : 'inherit' }}
            />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, borderRadius: 1, mt: 0.5 } }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Scadenze manutenzione
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Inventory in scadenza entro 30 giorni
          </Typography>
        </Box>

        {duePlans.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              ✅ Nessuna scadenza imminente
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            <Stack divider={<Divider />}>
              {duePlans.map((item) => (
                <ListItemButton
                  key={`${item.plan_id}-${item.inventory_id}`}
                  onClick={goMaintenance}
                  sx={{ px: 2, py: 1 }}
                >
                  <BuildOutlinedIcon
                    sx={{
                      fontSize: 16,
                      color:
                        item.days_left < 0
                          ? 'error.main'
                          : item.days_left <= 7
                            ? 'warning.main'
                            : 'info.main',
                      mr: 1.25,
                      flexShrink: 0,
                      mt: 0.25,
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                      {item.inventory_name}
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.15 }}>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ color: 'text.secondary', fontSize: '0.7rem', maxWidth: 120 }}
                      >
                        {item.customer_name}
                      </Typography>
                      {item.type_label && (
                        <>
                          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>·</Typography>
                          <Typography variant="caption" noWrap sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                            {item.type_label}
                          </Typography>
                        </>
                      )}
                      {(item.knumber || item.hostname) && (
                        <>
                          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>·</Typography>
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{ color: 'text.disabled', fontSize: '0.7rem', fontFamily: 'ui-monospace,monospace' }}
                          >
                            {item.knumber || item.hostname}
                          </Typography>
                        </>
                      )}
                    </Stack>
                  </Box>
                  <Chip
                    size="small"
                    label={
                      item.days_left < 0
                        ? `${Math.abs(item.days_left)}gg fa`
                        : item.days_left === 0
                          ? 'Oggi'
                          : item.days_left === 1
                            ? 'Domani'
                            : `${item.days_left}gg`
                    }
                    color={item.days_left < 0 ? 'error' : item.days_left <= 7 ? 'warning' : 'default'}
                    variant={item.days_left < 0 ? 'filled' : 'outlined'}
                    sx={{ fontSize: '0.68rem', ml: 1, flexShrink: 0, height: 20 }}
                  />
                </ListItemButton>
              ))}
            </Stack>
          </Box>
        )}

        <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <ListItemButton onClick={goMaintenance} sx={{ borderRadius: 1.5, justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
              Vai alle scadenze →
            </Typography>
          </ListItemButton>
        </Box>
      </Popover>
    </>
  )
}
