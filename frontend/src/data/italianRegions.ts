// ─── Regioni italiane ────────────────────────────────────────────────────────
// Le 20 regioni, con posizione (row/col) su una griglia stilizzata usata per
// disegnare la cartina cliccabile del Site Repository (vedi
// pages/siteRepository/ItalyRegionMap.tsx), e la mappa provincia→regione
// (sigla ITALIAN_PROVINCES → id regione), usata per navigare "regione →
// provincia → cliente" senza dover ricordare a quale regione appartiene
// ciascuna provincia.
//
// La griglia è uno schema (cartogramma a tessere), non una proiezione
// geografica: la posizione di ogni regione è scelta per restare riconoscibile
// (Nord in alto, stivale che si assottiglia verso Sud, isole separate), non
// per essere geograficamente esatta.
//
// Elenco chiuso, stesso principio di data/italianProvinces.ts: non deriva da
// alcuna API, va aggiornato a mano in caso di modifiche amministrative.

export type RegionId =
  | 'VDA' | 'PIE' | 'LOM' | 'TAA' | 'VEN' | 'FVG' | 'LIG' | 'EMR'
  | 'TOS' | 'UMB' | 'MAR' | 'LAZ' | 'ABR' | 'MOL' | 'CAM' | 'PUG'
  | 'BAS' | 'CAL' | 'SIC' | 'SAR'

export type ItalianRegion = {
  id: RegionId
  name: string
  /** Riga/colonna sulla griglia stilizzata (0,0 = angolo nord-ovest). */
  row: number
  col: number
}

export const ITALIAN_REGIONS: ItalianRegion[] = [
  { id: 'VDA', name: "Valle d'Aosta",       row: 0, col: 1 },
  { id: 'TAA', name: 'Trentino-Alto Adige', row: 0, col: 4 },
  { id: 'FVG', name: 'Friuli-Venezia Giulia', row: 0, col: 6 },
  { id: 'PIE', name: 'Piemonte',            row: 1, col: 1 },
  { id: 'LOM', name: 'Lombardia',           row: 1, col: 3 },
  { id: 'VEN', name: 'Veneto',              row: 1, col: 5 },
  { id: 'LIG', name: 'Liguria',             row: 2, col: 1 },
  { id: 'EMR', name: 'Emilia-Romagna',      row: 2, col: 3 },
  { id: 'TOS', name: 'Toscana',             row: 3, col: 2 },
  { id: 'UMB', name: 'Umbria',              row: 3, col: 3 },
  { id: 'MAR', name: 'Marche',              row: 3, col: 4 },
  { id: 'SAR', name: 'Sardegna',            row: 4, col: 0 },
  { id: 'LAZ', name: 'Lazio',               row: 4, col: 2 },
  { id: 'ABR', name: 'Abruzzo',             row: 4, col: 4 },
  { id: 'CAM', name: 'Campania',            row: 5, col: 2 },
  { id: 'MOL', name: 'Molise',              row: 5, col: 4 },
  { id: 'PUG', name: 'Puglia',              row: 5, col: 5 },
  { id: 'BAS', name: 'Basilicata',          row: 6, col: 4 },
  { id: 'CAL', name: 'Calabria',            row: 7, col: 4 },
  { id: 'SIC', name: 'Sicilia',             row: 8, col: 3 },
]

export const REGION_GRID_COLS = 7
export const REGION_GRID_ROWS = 9

/** Sigla provincia (come in ITALIAN_PROVINCES) → id regione. */
export const PROVINCE_TO_REGION: Record<string, RegionId> = {
  // Valle d'Aosta
  AO: 'VDA',
  // Piemonte
  AL: 'PIE', AT: 'PIE', BI: 'PIE', CN: 'PIE', NO: 'PIE', TO: 'PIE', VB: 'PIE', VC: 'PIE',
  // Lombardia
  BG: 'LOM', BS: 'LOM', CO: 'LOM', CR: 'LOM', LC: 'LOM', LO: 'LOM', MN: 'LOM', MI: 'LOM',
  MB: 'LOM', PV: 'LOM', SO: 'LOM', VA: 'LOM',
  // Trentino-Alto Adige
  BZ: 'TAA', TN: 'TAA',
  // Veneto
  BL: 'VEN', PD: 'VEN', RO: 'VEN', TV: 'VEN', VE: 'VEN', VR: 'VEN', VI: 'VEN',
  // Friuli-Venezia Giulia
  GO: 'FVG', PN: 'FVG', TS: 'FVG', UD: 'FVG',
  // Liguria
  GE: 'LIG', IM: 'LIG', SP: 'LIG', SV: 'LIG',
  // Emilia-Romagna
  BO: 'EMR', FE: 'EMR', FC: 'EMR', MO: 'EMR', PR: 'EMR', PC: 'EMR', RA: 'EMR', RE: 'EMR', RN: 'EMR',
  // Toscana
  AR: 'TOS', FI: 'TOS', GR: 'TOS', LI: 'TOS', LU: 'TOS', MS: 'TOS', PI: 'TOS', PT: 'TOS', PO: 'TOS', SI: 'TOS',
  // Umbria
  PG: 'UMB', TR: 'UMB',
  // Marche
  AN: 'MAR', AP: 'MAR', FM: 'MAR', MC: 'MAR', PU: 'MAR',
  // Lazio
  FR: 'LAZ', LT: 'LAZ', RI: 'LAZ', RM: 'LAZ', VT: 'LAZ',
  // Abruzzo
  CH: 'ABR', AQ: 'ABR', PE: 'ABR', TE: 'ABR',
  // Molise
  CB: 'MOL', IS: 'MOL',
  // Campania
  AV: 'CAM', BN: 'CAM', CE: 'CAM', NA: 'CAM', SA: 'CAM',
  // Puglia
  BA: 'PUG', BT: 'PUG', BR: 'PUG', FG: 'PUG', LE: 'PUG', TA: 'PUG',
  // Basilicata
  MT: 'BAS', PZ: 'BAS',
  // Calabria
  CZ: 'CAL', CS: 'CAL', KR: 'CAL', RC: 'CAL', VV: 'CAL',
  // Sicilia
  AG: 'SIC', CL: 'SIC', CT: 'SIC', EN: 'SIC', ME: 'SIC', PA: 'SIC', RG: 'SIC', SR: 'SIC', TP: 'SIC',
  // Sardegna
  CA: 'SAR', NU: 'SAR', OR: 'SAR', SS: 'SAR', SU: 'SAR',
}

export function regionOfProvinceSigla(sigla?: string | null): RegionId | null {
  if (!sigla) return null
  return PROVINCE_TO_REGION[sigla.toUpperCase()] ?? null
}
