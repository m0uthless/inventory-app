import * as React from 'react'

/*
 * Finestra condivisa da più record (pila Cliente → Sito → Contatto, vedi features/records/RecordStack):
 * il contenitore possiede il Dialog, ogni RecordModal al suo interno disegna solo testata, corpo e barra.
 */
export type RecordFrameHost = {
  /** Il record in cima alla pila: l'unico visibile, quello che riceve Esc e il clic fuori. */
  active: boolean
  /** Il record è pronto da mostrare (apre la finestra la prima volta). */
  reportOpen: () => void
  /** Registra la chiusura (con la conferma delle modifiche in sospeso) del record attivo. */
  setClose: (close: () => void) => void
  titleId: string
  /** Record sotto quello attivo, dal primo: «‹ Cliente / Sito». */
  crumbs: { label: string; onBack: () => void }[]
}

export const RecordFrameContext = React.createContext<RecordFrameHost | null>(null)

export const recordBackdropSx = { bgcolor: 'rgb(10 20 18 / .38)' } as const
export const recordPaperSx = (phone: boolean) => ({
  width: phone ? '100%' : 'min(1120px, calc(100vw - 48px))', maxWidth: 'none', m: phone ? 0 : '40px auto', p: phone ? 1.25 : 2, borderRadius: phone ? 0 : '16px',
  bgcolor: 'background.default', backgroundImage: 'none', boxShadow: '0 30px 80px -20px rgb(10 30 25 / .45), 0 4px 14px rgb(10 30 25 / .12)', overflow: 'visible',
})
