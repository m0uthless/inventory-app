import * as React from 'react'
import { isSelected } from './appLayoutNav'

// ─── Stato di un gruppo di nav collassabile (sidebar) ─────────────────────────
//
// Consolida il pattern duplicato 5 volte in AppLayout (Wiki, Bug/Feature,
// Manutenzione, Site Repository, ServiceNow): stato "aperto" persistito in
// localStorage, auto-espansione quando la rotta corrente appartiene al
// gruppo, e stato dell'anchor del flyout (sidebar mini).
//
// Gli effetti "cross-gruppo" (chiusura flyout al cambio rotta, chiusura
// flyout quando la sidebar si espande) restano in AppLayout.tsx perché
// coinvolgono più gruppi contemporaneamente — vedi nota lì sull'asimmetria
// del gruppo Manutenzione.

export function useCollapsibleNavGroup(paths: string[], storageKey: string, pathname: string) {
  const sectionActive = React.useMemo(
    () => paths.some((path) => isSelected(pathname, path)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname],
  )

  const [open, setOpen] = React.useState(() => {
    const v = localStorage.getItem(storageKey)
    return v ? v === '1' : true
  })

  const [flyoutAnchor, setFlyoutAnchor] = React.useState<null | HTMLElement>(null)
  const flyoutOpen = Boolean(flyoutAnchor)

  React.useEffect(() => {
    localStorage.setItem(storageKey, open ? '1' : '0')
  }, [open, storageKey])

  React.useEffect(() => {
    if (sectionActive) setOpen(true)
  }, [sectionActive])

  return { sectionActive, open, setOpen, flyoutAnchor, setFlyoutAnchor, flyoutOpen }
}
