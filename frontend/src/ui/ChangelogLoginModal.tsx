import * as React from 'react'
import {
  Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControlLabel, Stack, Typography,
} from '@mui/material'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import { api } from '@shared/api/client'
import { useAuth } from '../auth/AuthProvider'
import MarkdownLite from './MarkdownLite'

type ChangelogEntry = {
  id: number
  version: string
  title: string
  body: string
  date: string
}

function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

/**
 * Mostrato una sola volta per ogni nuova pubblicazione di changelog, subito
 * dopo il login (o al caricamento dell'app se l'utente ha già una sessione
 * attiva). Richiede la spunta obbligatoria della checkbox per poter chiudere
 * il modal; la chiusura conferma la lettura lato server (POST /changelog/dismiss/)
 * così non ricompare finché non viene pubblicata una nuova voce.
 */
export default function ChangelogLoginModal() {
  const { me } = useAuth()
  const [entries, setEntries] = React.useState<ChangelogEntry[] | null>(null)
  const [checked, setChecked] = React.useState(false)
  const [dismissing, setDismissing] = React.useState(false)

  React.useEffect(() => {
    if (!me) {
      setEntries(null)
      return
    }
    let cancelled = false
    api.get<{ entries: ChangelogEntry[]; latest_id: number | null }>('/changelog/unseen/')
      .then(r => { if (!cancelled) setEntries(r.data.entries) })
      .catch(() => { if (!cancelled) setEntries([]) })
    return () => { cancelled = true }
  }, [me])

  const open = Boolean(entries && entries.length > 0)

  const handleClose = async () => {
    if (!checked || dismissing) return
    setDismissing(true)
    try {
      await api.post('/changelog/dismiss/')
    } catch {
      // Non bloccare l'utente per un errore di rete: se il dismiss fallisce
      // il modal ricomparirà al prossimo login, che è un fallback accettabile.
    } finally {
      setDismissing(false)
      setEntries([])
      setChecked(false)
    }
  }

  if (!open || !entries) return null

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle sx={{ py: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CampaignRoundedIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="subtitle1" fontWeight={700}>Novità in Archie</Typography>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2, maxHeight: '55vh' }}>
        <Stack divider={<Divider />} spacing={0}>
          {entries.map(item => (
            <Box key={item.id} sx={{ py: 1.75 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                {item.version && (
                  <Chip
                    label={`v${item.version}`}
                    size="small"
                    color="primary"
                    sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                  />
                )}
                <Typography variant="subtitle2" fontWeight={700}>{item.title}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  {fmtDate(item.date)}
                </Typography>
              </Stack>
              <MarkdownLite text={item.body} />
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Ho letto le novità</Typography>}
        />
        <Button
          variant="contained"
          size="small"
          disabled={!checked || dismissing}
          onClick={handleClose}
        >
          Chiudi
        </Button>
      </DialogActions>
    </Dialog>
  )
}
