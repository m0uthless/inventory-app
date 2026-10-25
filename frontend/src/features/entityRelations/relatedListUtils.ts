import type { Theme } from '@mui/material/styles'

// Stile condiviso dai pulsanti "vai a sezione collegata" (Siti / Inventari / Contatti / Drive)
// usato nelle tab di dettaglio di Customers.tsx e Sites.tsx. Costanti/funzioni
// pure in questo file (nessun componente): i componenti condivisi vivono in
// ./RelatedListSection.tsx.
export const navSectionButtonSx = {
  bgcolor: (theme: Theme) => theme.palette.primary.main,
  color: (theme: Theme) => theme.palette.common.white,
  fontWeight: 600,
  '&:hover': { bgcolor: (theme: Theme) => theme.palette.primary.dark },
} as const

/**
 * Rimuove il parametro `open` dalla query string corrente, per costruire il
 * valore di `return` passato alle pagine di destinazione (Siti/Inventari/Contatti)
 * quando si naviga da una tab di dettaglio.
 */
export function stripOpenParam(search: string): string {
  const sp = new URLSearchParams(search)
  sp.delete('open')
  const s = sp.toString()
  return s ? '?' + s : ''
}
