/** Viste della pagina Contratti. Le chiavi restano quelle storiche (sono nell'URL e nelle viste salvate). */
export type ContractView = 'all' | 'att' | 'exp' | 'run' | 'draft' | 'canc'

export const CONTRACT_VIEWS: { key: ContractView; label: string }[] = [
  { key: 'all', label: 'Tutti' },
  { key: 'att', label: 'Da rinnovare' },
  { key: 'exp', label: 'Scaduti' },
  { key: 'run', label: 'In corso' },
  { key: 'draft', label: 'Bozze' },
  { key: 'canc', label: 'Chiusi' },
]

export const VIEWS: ContractView[] = CONTRACT_VIEWS.map((v) => v.key)

export const VIEW_PARAMS: Record<ContractView, Record<string, string>> = {
  all: {}, att: { expiry: 'renew' }, exp: { expiry: 'expired' }, run: { expiry: 'ok' }, draft: { status: 'bozza' }, canc: { status: 'chiuso' },
}
