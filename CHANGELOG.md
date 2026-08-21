# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
il versionamento segue [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

Rilascio dedicato a un giro di verifica e rafforzamento della sicurezza, a seguito di un audit esterno indipendente.

### Added
- Validato meglio il formato dell'indirizzo MAC nei dispositivi WiFi, per evitare valori non validi.

### Fixed
- Risolto un problema che poteva impedire il salvataggio di password molto lunghe su un inventario.
- Impedita la creazione di due inventari attivi con lo stesso numero di serie; confermato invece che host fisico e relative macchine virtuali possono continuare a condividere lo stesso K-number.
- Corretto un caso raro in cui due modifiche contemporanee potevano lasciare più di un contatto "primario" su uno stesso cliente o sito.
- Corretto un caso raro in cui un errore durante il salvataggio poteva lasciare un rapportino spese incompleto.
- Corretto un problema simile sugli ordini di acquisto: caricamento del documento e avanzamento di stato restano sempre allineati.
- Risolti gli ultimi avvisi tecnici residui segnalati dagli strumenti di controllo del codice frontend — nessun impatto per l'utente.

### Security
- Rafforzati i controlli di accesso tra l'area interna (ARCHIE) e il Portal clienti: un utente del Portal non può più vedere dati riservati all'area interna.
- Bloccato il download diretto di ricevute spese e documenti degli ordini di acquisto senza passare dal login.
- Corretta una falla che avrebbe potuto permettere di inserire contenuto dannoso nei campi di testo dei piani di manutenzione.
- Il registro storico delle attività (audit) ora nasconde sempre le password e altri dati sensibili, anche negli eventi già registrati in passato.
- Le cartelle del Drive ora ereditano correttamente le restrizioni di accesso dalle cartelle superiori: una sottocartella senza restrizioni proprie, dentro una cartella riservata, non è più visibile a chi non dovrebbe.
- Rimosso dal progetto un file che conteneva dati reali (indirizzi IP, password) e che non doveva trovarsi lì.
- Aggiornate diverse librerie di terze parti con vulnerabilità note, sia sul backend che su entrambi i frontend.
- Backend e frontend ora girano con permessi limitati invece che con privilegi da amministratore di sistema, per ridurre l'impatto di eventuali problemi di sicurezza futuri.

## [0.9.0] - 2026-08-20

### Added
- **[portal]** Multi-cliente per utente: `PortalUserProfile` ora ha, oltre al cliente di default, un M2M `customers` con tutti i clienti assegnabili. Il cliente attivo è risolto da sessione server-side (mai header/localStorage), con self-healing sul default se la sessione è assente o punta a un cliente non più assegnato.
- **[portal]** Nuovo endpoint `POST /api/portal/switch-customer/` per cambiare il cliente attivo, con validazione contro i clienti assegnati; `GET /api/portal/me/` esteso con l'elenco `customers` completo.
- **[portal]** Blocco esplicito dell'accesso (403 con messaggio dedicato) quando il cliente di default non è più tra gli assegnati, invece di un fallback silenzioso su un altro cliente — richiede riassegnazione da parte di un admin.
- **[portal]** Dropdown di selezione cliente in topbar sul frontend Portal, visibile solo per gli utenti con più di un cliente assegnato.
- **[admin]** Multi-select clienti nel drawer utente (sezione "Accesso Portal" in Utenti e Gruppi), con scelta del cliente di default tra quelli selezionati.
- **[admin]** Nuova schermata "Accesso Portal" (voce di menu separata da "Utenti e Gruppi"): vista d'insieme utenti × clienti, ricerca, filtro per cliente, stato "Sospeso" in evidenza per i profili bloccati. Riusa il drawer utente esistente per la modifica.
- **[portal]** Management command `rename_auslbo_to_portal`, idempotente: rinomina in-place lo storico DB dell'app `auslbo` (tabella, `ContentType`, `Permission`, `django_migrations`) senza invalidare i permessi già assegnati ai Gruppi in produzione.

### Changed
- **[portal]** Rename completo del modulo "AUSL BO" in "Portal": app backend `auslbo` → `portal`, frontend `frontend-auslbo` → `frontend-portal`, servizio Docker/target Caddy, endpoint `/api/auslbo/*` → `/api/portal/*`. Gruppo Django legacy rinominato automaticamente in `user_portal` al primo `post_migrate`.
- **[portal]** Dominio pubblico da `auslbo.biotron.it` a `portal.biotron.it` (taglio netto, nessun redirect).
- **[theme]** Refactoring colori 0.9.x completato (incrementi 06→14): eliminati i colori hardcoded rimasti in Site Repository, Wiki, card dashboard (Calendar/StickyNote/Announcements/RecentIssues/QuickActions/Audit), layout/nav (GlobalSearch/NavGroupFlyout), ServiceNow (Stats/Absences), pagine minori (PianoFerie/Login/NotFound/RimborsoSpesePage) e — in un secondo giro d'audit su tutto `frontend/src` — i file rimasti fuori dal roadmap iniziale (`BugFeatureDrawer`, `InventoryDrawer`, `IssueDrawer`, `MonitorDrawer`, `Maintenance`, `Profile`, `PurchaseOrders`, `Contacts`, `Drive` + `drive/FileCard`/`PreviewDrawer`, `AppLayout`), sostituiti con token `SHARED`/`WidgetAccents`/`theme.palette`.
- **[theme]** `DomainStatusTokens` esteso con 7 nuovi domini: `entityStatus` (stato 1-6 Customers/Sites), `noContactWarning`, `monitor`/`monitorFallback`, `serviceNowPriority`, `companyBadge` (Philips/Biotron), `auditAction` (login_failed/logout), `bugFeatureStatus` (open/resolved/rejected) — ciascuno con le divergenze per tema dove realmente presenti (es. `entityStatus[5]` viola→slate su temp, `serviceNowPriority['3']` su `info.dark` che diverge in tutti e 3 i temi).
- **[theme]** `RimborsoSpesePage.tsx` ("foglio Excel") reso theme-aware: nuovo hook `useSheetStyles()` sostituisce i const a livello di modulo con hex fissi; bordo griglia ora su `text.primary`, intestazione su `background.default`, evidenziazione cella modificabile su `WidgetAccents.mintAccent` reale (prima approssimato con un rgba indipendente).
- **[theme]** `ServiceNowStats.tsx`, heatmap assenze (`StatsMatrix`/`colorFor`): scala a 4 stop ora dinamica su `alpha(theme.palette.primary.main, x)` invece di hex teal fissi — segue navy/temp invece di restare sempre teal.
- **[theme]** Consolidate varie palette categoriche duplicate: `TYPE_COLORS` (ServiceNowStats) e `FALLBACK_COLORS`/`PRESET_COLORS` (Wiki) confermati come varianti dello stesso concetto di `WidgetAccents.categoryAccents`; dove non ambigui, riusato il token condiviso invece di mantenere hex paralleli.

### Fixed
- conflitto --version con flag builtin Django in create_changelog_entry, rinominato in --release-version
- **[portal]** Utente "dual-profile" (accesso interno Archie + profilo Portal multi-cliente) non veniva mai scopato per cliente su `/api/devices/`, `/api/inventories/`, `/api/sites/` ecc., anche dopo un cambio cliente riuscito dal Portal (la pillola in topbar si aggiornava correttamente, ma le liste restavano quelle del primo cliente): `PortalScopedMixin` bypassava lo scope per chiunque avesse `core.access_archie`, senza distinguere da quale frontend l'utente stesse operando. Aggiunto `ambito` in sessione (fissato server-side al login, mai da un header client) e nuova `_bypasses_portal_scope()`: un utente dual-profile ora resta senza scope quando opera dal frontend Archie principale, ma viene scopato come un utente Portal puro quando ha fatto login dal Portal.
- **[config]** `DJANGO_SESSION_COOKIE_DOMAIN=.biotron.it` in produzione condivideva il cookie di sessione tra `archie.biotron.it` e `portal.biotron.it`, rendendo inefficace il fix dell'ambito sopra (la sessione poteva essere stata aperta dall'uno o dall'altro frontend). Rimossa l'impostazione: ogni sottodominio ha ora il proprio cookie di sessione separato. **Azione richiesta in produzione:** svuotare `DJANGO_SESSION_COOKIE_DOMAIN` nel `.env` e riavviare il backend.
- **[auth]** Il blocco sessione per inattività (LockScreen, 15/60 min) era gestito solo lato client (`useIdleTimer`, stato React): un semplice refresh della pagina reinizializzava lo stato e faceva rientrare nell'app senza richiedere la password, perché la sessione Django non aveva mai avuto un timeout di inattività reale (solo la scadenza fissa a 2 settimane). Aggiunta `SessionIdleTimeoutMiddleware` che applica i timeout server-side, con soglie differenziate per ambito: Archie 15 min lock / 60 min logout, Portal (dati clinici, clienti esterni) 10 min lock / 30 min logout — tutte configurabili via env (`DJANGO_SESSION_IDLE_LOCK/LOGOUT_SECONDS_ARCHIE/PORTAL`). Oltre la soglia di lock la sessione resta valida ma le richieste vengono rifiutate (401 `idle_lock`) finché non si reinserisce la password; oltre quella di logout la sessione viene invalidata (401 `idle_logout`). Frontend aggiornati (`shared/src/api/client.ts` + entrambi gli `AuthProvider`) per mostrare la LockScreen anche quando riceve questo 401 su un refresh a freddo, con dati utente minimi passati dal backend per popolarla senza bisogno di una `/me/` riuscita.
- **[theme]** Bug ricorrente "import statico del tema" (`import { theme } from '../theme'` a livello di modulo, congela i colori al tema default anche sotto navy/temp) trovato e corretto in 6 file: `RecentIssuesCard.tsx`, `AnnouncementsCard.tsx`, `ServiceNowCases.tsx` (TriagePanel), `ServiceNowStats.tsx` (ABSENCE_CELL_STYLE, ora funzione `getAbsenceCellStyle(theme)` condivisa tra `StatsMatrix` e `StatsTableBlock`), `Login.tsx`, `AuditEventsTab.tsx`.
- **[theme]** Bottoni "vai a sezione collegata" con `bgcolor: '#0d9488'` fisso (Customers, Sites, AuditEventsTab): mostravano sempre teal anche sotto il tema navy, dove `primary.main` è blu. Ora `theme.palette.primary.main`/`.dark`.
- **[theme]** `RecentIssuesCard.tsx`: priorità 'high'/'medium' usavano i colori di default *stock* di MUI (`#ed6c02`/`#0288d1`) invece di `warning.main`/`info.main` di questo tema — mai stati allineati alla palette custom dell'app, in nessun tema.
- **[theme]** `PianoFerie.tsx`: evidenziazione "oggi" e fascio luminoso hover su blu MUI di default (`rgba(25,118,210,x)`), non derivato da `info.main` — ora `alpha(theme.palette.info.main, x)`.
- **[theme]** `NotFound.tsx`: sfondo pagina e gradiente "404" su hex fissi indipendenti dal tema (`#f0fdfa`, `#0ea5a4`) — ora derivati da `primary.main`/`primary.light`/`background.default`.
- **[theme]** `Maintenance.tsx` (`RapportinoDialog`, `PlanDrawer`): stesso bug del teal `rgba(15,118,110,x)` non derivato dal tema, corretto in entrambi.
- **[theme]** `PurchaseOrders.tsx`: `rgba(241,245,249,0.9)` isolato combaciava esattamente con `background.default` — ora derivato dal tema invece di duplicato come letterale indipendente.
- **[theme]** `Drive.tsx`/`drive/FileCard.tsx`/`drive/PreviewDrawer.tsx`: hover/sfondo `#f8fafc` (Slate-50, stesso valore già centralizzato altrove come `grey.50`) normalizzato in 3 punti.

## [0.8.2] - 2026-08-11

### Added
- **[customers]** Colonna Provincia nella datagrid Customers (punto 6).
- **[customers]** Campo `Customer.province` come campo strutturato (sostituisce la chiave JSON in custom_fields), con migrazione `0010_customer_province.py` (punto 4).
- **[profile]** Selezione tema cross-device dal profilo utente (punto 1).
- **[site-repository]** Colonna Modello in `InventoryInlineList`, con aggiunta di `model` a `InventoryListSerializer`.
- **[purchase-order]** Toggle filtro Tutti/Ordinario/Extra, collegato sia alla lista che alla KPI `summary/` (nuovo parametro `?kind=`).
- **[dashboard]** Mappa Italia con confini reali ISTAT (choropleth SVG con drill-down province/capoluoghi), al posto del primo tentativo a cartogramma a griglia (scartato).
- **[servicenow]** Export PDF statistiche ServiceNow (endpoint `stats-export-pdf` + pulsante in pagina).
- **[ausl-bo]** Riordinamento colonne ↑↓ e upload certificato .p12 WiFi (testato e2e).
- **[crm]** Tab "Attività" aggiunta a `SiteDrawer` e `ContactDrawer` (audit log già presente in backend, mancava solo il frontend) — punto 7.


### Changed
- **[crm]** `InventoryDrawer` riscritto da zero per allinearsi al pattern condiviso `DrawerShell`/`DrawerSection`/`DrawerFieldList`, mantenendo le specificità (targa SVG K-Number, password auto-hide 30s via `SecretRow`, warning issue attiva, pulsanti di navigazione).
- **[customers]** Campi custom un-nested (modalità inline) in `CustomerDialog`.
- **[dashboard]** Range dimensioni widget (punto 3).
- **[site-repository]** Rimosso pulsante di modifica dalla riga cliente (resta accessibile solo dal menu contestuale).
- **[site-repository]** Pulsante nota: da tooltip troncato a modale con testo completo.
- **[crm]** Rimossi tutti i pulsanti azione (Apri cliente, Apri sito, Apri inventario, Lista filtrata) da `ContactDrawer` e `InventoryDrawer`, senza sostituzione.
- **[crm]** Redesign visivo `InventoryDrawer`: accent colore per categoria con bordo laterale (`DrawerSection` esteso con prop `accent`: info/secondary/warning/success/neutral), angoli completamente arrotondati.
- **[crm]** `SiteDrawer` migrato al pattern standard `canChange`/`canDelete` gestito da `DrawerShell`, rimossa la logica custom con `Can`/`ActionIconButton` — punto 7.
- **[crm]** Estratto componente condiviso `DrawerAddressSection` (indirizzo + mappa), eliminata la duplicazione tra `CustomerDrawer` e `SiteDrawer` — punto 7.
- **[crm]** Uniformati icone di sezione, campi copiabili (P.IVA in `CustomerDrawer`) e stato di caricamento (`DrawerLoadingState`) tra `CustomerDrawer`/`SiteDrawer`/`ContactDrawer` — punto 7.
- **[shared]** Nuova utility `copyToClipboard` in `shared/src/utils/clipboard.ts`, sostituisce l'implementazione duplicata locale in `Sites.tsx`.


### Fixed
- **[purchase-order]** Bug MUI X DataGrid: rimosso `headerAlign: 'right'` dalle colonne Importo/Costi sostenuti (causava il menu a tre puntini spostato a sinistra dell'etichetta).
- **[crm]** Incoerenza font tra label credenziale e campi password in `SecretRow` (allineato a `variant="caption"` / `color: text.disabled` come `DrawerFieldRow`).
- **[scripts]** `fix-push.sh`: non chiede più il numero di versione, lo calcola automaticamente come patch bump (es. 0.8.0 → 0.8.1).
- **[crm]** `ContactDrawer`: il pulsante "copia" mostrava il toast di successo ma non copiava realmente il valore negli appunti (callback che ignorava il testo) — ora copia correttamente.
- **[purchase-order]** `PurchaseOrderDrawer`: stesso bug di `ContactDrawer` — il pulsante "copia" sui campi Purchase Order/N. Fattura mostrava conferma senza copiare nulla — corretto.
- **[drive]** `DriveFileViewSet`: il parametro `root=true` non veniva applicato (a differenza di `DriveFolderViewSet`, che lo gestisce correttamente), quindi la vista root mostrava anche i file dentro le cartelle. Aggiunto filtro `folder__isnull=True` quando `root=true`.

### Security
- Nessuna modifica specifica di sicurezza in questo periodo.

## [0.8.0] - 2026-08-08

### Added
- Baseline changelog riscritto da zero, allineato alla versione attualmente in produzione.
