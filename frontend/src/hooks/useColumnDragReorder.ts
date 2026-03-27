/**
 * useColumnDragReorder
 *
 * Implementa il drag & drop manuale delle colonne del DataGrid tramite
 * HTML5 Drag API, attaccandosi direttamente agli elementi DOM dell'header.
 *
 * Compatibile con @mui/x-data-grid Community (non richiede Pro).
 *
 * Uso:
 *   const gridRef = React.useRef<HTMLDivElement>(null)
 *   useColumnDragReorder({ gridRef, columns, onReorder, enabled })
 */

import * as React from 'react'

type Options = {
  /** Ref al contenitore <div> del DataGrid */
  gridRef: React.RefObject<HTMLDivElement | null>
  /** Elenco corrente delle colonne nell'ordine visualizzato */
  columns: readonly { field: string }[]
  /** Chiamata con il nuovo array di field quando il drag termina */
  onReorder: (newOrder: string[]) => void
  /** Se false, non fa nulla (es. persistenza disabilitata) */
  enabled: boolean
}

const DRAG_FIELD_KEY = 'text/x-archie-col-field'
const DRAG_OVER_CLASS = 'col-drag-over'
const DRAG_SOURCE_CLASS = 'col-drag-source'

export function useColumnDragReorder({ gridRef, columns, onReorder, enabled }: Options) {
  // Ref stabili per non ricreare i listener ad ogni render
  const columnsRef = React.useRef(columns)
  React.useEffect(() => { columnsRef.current = columns }, [columns])

  const onReorderRef = React.useRef(onReorder)
  React.useEffect(() => { onReorderRef.current = onReorder }, [onReorder])

  React.useEffect(() => {
    if (!enabled) return
    const container = gridRef.current
    if (!container) return

    // MUI DataGrid renderizza gli header con delay (virtualizzazione).
    // Usiamo un MutationObserver per intercettare quando l'header è nel DOM.
    let cleanup: (() => void) | null = null

    const attach = () => {
      // Selettore delle celle header MUI (esclude checkbox e azioni)
      const headers = container.querySelectorAll<HTMLElement>(
        '.MuiDataGrid-columnHeader[data-field]:not([data-field="__check__"]):not([data-field="__actions__"])',
      )
      if (!headers.length) return

      cleanup?.()
      const offs: (() => void)[] = []

      headers.forEach((header) => {
        const field = header.getAttribute('data-field') ?? ''
        if (!field) return

        // Rende l'elemento draggabile
        header.setAttribute('draggable', 'true')
        header.style.cursor = 'grab'

        const onDragStart = (e: DragEvent) => {
          e.dataTransfer?.setData(DRAG_FIELD_KEY, field)
          e.dataTransfer && (e.dataTransfer.effectAllowed = 'move')
          header.classList.add(DRAG_SOURCE_CLASS)
          // Piccolo timeout per far applicare la classe prima del ghost
          setTimeout(() => header.style.opacity = '0.45', 0)
        }

        const onDragEnd = () => {
          header.classList.remove(DRAG_SOURCE_CLASS)
          header.style.opacity = ''
          // Pulisce tutti i marker drag-over
          container.querySelectorAll(`.${DRAG_OVER_CLASS}`)
            .forEach((el) => el.classList.remove(DRAG_OVER_CLASS))
        }

        const onDragOver = (e: DragEvent) => {
          e.preventDefault()
          e.dataTransfer && (e.dataTransfer.dropEffect = 'move')
          // Rimuove marker dagli altri header
          container.querySelectorAll(`.${DRAG_OVER_CLASS}`)
            .forEach((el) => { if (el !== header) el.classList.remove(DRAG_OVER_CLASS) })
          header.classList.add(DRAG_OVER_CLASS)
        }

        const onDragLeave = () => {
          header.classList.remove(DRAG_OVER_CLASS)
        }

        const onDrop = (e: DragEvent) => {
          e.preventDefault()
          header.classList.remove(DRAG_OVER_CLASS)
          const fromField = e.dataTransfer?.getData(DRAG_FIELD_KEY)
          const toField = field
          if (!fromField || fromField === toField) return

          const current = columnsRef.current.map((c) => c.field)
          const fromIdx = current.indexOf(fromField)
          const toIdx = current.indexOf(toField)
          if (fromIdx === -1 || toIdx === -1) return

          const next = [...current]
          next.splice(fromIdx, 1)
          next.splice(toIdx, 0, fromField)
          onReorderRef.current(next)
        }

        header.addEventListener('dragstart', onDragStart)
        header.addEventListener('dragend',   onDragEnd)
        header.addEventListener('dragover',  onDragOver)
        header.addEventListener('dragleave', onDragLeave)
        header.addEventListener('drop',      onDrop)

        offs.push(() => {
          header.removeAttribute('draggable')
          header.style.cursor = ''
          header.style.opacity = ''
          header.classList.remove(DRAG_OVER_CLASS, DRAG_SOURCE_CLASS)
          header.removeEventListener('dragstart', onDragStart)
          header.removeEventListener('dragend',   onDragEnd)
          header.removeEventListener('dragover',  onDragOver)
          header.removeEventListener('dragleave', onDragLeave)
          header.removeEventListener('drop',      onDrop)
        })
      })

      cleanup = () => offs.forEach((off) => off())
    }

    // Attacca subito, poi riattacca solo se cambia il numero di header
    // (evita un loop continuo su subtree intero)
    let lastCount = 0
    const attachIfNeeded = () => {
      const count = container.querySelectorAll('.MuiDataGrid-columnHeader[data-field]').length
      if (count !== lastCount) { lastCount = count; attach() }
    }
    attachIfNeeded()
    const observer = new MutationObserver(attachIfNeeded)
    observer.observe(container, { childList: true, subtree: true })

    return () => {
      cleanup?.()
      observer.disconnect()
    }
  }, [enabled, gridRef])
}
