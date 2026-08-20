/**
 * SharedConstants — valori che devono restare identici a prescindere dal
 * tema, per motivi di leggibilità o branding fisso
 * (es. testo bianco su superfici scure, overlay neutri) — non "perché
 * nessuno ci ha pensato".
 *
 * Se un valore qui dentro dovesse invece cambiare tra temi, non è una
 * costante cross-tema: va spostato in SidebarTokens/KpiAccents/WidgetAccents
 * (theme/tokens.ts) o in DomainStatusTokens (theme/statusTokens.ts).
 *
 * Uso consigliato:
 *   import { SHARED } from '../theme/constants'
 *   sx={{ bgcolor: SHARED.overlay.blackScrim }}
 */

export type SharedConstants = {
  /** Bianco/nero puri — evitare di riscrivere '#fff'/'#000'/'#ffffff' a mano. */
  pureWhite: string
  pureBlack: string

  /** Overlay traslucidi su superfici scure (card con gradiente, hero, scrim modale). */
  overlay: {
    whiteFaint: string   // rgba(255,255,255,0.08)  — hover neutro su sfondo scuro
    whiteSoft: string    // rgba(255,255,255,0.12)
    whiteMedium: string  // rgba(255,255,255,0.18)
    whiteStrong: string  // rgba(255,255,255,0.35)
    blackFaint: string   // rgba(0,0,0,0.04)
    blackSoft: string    // rgba(0,0,0,0.08)
    blackScrim: string   // rgba(0,0,0,0.45) — sfondo dietro modali/lightbox
  }

  /**
   * Colori "categorici" (non semantici success/warning/error/info) che
   * risultavano ridichiarati hex-per-hex identici in più punti del codice
   * (KPI accents, widget decorativi, status token di più domini).
   * Centralizzati qui per eliminare la duplicazione. Consolidamento colori
   * 0.9.x, gruppi identitari.
   */
  categorical: {
    /** Era duplicato in KPI_ACCENTS.violetStrong, WIDGET_ACCENTS.violet*, entityStatus[5] */
    violet: { bg: string; text: string; borderChip: string; borderStatus: string }
    /** Era quasi-duplicato (bg/color leggermente diversi) in companyBadge.philips, entityStatus[1], auditAction.logout */
    blue: { bg: string; text: string; border: string }
  }
}

export const SHARED: SharedConstants = {
  pureWhite: '#ffffff',
  pureBlack: '#000000',
  overlay: {
    whiteFaint: 'rgba(255,255,255,0.08)',
    whiteSoft: 'rgba(255,255,255,0.12)',
    whiteMedium: 'rgba(255,255,255,0.18)',
    whiteStrong: 'rgba(255,255,255,0.35)',
    blackFaint: 'rgba(0,0,0,0.04)',
    blackSoft: 'rgba(0,0,0,0.08)',
    blackScrim: 'rgba(0,0,0,0.45)',
  },
  categorical: {
    violet: { bg: '#ede9fe', text: '#5b21b6', borderChip: '#c4b5fd', borderStatus: '#ddd6fe' },
    blue:   { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  },
} as const
