import * as React from 'react'
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { api } from '@shared/api/client'
import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'

type SearchResult = {
  kind: string
  id: number
  title: string
  subtitle?: string | null
  path?: string | null
}

type SearchResponse = {
  q: string
  results: SearchResult[]
}

const KIND_LABEL: Record<string, string> = {
  inventory: 'Inventario',
  customer: 'Clienti',
  site: 'Siti',
  contact: 'Contatti',
  drive_folder: 'Drive · Cartelle',
  drive_file: 'Drive · File',
  maintenance_plan: 'Manutenzione',
  wiki_page: 'Wiki',
}

function groupByKind(results: SearchResult[]): Record<string, SearchResult[]> {
  return results.reduce(
    (acc, r) => {
      ;(acc[r.kind] ||= []).push(r)
      return acc
    },
    {} as Record<string, SearchResult[]>,
  )
}

function isCanceledError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    ('name' in err ? (err as { name?: unknown }).name === 'CanceledError' : false)
  )
}

export default function Search() {
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()
  const [sp, setSp] = useSearchParams()

  React.useEffect(() => {
    const legacy = (sp.get('q') ?? '').trim()
    const cur = (sp.get('search') ?? '').trim()
    if (legacy && !cur) {
      const nextParams = new URLSearchParams(sp)
      nextParams.set('search', legacy)
      nextParams.delete('q')
      setSp(nextParams, { replace: true })
    }
  }, [sp, setSp])

  const q = (sp.get('search') ?? '').trim()

  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<SearchResult[]>([])

  const returnTo = React.useMemo(() => loc.pathname + loc.search, [loc.pathname, loc.search])

  React.useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      if (!q) {
        setResults([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const resp = await api.get<SearchResponse>('/search/', {
          params: { q },
          signal: controller.signal,
        })
        setResults(resp.data.results ?? [])
      } catch (e) {
        if (!isCanceledError(e)) toast.error(apiErrorToMessage(e))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [q, toast])

  const groups = React.useMemo(() => groupByKind(results), [results])

  const openInModule = (r: SearchResult) => {
    if (r.path) {
      navigate(r.path)
      return
    }

    const encodedReturn = encodeURIComponent(returnTo)
    if (r.kind === 'inventory') {
      navigate(`/inventory?search=${encodeURIComponent(q)}&open=${r.id}&return=${encodedReturn}`)
      return
    }
    if (r.kind === 'customer') {
      navigate(`/customers?search=${encodeURIComponent(q)}&open=${r.id}&return=${encodedReturn}`)
      return
    }
    if (r.kind === 'site') {
      navigate(`/sites?search=${encodeURIComponent(q)}&open=${r.id}&return=${encodedReturn}`)
      return
    }
    if (r.kind === 'contact') {
      navigate(`/contacts?search=${encodeURIComponent(q)}&open=${r.id}&return=${encodedReturn}`)
      return
    }
    if (r.kind === 'maintenance_plan') {
      navigate(`/maintenance?tab=plans&open=${r.id}&return=${encodedReturn}`)
      return
    }
    if (r.kind === 'wiki_page') {
      navigate(`/wiki/${r.id}`)
      return
    }
    if (r.kind === 'drive_folder' || r.kind === 'drive_file') {
      navigate('/drive')
      return
    }
    toast.error('Deep-link drawer non ancora attivo per questo tipo di risultato.')
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <TextField
          label="Cerca"
          value={q}
          onChange={(e) => {
            const next = e.target.value
            const nextParams = new URLSearchParams(sp)
            nextParams.set('search', next)
            nextParams.delete('q')
            setSp(nextParams, { replace: true })
          }}
          placeholder="Cliente, sito, inventario…"
          size="small"
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {q && results.length === 0 ? (
              <Typography color="text.secondary">Nessun risultato per “{q}”.</Typography>
            ) : null}

            {Object.entries(KIND_LABEL).map(([kind, label]) => {
              const items = groups[kind] ?? []
              if (!items.length) return null
              return (
                <Card key={kind} variant="outlined">
                  <CardContent>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                      {label}
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    <List dense disablePadding>
                      {items.map((r) => (
                        <ListItemButton
                          key={`${r.kind}-${r.id}`}
                          onClick={() => openInModule(r)}
                          sx={{ borderRadius: 1 }}
                        >
                          <ListItemText
                            primary={r.title}
                            secondary={r.subtitle ?? undefined}
                            primaryTypographyProps={{ fontWeight: 600 }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
