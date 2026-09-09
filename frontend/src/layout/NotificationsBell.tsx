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
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import { api } from '@shared/api/client'

// ─── Notifiche persistite (0.9.5) ───────────────────────────────────────────
// La campanella legge da `/notifications/`, popolata periodicamente dal job
// backend `refresh_notifications` (stesse due sorgenti di prima: manutenzione
// in scadenza entro 30gg, task di area in scadenza/scaduti). A differenza
// della versione precedente (calcolo live a ogni apertura), qui c'è uno stato
// letto/non letto persistito lato server.

type NotificationType = 'maintenance_due' | 'area_task_due'

type NotifItem = {
  id: number
  notification_type: NotificationType
  title: string
  subtitle: string
  link: string
  event_date: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

type Props = {
  /** Pass `me` (or any truthy value) to enable fetching; null/undefined disables it. */
  enabled: boolean
}

const POLL_INTERVAL_MS = 5 * 60 * 1000

function daysLeft(dateStr: string, today: Date): number {
  const due = new Date(dateStr)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

export default function NotificationsBell({ enabled }: Props) {
  const nav = useNavigate()
  const [items, setItems] = React.useState<NotifItem[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null)

  const fetchAll = React.useCallback(() => {
    if (!enabled) return
    api
      .get('/notifications/', { params: { page_size: 50 } })
      .then((res) => {
        const rows: NotifItem[] = res.data?.results ?? res.data ?? []
        setItems(rows)
        setUnreadCount(rows.filter((r) => !r.is_read).length)
      })
      .catch(() => {})
  }, [enabled])

  React.useEffect(() => {
    if (!enabled) return
    fetchAll()
    const interval = setInterval(fetchAll, POLL_INTERVAL_MS)
    // Aggiorna il badge quando un override manutenzione o un task di area cambiano
    window.addEventListener('maintenance-due-date-changed', fetchAll)
    window.addEventListener('area-task-changed', fetchAll)

    return () => {
      clearInterval(interval)
      window.removeEventListener('maintenance-due-date-changed', fetchAll)
      window.removeEventListener('area-task-changed', fetchAll)
    }
  }, [enabled, fetchAll])

  const close = () => setAnchor(null)

  const markRead = (item: NotifItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.is_read) return
    api
      .post(`/notifications/${item.id}/mark_read/`)
      .then(() => {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i)))
        setUnreadCount((c) => Math.max(0, c - 1))
      })
      .catch(() => {})
  }

  const markAllRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!unreadCount) return
    api
      .post('/notifications/mark_all_read/')
      .then(() => {
        setItems((prev) => prev.map((i) => ({ ...i, is_read: true })))
        setUnreadCount(0)
      })
      .catch(() => {})
  }

  const goTo = (item: NotifItem, e: React.MouseEvent) => {
    markRead(item, e)
    close()
    nav(item.link || '/')
  }

  const tooltipTitle = unreadCount
    ? `${unreadCount} notific${unreadCount === 1 ? 'a' : 'he'} non lett${unreadCount === 1 ? 'a' : 'e'}`
    : 'Nessuna notifica non letta'

  const today = React.useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  return (
    <>
      <Tooltip title={tooltipTitle}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} size="small">
          <Badge badgeContent={unreadCount || null} color="warning" max={99}>
            <NotificationsOutlinedIcon
              fontSize="small"
              sx={{ color: unreadCount ? 'warning.main' : 'inherit' }}
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
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Notifiche
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Manutenzione (30 giorni) e task di area (domani/scaduti)
            </Typography>
          </Box>
          {unreadCount > 0 && (
            <Tooltip title="Segna tutte come lette">
              <IconButton size="small" onClick={markAllRead}>
                <DoneAllIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {items.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              ✅ Nessuna notifica
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            <Stack divider={<Divider />}>
              {items.map((item) => {
                const dl = daysLeft(item.event_date, today)
                return (
                  <ListItemButton
                    key={item.id}
                    onClick={(e) => goTo(item, e)}
                    sx={{ px: 2, py: 1, opacity: item.is_read ? 0.6 : 1 }}
                  >
                    {item.notification_type === 'maintenance_due' ? (
                      <BuildOutlinedIcon
                        sx={{
                          fontSize: 16,
                          color: dl < 0 ? 'error.main' : dl <= 7 ? 'warning.main' : 'info.main',
                          mr: 1.25,
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      />
                    ) : (
                      <GroupsRoundedIcon
                        sx={{
                          fontSize: 16,
                          color: dl < 0 ? 'error.main' : 'warning.main',
                          mr: 1.25,
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ fontWeight: item.is_read ? 500 : 700, fontSize: '0.82rem' }}
                      >
                        {item.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block' }}
                      >
                        {item.subtitle}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={
                        dl < 0 ? `${Math.abs(dl)}gg fa` : dl === 0 ? 'Oggi' : dl === 1 ? 'Domani' : `${dl}gg`
                      }
                      color={dl < 0 ? 'error' : dl <= 7 ? 'warning' : 'default'}
                      variant={dl < 0 ? 'filled' : 'outlined'}
                      sx={{ fontSize: '0.68rem', ml: 1, flexShrink: 0, height: 20 }}
                    />
                  </ListItemButton>
                )
              })}
            </Stack>
          </Box>
        )}

        <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <ListItemButton onClick={close} sx={{ borderRadius: 1.5, justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
              Chiudi
            </Typography>
          </ListItemButton>
        </Box>
      </Popover>
    </>
  )
}
