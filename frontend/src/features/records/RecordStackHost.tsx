import * as React from 'react'
import { Box, Dialog, useMediaQuery, type Theme } from '@mui/material'
import { RecordFrameContext, recordBackdropSx, recordPaperSx } from '../../ui/campo/recordFrame'
import { RecordStackContext, type StackRef } from './recordStack'
import PushedRecord from './PushedRecord'

/**
 * Contenitore della finestra dei record anagrafici: possiede il Dialog e la pila. Il record della pagina
 * (`children`) resta montato sotto quelli aperti sopra, così tornando indietro non si ricarica nulla.
 * Riaprire un record già nella pila torna a quello invece di impilarlo di nuovo.
 */
export default function RecordStackHost({ root, onClose, children }: { root: StackRef; onClose: () => void; children: React.ReactNode }) {
  const phone = useMediaQuery((t: Theme) => t.breakpoints.down('md'))
  const [stack, setStack] = React.useState<StackRef[]>([])
  const [shown, setShown] = React.useState(false)
  const closeRef = React.useRef<() => void>(onClose)
  const titleId = React.useId()
  const topRef = React.useRef<HTMLDivElement | null>(null)

  // Con ‹ › nella pagina cambia il record di partenza: la pila riparte da lì.
  React.useEffect(() => { setStack([]) }, [root.kind, root.id])

  const layers = [root, ...stack]
  const top = layers.length - 1
  const open = React.useCallback((r: StackRef) => {
    setStack((s) => {
      const all = [root, ...s]
      const at = all.findIndex((x) => x.kind === r.kind && x.id === r.id)
      return at >= 0 ? s.slice(0, at) : [...s, r]
    })
  }, [root])
  const ctx = React.useMemo(() => ({ open }), [open])
  React.useEffect(() => { topRef.current?.scrollIntoView?.({ block: 'start' }) }, [top])

  return (
    <Dialog
      // keepMounted: il record deve montarsi a finestra chiusa per caricare i dati e dire quando è pronto.
      open={shown} keepMounted onClose={() => closeRef.current()} fullScreen={phone} scroll="body" aria-labelledby={titleId} maxWidth={false}
      slotProps={{ backdrop: { sx: recordBackdropSx }, paper: { sx: recordPaperSx(phone) } }}
    >
      <RecordStackContext.Provider value={ctx}>
        {layers.map((r, i) => (
          <Box key={i ? `${i}:${r.kind}:${r.id}` : 'root'} ref={i === top ? topRef : undefined} sx={{ display: i === top ? 'block' : 'none', scrollMarginTop: 40 }}>
            <RecordFrameContext.Provider value={{
              active: i === top, reportOpen: () => setShown(true), setClose: (fn) => { closeRef.current = fn }, titleId,
              crumbs: layers.slice(0, i).map((x, j) => ({ label: x.label, onBack: () => setStack((s) => s.slice(0, j)) })),
            }}>
              {i ? <PushedRecord r={r} onClose={onClose} onLabel={(label) => setStack((s) => (s[i - 1] && s[i - 1].label !== label ? s.map((x, k) => (k === i - 1 ? { ...x, label } : x)) : s))} /> : children}
            </RecordFrameContext.Provider>
          </Box>
        ))}
      </RecordStackContext.Provider>
    </Dialog>
  )
}
