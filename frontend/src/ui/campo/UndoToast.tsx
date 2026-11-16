import * as React from 'react'
import { Box, Button, Snackbar } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'

type Msg = { id: number; text: string; undo?: () => void | Promise<void> }
type Api = { show: (text: string, undo?: Msg['undo']) => void }

const Ctx = React.createContext<Api>({ show: () => {} })

/** Messaggio "… · salvato" con Annulla per 6 secondi (DESIGN.md › Feedback). */
export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = React.useState<Msg | null>(null)
  const show = React.useCallback((text: string, undo?: Msg['undo']) => setMsg({ id: Date.now(), text, undo }), [])
  const api = React.useMemo(() => ({ show }), [show])
  return (
    <Ctx.Provider value={api}>
      {children}
      <Snackbar key={msg?.id} open={!!msg} autoHideDuration={6000} onClose={(_e, reason) => { if (reason !== 'clickaway') setMsg(null) }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} sx={{ bottom: { xs: 88, md: 24 } }}>
        <Box role="status" sx={{
          display: 'flex', alignItems: 'center', gap: 1.25, py: 1, pl: 1.5, pr: 1, borderRadius: '8px', fontSize: 13,
          bgcolor: 'text.primary', color: 'background.default', boxShadow: (t) => t.palette.archie.shadowFloat,
        }}>
          <CheckIcon sx={{ fontSize: 16, color: 'success.light' }} />
          <span>{msg?.text}</span>
          {msg?.undo ? (
            <Button size="small" onClick={async () => { const u = msg.undo; setMsg(null); await u?.() }}
              sx={{ color: 'inherit', bgcolor: 'rgb(255 255 255 / .12)', fontWeight: 600, '&:hover': { bgcolor: 'rgb(255 255 255 / .2)', color: 'inherit' } }}>
              Annulla
            </Button>
          ) : null}
        </Box>
      </Snackbar>
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUndoToast() {
  return React.useContext(Ctx)
}
