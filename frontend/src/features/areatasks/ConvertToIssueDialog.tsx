import * as React from 'react'
import {
  Alert, Autocomplete, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { isRecord } from '@shared/utils/guards'
import { PRIORITY_META, extractFieldErrors, type AreaTaskRow } from './types'

type CustomerOption = { id: number; label: string }
type SiteOption = { id: number; label: string }

type Props = {
  open: boolean
  task: AreaTaskRow | null
  onClose: () => void
  onConverted: (result: { task: AreaTaskRow; issue: { id: number; title: string } }) => void
}

// Campi mostrati come helperText dedicato (title, customer) o come Alert
// (detail, non_field_errors — es. 403 "non puoi..."/area sbagliata). Il resto
// (site, description, ...) non ha un punto dedicato nel dialog e finisce in
// toast tramite hiddenFieldMessages, così nessun errore resta silenzioso.
const RENDERED_ERROR_KEYS = ['title', 'customer', 'detail', 'non_field_errors']

// Messaggi 400/403/404 su campi che il dialog non mostra (site, description, ...).
// Stesso pattern di AreaTaskDetail.tsx.
function hiddenFieldMessages(e: unknown): string {
  const data = (e as { response?: { data?: unknown } })?.response?.data
  if (!isRecord(data)) return ''
  return Object.entries(data)
    .filter(([k]) => !RENDERED_ERROR_KEYS.includes(k))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : String(v)}`)
    .join(' | ')
}

function toIdLabel(v: unknown, labelKeys: string[]): { id: number; label: string } | null {
  if (!isRecord(v)) return null
  const id = Number(v['id'])
  if (!Number.isFinite(id)) return null
  for (const k of labelKeys) {
    const val = v[k]
    if (typeof val === 'string' && val.trim()) return { id, label: val }
  }
  return { id, label: String(id) }
}

function toList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (isRecord(payload) && Array.isArray(payload['results'])) return payload['results'] as unknown[]
  return []
}

export default function ConvertToIssueDialog({ open, task, onClose, onConverted }: Props) {
  const toast = useToast()

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [customer, setCustomer] = React.useState<CustomerOption | null>(null)
  const [custInput, setCustInput] = React.useState('')
  const [custOptions, setCustOptions] = React.useState<CustomerOption[]>([])
  const [custLoading, setCustLoading] = React.useState(false)
  const [siteId, setSiteId] = React.useState<number | ''>('')
  const [siteOptions, setSiteOptions] = React.useState<SiteOption[]>([])
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Riparte da zero quando si apre il dialog per un task diverso.
  React.useEffect(() => {
    if (!open || !task) return
    setTitle(task.title)
    setDescription(task.description || '')
    setCustomer(null)
    setCustInput('')
    setCustOptions([])
    setSiteId('')
    setSiteOptions([])
    setErrors({})
    // Chiave sull'id, non sull'oggetto `task`: `AreaTaskDetail` sostituisce `current`
    // (quindi `task`) ad ogni `apply()` di un aggiornamento in background (commento,
    // link/unlink file, ...) anche mentre questo dialog è aperto — non deve resettare
    // i campi che l'utente ha già modificato per lo stesso task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id])

  // ── Autocomplete cliente (debounce ~300ms, stesso pattern di Issues.tsx) ────
  React.useEffect(() => {
    if (!open) return
    let alive = true
    const t = setTimeout(async () => {
      setCustLoading(true)
      try {
        const r = await api.get('/customers/', { params: { search: custInput || undefined, page_size: 25 } })
        const list = toList(r.data)
        if (alive) {
          setCustOptions(
            list
              .map((c) => toIdLabel(c, ['display_name', 'name']))
              .filter((x): x is CustomerOption => Boolean(x)),
          )
        }
      } catch {
        /* silent */
      } finally {
        if (alive) setCustLoading(false)
      }
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [custInput, open])

  // ── Siti del cliente selezionato ────────────────────────────────────────────
  React.useEffect(() => {
    if (!customer) {
      setSiteOptions([])
      setSiteId('')
      return
    }
    let alive = true
    api.get('/sites/', { params: { customer: customer.id, page_size: 100 } })
      .then((r) => {
        if (!alive) return
        const list = toList(r.data)
        setSiteOptions(
          list
            .map((s) => toIdLabel(s, ['display_name', 'name']))
            .filter((x): x is SiteOption => Boolean(x)),
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [customer])

  const submit = async () => {
    if (!task || !customer || saving) return
    setSaving(true)
    setErrors({})
    try {
      const r = await api.post<{ task: AreaTaskRow; issue: { id: number; title: string } }>(
        `/area-tasks/${task.id}/convert-to-issue/`,
        { customer: customer.id, site: siteId || undefined, title, description },
      )
      onConverted(r.data)
      onClose()
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        toast.error('Questo task è già stato trasformato in issue.')
      } else {
        const fields = extractFieldErrors(e)
        if (Object.keys(fields).length > 0) {
          setErrors(fields)
          const hidden = hiddenFieldMessages(e)
          if (hidden) toast.error(hidden)
        } else toast.error(apiErrorToMessage(e))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>Trasforma in issue</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label="Titolo *" size="small" fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={Boolean(errors.title)} helperText={errors.title}
          />
          <TextField
            label="Descrizione" size="small" fullWidth multiline rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Priorità:</Typography>
            {task ? <Chip size="small" label={PRIORITY_META[task.priority].label} /> : null}
          </Stack>

          <Autocomplete
            size="small"
            value={customer}
            inputValue={custInput}
            onInputChange={(_, value) => setCustInput(value)}
            onChange={(_, value) => setCustomer(value)}
            options={custOptions}
            loading={custLoading}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Cliente *"
                size="small"
                error={Boolean(errors.customer)}
                helperText={errors.customer}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {custLoading ? <CircularProgress size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          {customer ? (
            <FormControl size="small" fullWidth>
              <InputLabel>Sito</InputLabel>
              <Select
                value={siteId}
                label="Sito"
                onChange={(e) => setSiteId(e.target.value as number | '')}
              >
                <MenuItem value=""><em>Nessuno</em></MenuItem>
                {siteOptions.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}

          {errors.detail || errors.non_field_errors ? (
            <Alert severity="error">{errors.detail || errors.non_field_errors}</Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="text" onClick={onClose} disabled={saving}>Annulla</Button>
        <Button
          variant="contained"
          onClick={() => { void submit() }}
          disabled={saving || !customer}
          sx={{ minWidth: 140 }}
        >
          {saving ? <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} /> : null}
          Conferma
        </Button>
      </DialogActions>
    </Dialog>
  )
}
