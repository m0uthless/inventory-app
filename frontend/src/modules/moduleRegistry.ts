import type { CampoIconName } from '../ui/campo'

/**
 * Moduli che un superuser può spegnere dalla pagina «Moduli».
 *
 * Stesse chiavi di `backend/core/modules.py`, che blocca le API (404) di un
 * modulo spento. Qui servono a togliere menu, pagine, widget e collegamenti a
 * chi non è superuser; il superuser li vede con l'etichetta «Spento».
 * `goes` e `stays` sono i testi della pagina Moduli: tenerli veri.
 */
export type ModuleKey =
  | 'issues' | 'area_tasks' | 'maintenance' | 'servicenow'
  | 'monitors' | 'wiki' | 'drive' | 'text2sql'
  | 'contracts' | 'purchase_orders' | 'expenses' | 'leave' | 'feedback'

export type ModuleDef = {
  key: ModuleKey
  label: string
  group: 'Operatività' | 'Anagrafiche' | 'Conoscenza' | 'Amministrazione' | 'Sistema'
  icon: CampoIconName
  description: string
  /** Prefissi delle rotte del frontend che appartengono al modulo. */
  routes: string[]
  /** Cosa sparisce quando è spento. */
  goes: string[]
  /** Cosa resta acceso perché serve ad altri moduli. */
  stays: string[]
}

export const MODULES: ModuleDef[] = [
  {
    key: 'issues', label: 'Issue', group: 'Operatività', icon: 'alert',
    description: 'Issue dei clienti, procedure Wiki collegate, chiusura automatica.',
    routes: ['/issues'],
    goes: ['Pagina Issue e voce nel menu', 'Widget «Issue» e contatore in Dashboard', 'Email di nuova issue e di assegnazione', 'Scadenze delle issue nel riepilogo giornaliero', 'Chiusura automatica delle risolte'],
    stays: ['Task di area: la conversione in issue sparisce, i task restano'],
  },
  {
    key: 'area_tasks', label: 'Task di area', group: 'Operatività', icon: 'task',
    description: 'Attività interne per area, commenti e allegati.',
    routes: ['/tasks'],
    goes: ['Pagina Task di area e voce nel menu', 'Widget dei task e contatore in Dashboard', 'Notifiche e riepilogo delle scadenze dei task'],
    stays: ["Aree degli utenti: servono anche ad altri moduli"],
  },
  {
    key: 'maintenance', label: 'Manutenzione', group: 'Operatività', icon: 'wrench',
    description: 'Piani, scadenze e rapportini.',
    routes: ['/maintenance'],
    goes: ['Pagine Manutenzione, Piani e Rapportini', 'Widget delle scadenze e contatore in Dashboard', 'Notifiche ed email di scadenza', 'Piani nella ricerca'],
    stays: [],
  },
  {
    key: 'servicenow', label: 'ServiceNow', group: 'Operatività', icon: 'cloud',
    description: 'Casi, Triage, Dashboard casi e assenze dei tecnici.',
    routes: ['/servicenow-cases', '/servicenow-dashboard', '/servicenow-stats', '/servicenow-absences'],
    goes: ['Pagine Casi e Dashboard casi', 'Assenze dei tecnici', 'Notifiche Teams dei nuovi casi'],
    stays: ['Il numero di caso già scritto nelle issue'],
  },
  {
    key: 'monitors', label: 'Monitor', group: 'Anagrafiche', icon: 'monitor',
    description: 'Monitor dei sistemi dei clienti.',
    routes: ['/monitors'],
    goes: ['Pagina Monitor e voce nel menu'],
    stays: [],
  },
  {
    key: 'wiki', label: 'Wiki', group: 'Conoscenza', icon: 'book',
    description: 'Pagine, query, statistiche e allegati.',
    routes: ['/wiki'],
    goes: ['Pagine Wiki, Query e Statistiche', 'Widget «Contributor del mese»', 'Pagine Wiki nella ricerca', 'Procedura dalla Wiki nelle issue'],
    stays: [],
  },
  {
    key: 'drive', label: 'Drive', group: 'Conoscenza', icon: 'folder',
    description: 'File e cartelle con permessi.',
    routes: ['/drive'],
    goes: ['Pagina Drive e voce nel menu', 'Caricamento e scaricamento dei file', 'File e cartelle nella ricerca'],
    stays: [],
  },
  {
    key: 'text2sql', label: 'Generatore SQL', group: 'Conoscenza', icon: 'chat',
    description: 'Query Oracle per il PACS Philips Vue a partire da una domanda in italiano.',
    routes: ['/knowledge/sql'],
    goes: ['Pagina Generatore SQL e voce nel menu', 'Elaborazione delle domande in coda', 'Notifiche «Query SQL pronta»'],
    stays: ['Storico delle domande e giudizi'],
  },
  {
    key: 'contracts', label: 'Contratti', group: 'Amministrazione', icon: 'file',
    description: 'Contratti dei clienti, venditori e scadenze.',
    routes: ['/contracts'],
    goes: ['Pagina Contratti e voce nel menu', 'Scheda Contratti nel cliente'],
    stays: [],
  },
  {
    key: 'purchase_orders', label: 'Purchase Order', group: 'Amministrazione', icon: 'bag',
    description: 'Ordini, importi e documenti.',
    routes: ['/purchase-orders'],
    goes: ['Pagina Purchase Order e voce nel menu'],
    stays: [],
  },
  {
    key: 'expenses', label: 'Rimborso spese', group: 'Amministrazione', icon: 'receipt',
    description: 'Note spese, trasferte e scontrini.',
    routes: ['/rimborso-spese'],
    goes: ['Pagina Rimborso spese e voce nel menu', 'Note spese e tariffe km'],
    stays: [],
  },
  {
    key: 'leave', label: 'Piano ferie', group: 'Amministrazione', icon: 'calendar',
    description: 'Richieste di ferie, approvazioni e griglia per area.',
    routes: ['/piano-ferie'],
    goes: ['Pagina Piano ferie e voce nel menu', 'Richieste e approvazioni di ferie', 'Email al coordinatore e al richiedente', 'Widget «Squadra» e assenti di oggi in Dashboard'],
    stays: ['Assenze dei tecnici ServiceNow (Dashboard casi, Triage)', 'Aree degli utenti, usate dai Task di area'],
  },
  {
    key: 'feedback', label: 'Bug e feature', group: 'Sistema', icon: 'message',
    description: 'Segnalazioni e richieste degli utenti.',
    routes: ['/bug-feature'],
    goes: ['Pagina Bug e feature e voce nel menu', 'Contatore nel menu', 'Email delle segnalazioni'],
    stays: [],
  },
]

/** Moduli che non si spengono: il resto di Archie dipende da loro. */
export const ALWAYS_ON: { label: string; icon: CampoIconName }[] = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'Clienti, siti e contatti', icon: 'building' },
  { label: 'Inventari', icon: 'server' },
  { label: 'Site Repository', icon: 'layers' },
  { label: 'Audit', icon: 'history' },
  { label: 'Cestino', icon: 'trash' },
  { label: 'Utenti e gruppi', icon: 'users' },
  { label: 'Accesso Portal', icon: 'key' },
]

export const MODULE_BY_KEY = Object.fromEntries(MODULES.map((m) => [m.key, m])) as Record<ModuleKey, ModuleDef>

const startsWith = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + '/')

/** Modulo a cui appartiene una rotta del frontend, se è uno di quelli spegnibili. */
export function moduleForPath(pathname: string): ModuleKey | null {
  return MODULES.find((m) => m.routes.some((r) => startsWith(pathname, r)))?.key ?? null
}

/** Widget della Dashboard che dipendono da un modulo. */
export const WIDGET_MODULE: Record<string, ModuleKey> = {
  issues: 'issues',
  'area-tasks': 'area_tasks',
  maintenance: 'maintenance',
  contributor: 'wiki',
  team: 'leave',
}

// Permessi Django → modulo. Per chi non è superuser, un permesso di un modulo
// spento vale come non concesso (vedi AuthProvider.hasPerm): così spariscono
// anche i pulsanti che portano a un modulo spento da un'altra pagina
// (es. «Crea issue» dai casi ServiceNow o dai rapportini).
const APP_MODULE: Record<string, ModuleKey> = {
  issues: 'issues',
  maintenance: 'maintenance',
  servicenow: 'servicenow',
  wiki: 'wiki',
  drive: 'drive',
  contracts: 'contracts',
  purchaseorders: 'purchase_orders',
  expenses: 'expenses',
  feedback: 'feedback',
}
// App condivise: decide il modello (le aree del Piano ferie restano accese).
const MODEL_MODULE: Record<string, ModuleKey> = {
  'core.areatask': 'area_tasks',
  'core.areataskcomment': 'area_tasks',
  'inventory.monitor': 'monitors',
  'attendance.absence': 'leave',
  'attendance.holiday': 'leave',
}

/** Modulo a cui appartiene un permesso `app.azione_modello`, se è uno di quelli spegnibili. */
export function moduleForPerm(perm: string): ModuleKey | null {
  const [app, codename = ''] = perm.split('.')
  if (APP_MODULE[app]) return APP_MODULE[app]
  const model = codename.slice(codename.indexOf('_') + 1)
  return MODEL_MODULE[`${app}.${model}`] ?? null
}
