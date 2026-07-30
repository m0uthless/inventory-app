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
import { api } from '@shared/api/client'

// ─── Sorgenti aggregate ─────────────────────────────────────────────────────
// Questa campanella unisce due sorgenti di scadenze:
//  - manutenzione (inventory in scadenza entro 30 giorni)
//  - task di area (scadenza entro domani o già scaduta, solo propria area)
// Ogni sorgente resta indipendente lato backend; qui vengono solo unite e
// ordinate per giorni rimanenti.

type MaintenanceRow = {
  plan_id: number
  inventory_id: number
  inventory_name: string
  customer_name: string
  type_label?: string | null
  knumber?: string | null
  hostname?: string | null
  next_due_date: string
}

type AreaTaskRow = {
  id: number
  title: string
  area_label: string
  due_date: string
}

type NotifItem = {
  key: string
  kind: 'maintenance' | 'area_task'
  title: string
  subtitle: string
  days_left: number
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
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null)

  React.useEffect(() => {
    if (!enabled) return

    const fetchAll = () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const in30Date = new Date(today)
      in30Date.setDate(in30Date.getDate() + 30)
      const todayStr = today.toLocaleDateString('en-CA')   // YYYY-MM-DD locale-safe
      const in30Str  = in30Date.toLocaleDateString('en-CA')

      const maintenanceP = api
        .get('/maintenance-plans/todo/', {
          params: { due_from: todayStr, due_to: in30Str, ordering: 'next_due_date', page_size: 40 },
        })
        .then((res) => {
          const rows: MaintenanceRow[] = res.data?.results ?? []
          return rows.map((r): NotifItem => ({
            key: `m-${r.plan_id}-${r.inventory_id}`,
            kind: 'maintenance',
            title: r.inventory_name,
            subtitle: [r.customer_name, r.type_label, r.knumber || r.hostname].filter(Boolean).join(' · '),
            days_left: daysLeft(r.next_due_date, today),
          }))
        })
        .catch(() => [] as NotifItem[])

      const areaTasksP = api
        .get('/area-tasks/due/')
        .then((res) => {
          const rows: AreaTaskRow[] = res.data ?? []
          return rows.map((r): NotifItem => ({
            key: `a-${r.id}`,
            kind: 'area_task',
            title: r.title,
            subtitle: `Area ${r.area_label}`,
            days_left: daysLeft(r.due_date, today),
          }))
        })
        .catch(() => [] as NotifItem[])

      Promise.all([maintenanceP, areaTasksP]).then(([maintenance, areaTasks]) => {
        setItems([...maintenance, ...areaTasks].sort((a, b) => a.days_left - b.days_left))
      })
    }

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
  }, [enabled])

  const close = () => setAnchor(null)
  const goTo = (item: NotifItem) => { close(); nav(item.kind === 'maintenance' ? '/maintenance' : '/') }

  const tooltipTitle = items.length
    ? `${items.length} scadenz${items.length === 1 ? 'a' : 'e'} imminenti`
    : 'Nessuna scadenza imminente'

  return (
    <>
      <Tooltip title={tooltipTitle}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} size="small">
          <Badge badgeContent={items.length || null} color="warning" max={99}>
            <NotificationsOutlinedIcon
              fontSize="small"
              sx={{ color: items.length ? 'warning.main' : 'inherit' }}
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
            Scadenze
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Manutenzione (30 giorni) e task di area (domani/scaduti)
          </Typography>
        </Box>

        {items.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              ✅ Nessuna scadenza imminente
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            <Stack divider={<Divider />}>
              {items.map((item) => (
                <ListItemButton
                  key={item.key}
                  onClick={() => goTo(item)}
                  sx={{ px: 2, py: 1 }}
                >
                  {item.kind === 'maintenance' ? (
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
                  ) : (
                    <GroupsRoundedIcon
                      sx={{
                        fontSize: 16,
                        color: item.days_left < 0 ? 'error.main' : 'warning.main',
                        mr: 1.25,
                        flexShrink: 0,
                        mt: 0.25,
                      }}
                    />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
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
