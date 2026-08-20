import * as React from 'react'
import { Box, InputBase, Typography } from '@mui/material'
import StickyNote2RoundedIcon from '@mui/icons-material/StickyNote2Rounded'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'

type StickyNote = {
  text: string
  updated_at: string
}

const AUTOSAVE_DEBOUNCE_MS = 800
const MAX_LENGTH = 2000

// Nota personale dell'utente, widget dashboard 'sticky-note'. Una sola nota
// per utente (get-or-create lato backend su /api/sticky-note/), salvataggio
// automatico debounced mentre si scrive — nessun pulsante "Salva".
export default function StickyNoteCard() {
  const { error: toastError } = useToast()

  const [text, setText]         = React.useState('')
  const [loading, setLoading]   = React.useState(true)
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved'>('idle')

  // Testo effettivamente confermato dal server: usato per capire se ci sono
  // modifiche locali non ancora salvate quando lo scheduling del debounce
  // viene interrotto (es. componente smontato).
  const lastSavedText = React.useRef('')
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    api.get<StickyNote>('/sticky-note/')
      .then(r => {
        setText(r.data.text)
        lastSavedText.current = r.data.text
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = React.useCallback((value: string) => {
    setSaveState('saving')
    api.patch<StickyNote>('/sticky-note/', { text: value })
      .then(r => {
        lastSavedText.current = r.data.text
        setSaveState('saved')
      })
      .catch(err => {
        setSaveState('idle')
        toastError(apiErrorToMessage(err))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (value: string) => {
    setText(value)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(value), AUTOSAVE_DEBOUNCE_MS)
  }

  // Salva subito eventuali modifiche pendenti allo smontaggio (es. si
  // cambia pagina prima dello scadere del debounce).
  React.useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        if (text !== lastSavedText.current) {
          api.patch('/sticky-note/', { text }).catch(() => {})
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 1,
        overflow: 'hidden',
        // Eccezione intenzionale: metafora "post-it giallo" — colore carta e
        // testo neri fissi indipendenti dal tema, come la fascia rossa di
        // CalendarCard.
        bgcolor: '#fff8b8',
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px)',
        backgroundSize: '100% 28px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 1.75, py: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <StickyNote2RoundedIcon sx={{ fontSize: 16, color: 'rgba(0,0,0,0.45)' }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: 'rgba(0,0,0,0.65)' }}>
            Nota
          </Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.65rem',
            color: 'rgba(0,0,0,0.4)',
            opacity: saveState === 'idle' ? 0 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {saveState === 'saving' ? 'Salvataggio…' : 'Salvato'}
        </Typography>
      </Box>

      {/* Testo */}
      <Box sx={{ flex: 1, px: 1.75, pb: 1.5, minHeight: 0 }}>
        {loading ? (
          <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.4)' }}>
            Caricamento...
          </Typography>
        ) : (
          <InputBase
            multiline
            fullWidth
            value={text}
            onChange={e => handleChange(e.target.value)}
            placeholder="Scrivi un appunto..."
            inputProps={{ maxLength: MAX_LENGTH }}
            sx={{
              height: '100%',
              alignItems: 'flex-start',
              fontSize: '0.85rem',
              lineHeight: 1.75,
              color: 'rgba(0,0,0,0.78)',
              '& .MuiInputBase-input': {
                height: '100% !important',
                overflowY: 'auto',
              },
            }}
          />
        )}
      </Box>
    </Box>
  )
}
