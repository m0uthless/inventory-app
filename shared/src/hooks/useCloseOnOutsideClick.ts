import * as React from 'react'

// Elementi in portale che fanno parte dell'interazione col pannello (menu,
// popover, dialoghi, tooltip, messaggio con Annulla): un clic lì non chiude.
const PORTALS = '.MuiPopover-root, .MuiMenu-root, .MuiDialog-root, .MuiModal-root:not(.MuiDrawer-root), .MuiPopper-root, .MuiSnackbar-root, [role="status"]'

/**
 * Chiude un pannello non modale quando si clicca fuori (comportamento globale
 * dei pannelli di dettaglio "Campo sterile"). Ignora i clic nei portali aperti
 * dal pannello stesso.
 */
export function useCloseOnOutsideClick(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const cb = React.useRef(onClose)
  React.useEffect(() => { cb.current = onClose })
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (!t || !t.isConnected) return
      if (ref.current?.contains(t)) return
      if (t.closest(PORTALS)) return
      cb.current()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open, ref])
}
