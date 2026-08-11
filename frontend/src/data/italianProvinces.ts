// ─── Province italiane ──────────────────────────────────────────────────────
// Elenco statico e fisso delle 107 province/città metropolitane italiane
// (sigla automobilistica + nome esteso). Usato per:
//  - il menu a tendina (Autocomplete) nei form di inserimento/modifica di
//    Customer e Site (ProvinceAutocomplete.tsx);
//  - risolvere il nome esteso a partire dalla sigla (o viceversa) nella vista
//    raggruppata per provincia del Site Repository, così un valore salvato
//    come "BO" viene mostrato come "Bologna (BO)".
//
// Elenco chiuso: non deriva da alcuna API. Se in futuro cambiassero i confini
// amministrativi (accade raramente), va aggiornato qui manualmente.

export type ItalianProvince = {
  sigla: string
  name: string
}

export const ITALIAN_PROVINCES: ItalianProvince[] = [
  { sigla: 'AG', name: 'Agrigento' },
  { sigla: 'AL', name: 'Alessandria' },
  { sigla: 'AN', name: 'Ancona' },
  { sigla: 'AO', name: 'Aosta' },
  { sigla: 'AR', name: 'Arezzo' },
  { sigla: 'AP', name: 'Ascoli Piceno' },
  { sigla: 'AT', name: 'Asti' },
  { sigla: 'AV', name: 'Avellino' },
  { sigla: 'BA', name: 'Bari' },
  { sigla: 'BT', name: 'Barletta-Andria-Trani' },
  { sigla: 'BL', name: 'Belluno' },
  { sigla: 'BN', name: 'Benevento' },
  { sigla: 'BG', name: 'Bergamo' },
  { sigla: 'BI', name: 'Biella' },
  { sigla: 'BO', name: 'Bologna' },
  { sigla: 'BZ', name: 'Bolzano' },
  { sigla: 'BS', name: 'Brescia' },
  { sigla: 'BR', name: 'Brindisi' },
  { sigla: 'CA', name: 'Cagliari' },
  { sigla: 'CL', name: 'Caltanissetta' },
  { sigla: 'CB', name: 'Campobasso' },
  { sigla: 'CE', name: 'Caserta' },
  { sigla: 'CT', name: 'Catania' },
  { sigla: 'CZ', name: 'Catanzaro' },
  { sigla: 'CH', name: 'Chieti' },
  { sigla: 'CO', name: 'Como' },
  { sigla: 'CS', name: 'Cosenza' },
  { sigla: 'CR', name: 'Cremona' },
  { sigla: 'KR', name: 'Crotone' },
  { sigla: 'CN', name: 'Cuneo' },
  { sigla: 'EN', name: 'Enna' },
  { sigla: 'FM', name: 'Fermo' },
  { sigla: 'FE', name: 'Ferrara' },
  { sigla: 'FI', name: 'Firenze' },
  { sigla: 'FG', name: 'Foggia' },
  { sigla: 'FC', name: 'Forlì-Cesena' },
  { sigla: 'FR', name: 'Frosinone' },
  { sigla: 'GE', name: 'Genova' },
  { sigla: 'GO', name: 'Gorizia' },
  { sigla: 'GR', name: 'Grosseto' },
  { sigla: 'IM', name: 'Imperia' },
  { sigla: 'IS', name: 'Isernia' },
  { sigla: 'AQ', name: "L'Aquila" },
  { sigla: 'SP', name: 'La Spezia' },
  { sigla: 'LT', name: 'Latina' },
  { sigla: 'LE', name: 'Lecce' },
  { sigla: 'LC', name: 'Lecco' },
  { sigla: 'LI', name: 'Livorno' },
  { sigla: 'LO', name: 'Lodi' },
  { sigla: 'LU', name: 'Lucca' },
  { sigla: 'MC', name: 'Macerata' },
  { sigla: 'MN', name: 'Mantova' },
  { sigla: 'MS', name: 'Massa-Carrara' },
  { sigla: 'MT', name: 'Matera' },
  { sigla: 'ME', name: 'Messina' },
  { sigla: 'MI', name: 'Milano' },
  { sigla: 'MO', name: 'Modena' },
  { sigla: 'MB', name: 'Monza e della Brianza' },
  { sigla: 'NA', name: 'Napoli' },
  { sigla: 'NO', name: 'Novara' },
  { sigla: 'NU', name: 'Nuoro' },
  { sigla: 'OR', name: 'Oristano' },
  { sigla: 'PD', name: 'Padova' },
  { sigla: 'PA', name: 'Palermo' },
  { sigla: 'PR', name: 'Parma' },
  { sigla: 'PV', name: 'Pavia' },
  { sigla: 'PG', name: 'Perugia' },
  { sigla: 'PU', name: 'Pesaro e Urbino' },
  { sigla: 'PE', name: 'Pescara' },
  { sigla: 'PC', name: 'Piacenza' },
  { sigla: 'PI', name: 'Pisa' },
  { sigla: 'PT', name: 'Pistoia' },
  { sigla: 'PN', name: 'Pordenone' },
  { sigla: 'PZ', name: 'Potenza' },
  { sigla: 'PO', name: 'Prato' },
  { sigla: 'RG', name: 'Ragusa' },
  { sigla: 'RA', name: 'Ravenna' },
  { sigla: 'RC', name: 'Reggio Calabria' },
  { sigla: 'RE', name: 'Reggio Emilia' },
  { sigla: 'RI', name: 'Rieti' },
  { sigla: 'RN', name: 'Rimini' },
  { sigla: 'RM', name: 'Roma' },
  { sigla: 'RO', name: 'Rovigo' },
  { sigla: 'SA', name: 'Salerno' },
  { sigla: 'SS', name: 'Sassari' },
  { sigla: 'SV', name: 'Savona' },
  { sigla: 'SI', name: 'Siena' },
  { sigla: 'SR', name: 'Siracusa' },
  { sigla: 'SO', name: 'Sondrio' },
  { sigla: 'SU', name: 'Sud Sardegna' },
  { sigla: 'TA', name: 'Taranto' },
  { sigla: 'TE', name: 'Teramo' },
  { sigla: 'TR', name: 'Terni' },
  { sigla: 'TO', name: 'Torino' },
  { sigla: 'TP', name: 'Trapani' },
  { sigla: 'TN', name: 'Trento' },
  { sigla: 'TV', name: 'Treviso' },
  { sigla: 'TS', name: 'Trieste' },
  { sigla: 'UD', name: 'Udine' },
  { sigla: 'VA', name: 'Varese' },
  { sigla: 'VE', name: 'Venezia' },
  { sigla: 'VB', name: 'Verbano-Cusio-Ossola' },
  { sigla: 'VC', name: 'Vercelli' },
  { sigla: 'VR', name: 'Verona' },
  { sigla: 'VV', name: 'Vibo Valentia' },
  { sigla: 'VI', name: 'Vicenza' },
  { sigla: 'VT', name: 'Viterbo' },
]

/**
 * Risolve un valore di provincia salvato (sigla come "BO" o nome esteso come
 * "Bologna", case-insensitive) nella entry canonica {sigla, name}.
 * Ritorna null se il valore non corrisponde a nessuna provincia nota (dato
 * legacy/anomalo): in quel caso i chiamanti devono ricadere sul valore grezzo.
 */
export function resolveItalianProvince(raw?: string | null): ItalianProvince | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  const lower = v.toLowerCase()
  return (
    ITALIAN_PROVINCES.find((p) => p.sigla.toLowerCase() === lower) ??
    ITALIAN_PROVINCES.find((p) => p.name.toLowerCase() === lower) ??
    null
  )
}

/** "BO" o "Bologna" → "Bologna (BO)". Valori non riconosciuti restano invariati. */
export function formatProvinceLabel(raw?: string | null): string {
  const v = (raw ?? '').trim()
  if (!v) return ''
  const match = resolveItalianProvince(v)
  return match ? `${match.name} (${match.sigla})` : v
}
