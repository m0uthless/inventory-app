import * as React from 'react'
import { Avatar, Box, Card, Chip, Divider, Stack, Typography } from '@mui/material'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import { useNavigate } from 'react-router-dom'
import { api } from '@shared/api/client'
import { PRIORITY_META } from '../features/issues/types'
import type { IssueRow } from '../features/issues/types'

const PRIORITY_BAR: Record<string, string> = {
  critical: '#d32f2f',
  high:     '#ed6c02',
  medium:   '#0288d1',
  low:      '#9e9e9e',
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)           return 'adesso'
  if (diff < 3600)         return `${Math.floor(diff / 60)} min fa`
  if (diff < 86400)        return `${Math.floor(diff / 3600)} ore fa`
  if (diff < 86400 * 2)    return 'ieri'
  if (diff < 86400 * 7)    return `${Math.floor(diff / 86400)} giorni fa`
  return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

export default function RecentIssuesCard() {
  const navigate = useNavigate()
  const [issues, setIssues]       = React.useState<IssueRow[]>([])
  const [totalOpen, setTotalOpen] = React.useState<number>(0)
  const [critical, setCritical]   = React.useState<number>(0)
  const [loading, setLoading]     = React.useState(true)

  React.useEffect(() => {
    api.get<{ results: IssueRow[]; count: number }>('/issues/', {
      params: { status: 'open', ordering: '-created_at', page_size: 5 },
    }).then(r => {
      setIssues(r.data.results)
      setTotalOpen(r.data.count)
      setCritical(r.data.results.filter(i => i.priority === 'critical').length)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 1, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ErrorOutlineRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700}>Issues aperti</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          {!loading && (
            <Typography variant="caption" color="text.secondary">
              {totalOpen} totali
            </Typography>
          )}
          {critical > 0 && (
            <Chip
              size="small"
              label={`${critical} ${critical === 1 ? 'critico' : 'critici'}`}
              color="error"
              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
            />
          )}
        </Stack>
      </Box>

      {/* Lista */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled">Caricamento...</Typography>
          </Box>
        ) : issues.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled">Nessun issue aperto</Typography>
          </Box>
        ) : (
          <Stack divider={<Divider />}>
            {issues.map(issue => {
              const meta     = PRIORITY_META[issue.priority] ?? { label: issue.priority, color: 'default' as const }
              const barColor = PRIORITY_BAR[issue.priority] ?? '#9e9e9e'
              const assignee = issue.assigned_to_full_name || issue.assigned_to_username || null

              return (
                <Stack
                  key={issue.id}
                  direction="row"
                  alignItems="center"
                  spacing={1.25}
                  sx={{
                    px: 2, py: 1.1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    transition: 'background 0.15s',
                  }}
                  onClick={() => navigate('/issues')}
                >
                  {/* Barra priorità */}
                  <Box sx={{ width: 3, height: 34, borderRadius: '999px', bgcolor: barColor, flexShrink: 0 }} />

                  {/* Testo */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      noWrap
                      sx={{ fontSize: '0.82rem' }}
                    >
                      {issue.title}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
                      {assignee ? (
                        <>
                          {issue.assigned_to_avatar ? (
                            <Avatar src={issue.assigned_to_avatar} sx={{ width: 14, height: 14 }} />
                          ) : (
                            <Avatar sx={{ width: 14, height: 14, fontSize: '0.55rem', bgcolor: 'primary.main' }}>
                              {assignee[0].toUpperCase()}
                            </Avatar>
                          )}
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                            {assignee}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>·</Typography>
                        </>
                      ) : (
                        <>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
                            Non assegnato
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>·</Typography>
                        </>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                        {timeAgo(issue.created_at)}
                      </Typography>
                    </Stack>
                  </Box>

                  {/* Chip priorità */}
                  <Chip
                    size="small"
                    label={meta.label}
                    color={meta.color}
                    variant={meta.color === 'default' ? 'outlined' : 'filled'}
                    sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}
                  />
                </Stack>
              )
            })}
          </Stack>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: 2, py: 1,
          borderTop: '1px solid', borderColor: 'divider',
          textAlign: 'center',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={() => navigate('/issues')}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          Vedi tutti gli issues →
        </Typography>
      </Box>
    </Card>
  )
}
