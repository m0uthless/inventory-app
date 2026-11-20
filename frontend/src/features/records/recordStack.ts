import * as React from 'react'
import { buildQuery } from '@shared/utils/nav'

/*
 * Pila dei record anagrafici nella stessa finestra (anteprima core-base): dal cliente si apre un suo
 * sito, dal sito un contatto, e «‹ Cliente» torna indietro. Fuori da una pila (es. nei test) i
 * collegamenti aprono la pagina del record.
 */
export type StackKind = 'customer' | 'site' | 'contact' | 'inventory'
export type StackRef = { kind: StackKind; id: number; label: string }

export const RecordStackContext = React.createContext<{ open: (r: StackRef) => void } | null>(null)

const PAGE: Record<StackKind, string> = { customer: '/customers', site: '/sites', contact: '/contacts', inventory: '/inventory' }
export const recordPath = (r: { kind: StackKind; id: number }) => `${PAGE[r.kind]}${buildQuery({ open: r.id })}`

/**
 * Apre un record collegato: nella pila se la finestra ne ha una, altrimenti nella sua pagina.
 * `blocked` (modifiche in sospeso) ferma l'apertura.
 */
export function useOpenRecord(blocked: () => boolean, navigate: (path: string) => void) {
  const stack = React.useContext(RecordStackContext)
  return (r: StackRef) => {
    if (blocked()) return
    if (stack) stack.open(r)
    else navigate(recordPath(r))
  }
}
