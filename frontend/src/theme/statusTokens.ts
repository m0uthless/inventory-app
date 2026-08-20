/**
 * DomainStatusTokens — colori "categorico per-tema" legati a stati di
 * dominio (es. stato Purchase Order) o a palette deterministiche
 * (es. colore chip committente da hash del nome).
 *
 * Prima di questo modulo questi valori vivevano hardcoded dentro i file
 * di dominio (es. `features/purchaseorders/types.ts`), scollegati dal
 * tema attivo. Qui vengono centralizzati e resi disponibili via
 * `useStatusTokens()` (theme/AppThemeProvider.tsx), con una variante per
 * tema in `theme/themeRegistry.ts`.
 *
 * NOTA (fase status token 0.9.x): valori storici invariati per i domini non
 * ancora convertiti — vedi `statusColor()` sotto per i domini già passati a
 * derivazione da palette (fase 1: noContactWarning, bugFeatureStatus,
 * maintenancePlanStatus). Altri domini seguiranno nelle fasi successive.
 */

import { SHARED } from './constants'
import { alpha } from '@mui/material/styles'
import { theme } from '../theme'

export type ColorTriple = { bg: string; color: string; border: string }

/**
 * statusColor — deriva un ColorTriple da un colore della palette del tema
 * invece di ridichiarare hex indipendenti. `base` è il colore usato (con
 * alpha diverse) per bg/border; `text` è il colore pieno per il testo
 * (quasi sempre il tono `.dark` dello stesso ruolo semantico).
 *
 * Consolidamento colori 0.9.x, fase status token (fase 1, gruppi pilota):
 * sostituisce hex "quasi uguali ma non uguali" a palette.<ruolo>.main
 * (es. bg storicamente #eab308/#10b981 invece di warning.main/success.main)
 * accumulati nel tempo in questo file. Import diretto di `theme` sicuro qui:
 * dal consolidamento 0.9.0 esiste un solo tema, quindi non c'è più il rischio
 * del vecchio bug "import statico che ignora il tema attivo".
 */
function statusColor(base: string, text: string, bgAlpha: number, borderAlpha: number): ColorTriple {
  return { bg: alpha(base, bgAlpha), color: text, border: alpha(base, borderAlpha) }
}

export type PurchaseOrderStatusKey = 'inserito' | 'inviato' | 'ricevuto' | 'fatturato'
export type MonitorStatusKey = 'in_uso' | 'da_installare' | 'guasto' | 'rma'
export type ServiceNowPriorityKey = '1' | '2' | '3' | '4'

export type DomainStatusTokens = {
  /** PurchaseOrders (pages/PurchaseOrders.tsx, PurchaseOrderDrawer.tsx) */
  purchaseOrder: Record<PurchaseOrderStatusKey, ColorTriple>
  /** Palette deterministica per chip "committente" (vedi committenteColor sotto) */
  clientChipPalette: ColorTriple[]
  /** Inventory (pages/Inventory.tsx) — stato device */
  inventory: Record<InventoryStatusKey, ColorTriple>
  /** Note spese (features/expenses/expensesShared.ts) — stato nota */
  expenseReport: Record<ExpenseReportStatusKey, ColorTriple>
  /**
   * Stato generico "entità" (1-6), usato dalle mobile card di
   * Customers.tsx e Sites.tsx (renderer desktop equivalente vive in
   * `shared/src/ui/StatusChip.tsx`, NON qui: quel componente è condiviso
   * anche con frontend-portal, che non ha questo Context — resta con la
   * sua palette locale per non introdurre una dipendenza da
   * ThemeTokensContext in un componente cross-app).
   * La chiave 5 (viola) segue WidgetAccents.violet*.
   */
  entityStatus: Record<number, ColorTriple>
  /** Chip "Nessun contatto" (Customers.tsx + Sites.tsx, era duplicato identico) */
  noContactWarning: ColorTriple & { iconColor: string }
  /** Monitor.tsx — stato device (STATO_COLOR) */
  monitor: Record<MonitorStatusKey, ColorTriple>
  /** Monitor.tsx — fallback per stati non mappati */
  monitorFallback: ColorTriple
  /**
   * ServiceNowCases.tsx — priorità caso (PRIORITY_COLOR, badge compatti
   * mobile card). La chiave '3' (Moderate) segue theme.palette.info.dark.
   */
  serviceNowPriority: Record<ServiceNowPriorityKey, ColorTriple>
  /** UsersAdmin.tsx — badge azienda Philips/Biotron (colonna "Azienda") */
  companyBadge: { philips: { bg: string; color: string }; biotron: { bg: string; color: string } }
  /** AuditActionChip.tsx — azioni senza colore MUI semantico diretto (login_failed/logout) */
  auditAction: { login_failed: ColorTriple; logout: ColorTriple }
  /** BugFeatureDrawer.tsx — stato segnalazione bug/feature (open/resolved/rejected) */
  bugFeatureStatus: { open: ColorTriple; resolved: ColorTriple; rejected: ColorTriple }
  /**
   * MaintenancePlans.tsx — chip/track "Stato" e "Copertura" nella griglia
   * (era duplicato come rgba hardcoded sia nel Chip che nel progress-track).
   * `color` segue theme.palette.text.secondary/success.dark/warning.dark —
   * qui teniamo solo bg/border, il componente applica `color` dal tema a
   * runtime.
   */
  maintenancePlanStatus: { archived: ColorTriple; completed: ColorTriple; inProgress: ColorTriple; atRisk: ColorTriple }
}

export type InventoryStatusKey = 'in_use' | 'maintenance' | 'repair' | 'spare' | 'retired' | 'storage'
export type ExpenseReportStatusKey = 'bozza' | 'inviata' | 'validata' | 'rifiutata'

/** STATUS_TOKENS — valori storici (tema default, invariati). */
export const STATUS_TOKENS: DomainStatusTokens = {
  purchaseOrder: {
    // `inserito` resta slate letterale: nessun ruolo "neutro" nella palette
    // del tema. `ricevuto` non è più un'eccezione arancio — vedi commento
    // sotto, ora converge su warning.
    inserito:  { bg: alpha('#94a3b8', 0.16), color: theme.palette.text.secondary, border: alpha('#94a3b8', 0.34) },
    inviato:   statusColor(theme.palette.info.main, theme.palette.info.dark, 0.12, 0.30),
    // ricevuto: allineato al warning standard, stessi valori di inventory.maintenance
    // (era arancio letterale #f97316, distinto — ora convergente).
    ricevuto:  statusColor(theme.palette.warning.main, theme.palette.warning.dark, 0.10, 0.28),
    fatturato: statusColor(theme.palette.success.main, theme.palette.success.dark, 0.10, 0.28),
  },
  clientChipPalette: [
    { bg: 'rgba(99,102,241,0.12)',  color: '#4338ca', border: 'rgba(99,102,241,0.28)' },
    { bg: 'rgba(236,72,153,0.12)',  color: '#be185d', border: 'rgba(236,72,153,0.28)' },
    { bg: 'rgba(20,184,166,0.12)',  color: '#0f766e', border: 'rgba(20,184,166,0.28)' },
    { bg: 'rgba(245,158,11,0.14)',  color: '#b45309', border: 'rgba(245,158,11,0.30)' },
    { bg: 'rgba(59,130,246,0.12)',  color: '#1d4ed8', border: 'rgba(59,130,246,0.28)' },
    { bg: 'rgba(139,92,246,0.12)',  color: '#6d28d9', border: 'rgba(139,92,246,0.28)' },
    { bg: 'rgba(34,197,94,0.12)',   color: '#15803d', border: 'rgba(34,197,94,0.28)' },
    { bg: 'rgba(239,68,68,0.12)',   color: '#b91c1c', border: 'rgba(239,68,68,0.28)' },
    { bg: 'rgba(6,182,212,0.12)',   color: '#0e7490', border: 'rgba(6,182,212,0.28)' },
    { bg: 'rgba(217,70,239,0.12)',  color: '#a21caf', border: 'rgba(217,70,239,0.28)' },
  ],
  inventory: {
    in_use:      statusColor(theme.palette.success.main,   theme.palette.success.dark,   0.10, 0.28),
    maintenance: statusColor(theme.palette.warning.main,   theme.palette.warning.dark,   0.10, 0.28),
    repair:      statusColor(theme.palette.error.main,     theme.palette.error.dark,     0.10, 0.28),
    // spare: grigio come retired/storage (era violetto/secondary nel giro
    // precedente — su indicazione esplicita, torna a essere neutro).
    spare:       { bg: alpha('#94a3b8', 0.12), color: theme.palette.text.secondary, border: alpha('#94a3b8', 0.30) },
    retired:     { bg: alpha('#94a3b8', 0.12), color: theme.palette.text.secondary, border: alpha('#94a3b8', 0.30) },
    storage:     { bg: alpha('#94a3b8', 0.12), color: theme.palette.text.secondary, border: alpha('#94a3b8', 0.30) },
  },
  expenseReport: {
    bozza:     { bg: alpha('#94a3b8', 0.14), color: theme.palette.text.secondary, border: alpha('#94a3b8', 0.32) },
    inviata:   statusColor(theme.palette.info.main,    theme.palette.info.dark,    0.10, 0.28),
    validata:  statusColor(theme.palette.success.main, theme.palette.success.dark, 0.12, 0.30),
    rifiutata: statusColor(theme.palette.error.main,   theme.palette.error.dark,   0.10, 0.28),
  },
  entityStatus: {
    // 1-6: bg/border pastello fissi, color quasi sempre invariato tra temi
    // tranne la chiave 5 (viola), che segue WidgetAccents.violet*
    //
    // RIASSEGNAZIONE (consolidamento colori 0.9.x, su richiesta esplicita):
    // 2 = nuovo slate (da companyBadge.biotron), 3 = ex-2 (verde),
    // 4 = ex-3 (giallo), 5 = ex-4 (rosso), 6 = ex-5 (viola). L'ex-6
    // (arancio) esce dalla scala per mantenere il totale a 6. Il colore
    // percepito per ogni valore di status numerico cambia — non solo la
    // palette, anche il significato visivo per chi guarda le card
    // Customers/Sites.
    1: { bg: SHARED.categorical.blue.bg, color: SHARED.categorical.blue.text, border: SHARED.categorical.blue.border },
    2: { bg: '#E2E8F0', color: '#334155', border: '#CBD5E1' }, // = companyBadge.biotron + border coerente
    3: { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' }, // era 2
    4: { bg: '#FEF9C3', color: '#854D0E', border: '#FDE68A' }, // era 3
    5: { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' }, // era 4
    6: { bg: SHARED.categorical.violet.bg, color: SHARED.categorical.violet.text, border: SHARED.categorical.violet.borderStatus }, // era 5 — = WIDGET_ACCENTS.violet*
  },
  noContactWarning: {
    ...statusColor(theme.palette.warning.main, theme.palette.warning.dark, 0.12, 0.18),
    iconColor: theme.palette.warning.dark,
  },
  monitor: {
    in_uso:        statusColor(theme.palette.success.main, theme.palette.success.dark, 0.10, 0.28),
    da_installare: statusColor(theme.palette.warning.main, theme.palette.warning.dark, 0.10, 0.28),
    guasto:        statusColor(theme.palette.error.main,   theme.palette.error.dark,   0.10, 0.28),
    rma:           { bg: alpha('#94a3b8', 0.12), color: theme.palette.text.secondary, border: alpha('#94a3b8', 0.30) },
  },
  monitorFallback: { bg: alpha(theme.palette.text.secondary, 0.08), color: theme.palette.text.secondary, border: alpha(theme.palette.text.secondary, 0.20) },
  serviceNowPriority: {
    '1': statusColor(theme.palette.error.main,   theme.palette.error.dark,   0.10, 0.28), // Critical
    '2': statusColor(theme.palette.warning.main, theme.palette.warning.dark, 0.10, 0.28), // High
    '3': statusColor(theme.palette.info.main,    theme.palette.info.dark,    0.10, 0.28), // Moderate
    '4': { bg: alpha('#94a3b8', 0.12), color: theme.palette.text.secondary, border: alpha('#94a3b8', 0.30) }, // Low
  },
  companyBadge: {
    // philips.color era #075985: allineato a SHARED.categorical.blue.text
    // (#0369A1) — piccolo scarto visivo voluto per convergere sullo stesso
    // azzurro già usato da entityStatus[1]/auditAction.logout.
    philips: { bg: SHARED.categorical.blue.bg, color: SHARED.categorical.blue.text },
    biotron: { bg: '#E2E8F0', color: '#334155' },
  },
  auditAction: {
    login_failed: { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' },
    // logout.bg era #f0f9ff (sky-50): allineato a SHARED.categorical.blue.bg
    // (#E0F2FE, sky-100) — piccolo scarto visivo voluto, stessa convergenza.
    logout:       { bg: SHARED.categorical.blue.bg, color: SHARED.categorical.blue.text, border: SHARED.categorical.blue.border },
  },
  bugFeatureStatus: {
    open:     statusColor(theme.palette.warning.main, theme.palette.warning.dark, 0.12, 0.3),
    resolved: statusColor(theme.palette.success.main, theme.palette.success.dark, 0.12, 0.3),
    rejected: statusColor(theme.palette.error.main,   theme.palette.error.dark,   0.12, 0.3),
  },
  maintenancePlanStatus: {
    // `archived` resta slate letterale: il tema non ha un ruolo "neutro" in
    // palette, solo text.secondary (usato qui per il colore testo).
    archived:   { bg: alpha('#94a3b8', 0.15), color: theme.palette.text.secondary, border: alpha('#94a3b8', 0.35) },
    completed:  statusColor(theme.palette.success.main, theme.palette.success.dark, 0.12, 0.35),
    inProgress: statusColor(theme.palette.warning.main, theme.palette.warning.dark, 0.12, 0.35),
    atRisk:     statusColor(theme.palette.error.main,   theme.palette.error.dark,   0.12, 0.35),
  },
} as const

/**
 * committenteColor — colore deterministico da stringa (nome committente),
 * spostato da `features/purchaseorders/types.ts`. Ora richiede la palette
 * come parametro (presa da `useStatusTokens().clientChipPalette`) invece
 * di leggere una costante fissa, così il colore segue il tema attivo.
 */
export function committenteColor(name: string, palette: ColorTriple[]): ColorTriple {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return palette[Math.abs(hash) % palette.length]
}
