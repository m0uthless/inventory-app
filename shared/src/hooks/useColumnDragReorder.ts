/**
 * useColumnDragReorder
 *
 * Drag & drop manuale delle colonne tramite HTML5 Drag API.
 * Compatibile con @mui/x-data-grid Community (non richiede Pro).
 *
 * Strategia:
 * - dragstart sul singolo header (per sapere quale colonna si sta draggando)
 * - dragover/drop via event delegation sul columnHeadersRow (cattura bubbling
 *   da qualsiasi figlio, inclusi bottoni filtro e sort interni a MUI)
 */

import * as React from 'react'

type Options = {
  gridRef: React.RefObject<HTMLDivElement | null>
  columns: readonly { field: string }[]
  onReorder: (newOrder: string[]) => void
  enabled: boolean
}

const DRAG_FIELD_KEY  = 'text/x-archie-col-field'
const DRAG_OVER_CLASS = 'col-drag-over'
const DRAG_SRC_CLASS  = 'col-drag-source'

const HEADER_SEL =
  '.MuiDataGrid-columnHeader[data-field]:not([data-field="__check__"]):not([data-field="__actions__"])'

/** Risale dal target fino all'header MUI, restituisce null se non trovato */
function closestHeader(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null
  return target.closest<HTMLElement>('.MuiDataGrid-columnHeader[data-field]')
}

export function useColumnDragReorder({ gridRef, columns, onReorder, enabled }: Options) {
  const columnsRef   = React.useRef(columns)
  const onReorderRef = React.useRef(onReorder)
  React.useEffect(() => { columnsRef.current   = columns  }, [columns])
  React.useEffect(() => { onReorderRef.current = onReorder }, [onReorder])

  React.useEffect(() => {
    if (!enabled) return
    const container = gridRef.current
    if (!container) return

    // ── dragstart: attaccato su ogni singolo header ───────────────────────────

    const attached = new WeakMap<HTMLElement, () => void>()

    const attachHeader = (header: HTMLElement) => {
      if (attached.has(header)) return
      const field = header.getAttribute('data-field')
      if (!field) return

      header.setAttribute('draggable', 'true')
      header.style.cursor = 'grab'

      // MUI setta draggable="false" sul DraggableContainer interno —
      // sovrascriviamo anche quello.
      const inner = header.querySelector<HTMLElement>('.MuiDataGrid-columnHeaderDraggableContainer')
      if (inner) {
        inner.setAttribute('draggable', 'true')
        inner.style.cursor = 'grab'
      }

      const onDragStart = (e: DragEvent) => {
        // Ignora dragstart che partono da elementi interni non-header
        if (e.target !== header && e.target !== inner) {
          // lascia che l'evento risalga ma non settiamo il dato
          // → il drop delegation non troverà il campo e ignorerà
        }
        e.dataTransfer?.setData(DRAG_FIELD_KEY, field)
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
        header.classList.add(DRAG_SRC_CLASS)
        setTimeout(() => { header.style.opacity = '0.4' }, 0)
      }

      const onDragEnd = () => {
        header.classList.remove(DRAG_SRC_CLASS)
        header.style.opacity = ''
        container.querySelectorAll(`.${DRAG_OVER_CLASS}`)
          .forEach((el) => el.classList.remove(DRAG_OVER_CLASS))
      }

      header.addEventListener('dragstart', onDragStart)
      header.addEventListener('dragend',   onDragEnd)

      attached.set(header, () => {
        header.removeAttribute('draggable')
        header.style.cursor  = ''
        header.style.opacity = ''
        header.classList.remove(DRAG_OVER_CLASS, DRAG_SRC_CLASS)
        header.removeEventListener('dragstart', onDragStart)
        header.removeEventListener('dragend',   onDragEnd)
        const inn = header.querySelector<HTMLElement>('.MuiDataGrid-columnHeaderDraggableContainer')
        if (inn) { inn.removeAttribute('draggable'); inn.style.cursor = '' }
        attached.delete(header)
      })
    }

    // ── dragover / drop: event delegation sul container ───────────────────────
    // Il bubbling garantisce che l'evento arrivi qui anche se originato
    // da un figlio (bottone filtro, sort icon, separator, ecc.)

    const onContainerDragOver = (e: DragEvent) => {
      const header = closestHeader(e.target)
      if (!header) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      container.querySelectorAll(`.${DRAG_OVER_CLASS}`)
        .forEach((el) => { if (el !== header) el.classList.remove(DRAG_OVER_CLASS) })
      header.classList.add(DRAG_OVER_CLASS)
    }

    const onContainerDragLeave = (e: DragEvent) => {
      // Rimuovi il marker solo se usciamo dall'header (non da un figlio)
      const header = closestHeader(e.target)
      if (!header) return
      const related = e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null
      if (!related || !header.contains(related)) {
        header.classList.remove(DRAG_OVER_CLASS)
      }
    }

    const onContainerDrop = (e: DragEvent) => {
      const toHeader = closestHeader(e.target)
      if (!toHeader) return
      e.preventDefault()
      toHeader.classList.remove(DRAG_OVER_CLASS)

      const fromField = e.dataTransfer?.getData(DRAG_FIELD_KEY)
      const toField   = toHeader.getAttribute('data-field')
      if (!fromField || !toField || fromField === toField) return

      const order   = columnsRef.current.map((c) => c.field)
      const fromIdx = order.indexOf(fromField)
      const toIdx   = order.indexOf(toField)
      if (fromIdx === -1 || toIdx === -1) return

      const next = [...order]
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, fromField)
      onReorderRef.current(next)
    }

    container.addEventListener('dragover',   onContainerDragOver)
    container.addEventListener('dragleave',  onContainerDragLeave)
    container.addEventListener('drop',       onContainerDrop)

    // ── scan & attach ─────────────────────────────────────────────────────────

    const scanAndAttach = () => {
      container.querySelectorAll<HTMLElement>(HEADER_SEL).forEach((header) => {
        if (attached.has(header) && !header.hasAttribute('draggable')) {
          attached.delete(header)
        }
        attachHeader(header)
      })
    }

    let rafId = 0
    const scheduleScan = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(scanAndAttach)
    }

    const initTimer = setTimeout(scanAndAttach, 50)
    const observer  = new MutationObserver(scheduleScan)
    observer.observe(container, { childList: true, subtree: true })

    return () => {
      clearTimeout(initTimer)
      cancelAnimationFrame(rafId)
      observer.disconnect()
      container.removeEventListener('dragover',  onContainerDragOver)
      container.removeEventListener('dragleave', onContainerDragLeave)
      container.removeEventListener('drop',      onContainerDrop)
      container.querySelectorAll<HTMLElement>(HEADER_SEL).forEach((h) => attached.get(h)?.())
    }
  }, [enabled, gridRef])
}
