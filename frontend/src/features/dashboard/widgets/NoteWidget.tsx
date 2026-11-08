import * as React from 'react'
import { Box, InputBase, Typography } from '@mui/material'
import StickyNote2RoundedIcon from '@mui/icons-material/StickyNote2Rounded'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import WidgetShell from './WidgetShell'
import { tintedBg, tintVeil } from './tints'

type StickyNote = { text: string; updated_at: string }
const AUTOSAVE_MS = 800
const MAX_LENGTH = 2000
const LINE = 26

/** Nota personale come un quadernino (righe e margine), salvataggio automatico su /sticky-note/. */
export default function NoteWidget() {
  const toast = useToast()
  const [text, setText] = React.useState('')
  const [state, setState] = React.useState<'idle' | 'saving' | 'saved'>('idle')
  const textRef = React.useRef('')
  const lastSaved = React.useRef('')
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    api.get<StickyNote>('/sticky-note/').then((r) => { setText(r.data.text); textRef.current = r.data.text; lastSaved.current = r.data.text }).catch(() => {})
  }, [])
  const save = React.useCallback((value: string) => {
    setState('saving')
    api.patch<StickyNote>('/sticky-note/', { text: value })
      .then((r) => { lastSaved.current = r.data.text; setState('saved') })
      .catch((e) => { setState('idle'); toast.error(apiErrorToMessage(e)) })
  }, [toast])
  const change = (value: string) => {
    setText(value); textRef.current = value
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save(value), AUTOSAVE_MS)
  }
  // Allo smontaggio (si cambia pagina prima della fine dell'attesa) salva quel che resta.
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
    if (textRef.current !== lastSaved.current) api.patch('/sticky-note/', { text: textRef.current }).catch(() => {})
  }, [])

  return (
    <WidgetShell tone="butter" icon={StickyNote2RoundedIcon} title="Nota" sx={{ bgcolor: (t) => tintedBg(t, 'butter', 70) }}
      actions={<Typography component="span" aria-live="polite" sx={{ fontSize: 11, color: 'archie.textFaint' }}>{state === 'saving' ? 'Salvataggio…' : state === 'saved' ? 'Salvata' : 'La vedi solo tu'}</Typography>}>
      <InputBase multiline value={text} onChange={(e) => change(e.target.value)} placeholder="Scrivi un appunto…" inputProps={{ maxLength: MAX_LENGTH, 'aria-label': 'Nota personale' }}
        sx={{
          flex: 1, minHeight: 0, alignItems: 'flex-start', overflow: 'auto', fontSize: 13.5, lineHeight: `${LINE}px`, p: 0,
          '& textarea': { minHeight: '100% !important', pl: '44px', pr: 2, pb: 1.5, pt: '2px', lineHeight: `${LINE}px` },
          backgroundImage: (t) => [
            `linear-gradient(to right, transparent 34px, ${tintVeil(t, 'rose', 55)} 34px, ${tintVeil(t, 'rose', 55)} 35.5px, transparent 35.5px)`,
            `repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE - 1}px, ${tintVeil(t, 'sky', 35)} ${LINE - 1}px, ${tintVeil(t, 'sky', 35)} ${LINE}px)`,
          ].join(', '),
          backgroundAttachment: 'local', backgroundPosition: '0 2px',
        }} />
      <Box aria-hidden sx={{ height: 6 }} />
    </WidgetShell>
  )
}
