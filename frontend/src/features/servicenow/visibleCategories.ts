// Categorie ServiceNow mostrate nelle viste di riepilogo: pannello Triage
// (ServiceNowCases.tsx), Statistiche (ServiceNowStats.tsx) e Assenze tecnici
// (ServiceNowAbsences.tsx). Filtro solo frontend: il backend continua a
// calcolare e restituire tutte le categorie, e i case/utenti Philips restano
// intatti. Philips è temporaneamente nascosto: per riattivarlo basta
// aggiungerlo di nuovo a questo elenco.
export type ServiceNowCategory = 'philips' | 'biotron'

export const VISIBLE_SERVICENOW_CATEGORIES: readonly ServiceNowCategory[] = ['biotron']

export function isServiceNowCategoryVisible(category: ServiceNowCategory): boolean {
  return VISIBLE_SERVICENOW_CATEGORIES.includes(category)
}
