import { FS } from './style'

// Colore delle etichette "di servizio" (intestazioni di colonna, didascalie dei
// contatori): text.secondary (#64748b) su fondi tinti scendeva a 3.0-4.0:1.
// grey.700 resta sotto text.primary nella gerarchia ma supera 4.5:1 ovunque.
export const LABEL_COLOR = 'grey.700'

// Raggio unico (DESIGN.md: 8px per chip, card, righe e pulsanti).
export const RADIUS = '8px'

// Etichetta di colonna: stessa ricetta per tutte le intestazioni della pagina.
export const columnHeaderSx = {
  fontWeight: 700,
  color: LABEL_COLOR,
  letterSpacing: '0.05em',
  fontSize: FS.micro,
  textTransform: 'uppercase' as const,
}

// Plurali italiani per i contatori ("1 cliente", "3 clienti").
export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}
