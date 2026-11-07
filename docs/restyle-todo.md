# Restyle "Campo sterile" — TODO

Aggiornato: 2026-11-06 · Ramo: `restyle` · Riferimento: `design-previews/h-base.html` (Issue), `design-previews/po-base.html` (Purchase Order).

Legenda: **[UI]** solo frontend · **[BE]** serve backend · **[DEC]** serve una decisione.

## Pagina Issue

### Presente nell'anteprima, non ancora nell'app
- **[BE] Prossimo passo** (chi, cosa, quando, "Fatto"): non esiste un campo sulla issue.
- **[BE] Procedura dalla Wiki** con spunte e "Cerca nella Wiki": manca il collegamento issue ↔ articolo.
- **[BE] Dove intervenire completo**: referente di reparto con telefono, device con seriale, credenziali bloccate. Oggi mostriamo cliente, sito, inventario collegato e ServiceNow.
- **[BE] Scheda Allegati**: le issue non hanno allegati (solo i task di area hanno `drive_files`).
- **[BE] "Visibile al cliente nel Portale"** su commenti e allegati, etichette Cliente/Interno nella cronologia.
- **[BE] Indicatore "Entro SLA"** (percentuale e obiettivo): nessun dato SLA. Al suo posto: Tempo medio di chiusura e Risolte negli ultimi 30 giorni.
- **[BE] Variazione del tempo di risoluzione** ("−0,4 g sulla settimana prima"): `/issues/summary/` dà solo la media.
- **[BE] "+ Salva vista"**: fatto, ma le viste sono salvate nel browser (per utente e pagina). Per averle su tutti i dispositivi serve salvarle sul server.
- **[UI] Avviso "nessun inventario collegato"** (triangolo accanto al titolo nella vecchia tabella): tolto dalla riga come nell'anteprima; resta nel pannello ("Nessun inventario collegato · Collega un inventario").
- **[UI] Ricerca Ctrl K a finestra** con risultati raggruppati (clienti, siti, device, issue, azioni): oggi Ctrl K porta il cursore nel campo e Invio apre la pagina Ricerca.

### Presente nella UI di prima, tolto o non ancora ridisegnato
- **[DEC] Grafico "Andamento issue"** (aperte/risolte, giornaliero/settimanale/mensile): sostituito dai mini grafici negli indicatori. Da decidere se serve ancora, magari in Dashboard.
- **[UI] Dialogo "Nuova issue / Modifica"** (`IssueDialog`): funziona, ma è il modulo vecchio con il nuovo tema, non ridisegnato.
- **[UI] Dialogo "Collega a inventory"**: idem.
- Colonne extra di prima (Categoria, Commenti, Data chiusura, Giorni passati): restano a destra di Scadenza, raggiungibili scorrendo o dal menu colonne.

## Pagina Purchase Order

- **[BE] "Da fatturare" in `summary`**: oggi calcolato dal frontend leggendo le righe dell'anno.
- **[DEC] Margine**: calcolato in pagina (importo − costi), non è un campo.
- **[UI] Dialogo Nuovo/Modifica PO** (`PurchaseOrderDialog`) e **dialogo di avanzamento** (`PurchaseOrderTransitionDialog`): funzionano, non ridisegnati (l'anteprima aveva un dialogo breve con solo i campi del passo).
- **[UI] Totali nel piè** ("Totale € … · Costi sostenuti € …" dell'anteprima): non ancora.
- **[UI] Ripristino multiplo dal cestino**: la logica c'è, ma la pagina non ha più un selettore di vista "cestino" visibile (va riesposto, es. come scheda o voce di menu).

## Comportamenti globali

- Pannelli di dettaglio (scheda flottante e drawer "campo"): si chiudono con un clic fuori e con Esc. I clic dentro menu, popover, dialoghi e messaggio con Annulla aperti dal pannello non lo chiudono.
- **[UI] Mappa Leaflet** dei drawer Clienti/Siti: caricata da unpkg.com. Senza internet la richiesta resta appesa; valutare di includerla nel bundle.

## Pagina Clienti

Fatta su `design-previews/c-base.html` (variante A · Scheda).

- **[BE] Lettura della password VPN non registrata nell'audit**: l'anteprima diceva "ogni visualizzazione resta nel log"; oggi `GET /customers/<id>/vpn/` restituisce la password a chi ha il permesso senza registrare nulla. Nell'app la frase è stata tolta.
- **[UI] Drawer cliente vecchio** (`CustomerDrawer`): ancora usato da Profilo.
- **[UI] Credenziali degli inventari nella scheda Inventari**: l'anteprima mostrava utenza e password per riga; l'elenco API non le include (servono la scheda dell'inventario e il permesso `inventory.view_secrets`).
- **[UI] Città e indirizzo**: stanno nei campi personalizzati, quindi si modificano solo da "Modifica", non sul posto. Tag non mostrati nel pannello.
- **[UI] Site Repository dal pannello**: non c'è un collegamento diretto (la pagina non accetta il cliente nell'URL).

## Pagina Siti

Portata direttamente nell'app con lo schema dei Clienti (nessuna anteprima dedicata).

- **[UI] Site Repository**: usa ancora i suoi drawer informativi (`InfoDrawers`) per siti e clienti.
- **[DEC] Cambio cliente di un sito**: nel pannello il cliente è in sola lettura (spostare un sito con inventari e issue fra clienti va deciso); si cambia solo da "Modifica".

## Pagina Contatti

Portata direttamente nell'app con lo schema di Clienti e Siti.

- **[UI] Ripristino multiplo dal cestino**: la vecchia pagina aveva il codice ma non la selezione delle righe, quindi non era raggiungibile; non riportato (resta la pagina Cestino).
- **[DEC] Cliente di un contatto**: nel pannello è in sola lettura; si cambia da "Modifica" (il sito deve appartenere al cliente).

## Pagina Inventari

Portata direttamente nell'app con lo schema di Clienti, Siti e Contatti.

- **[UI] Drawer inventario vecchio** (`InventoryDrawer`): rimosso con il porting di Site Repository.
- **[BE] Lettura delle credenziali non registrata nell'audit**: come per la VPN dei clienti, il dettaglio restituisce le password decifrate a chi ha `inventory.view_secrets` senza registrare la lettura.
- **[UI] Targa K-Number**: ripristinata nel pannello (scheda Dettagli), anche nella pagina Inventari.
- **[DEC] Cliente di un inventario**: nel pannello è in sola lettura; si cambia da "Modifica".

## Site Repository

Portata dall'anteprima `r-base.html` (proposta B: cartina + elenco delle province).

- **[UI] Esporta Excel di pagina**: nell'anteprima c'era in testata; il backend esporta solo il singolo cliente (azione sulla riga del cliente). Serve un export globale.
- **[UI] Varianti A (albero) e C (colonne)**: non portate.
- **[UI] Raggruppamento per città**: la pagina vecchia lo permetteva; ora solo per provincia.
- **[UI] Pannello asset, scheda Manutenzioni**: "Carica" sul singolo intervento usa `upload-pdf`; "Registra intervento" non c'è (rimanda ai Rapportini, nessun link diretto).
- **[DEC] Manutenzioni**: un piano copre l'asset se è dello stesso cliente e include il suo tipo; scadenza = override del singolo asset, altrimenti quella del piano (`GET /inventories/{id}/maintenance/`).
- **[DEC] Accesso**: le schede delle credenziali non hanno sistema operativo né data di aggiornamento (dati non presenti nel backend).
- **[DEC] Hardware**: scheda Manutenzioni per tutti i tipi tranne le applicazioni (`csap`, `wfm`, `orthoview`, `vue_motion`, `speech`), o se l'asset ha piani/interventi.
- **[TEST] Vitest**: tolti i 3 test di accessibilità della pagina vecchia (`pages/siteRepository/Accessibility.test.tsx`); baseline ora 155/155, lint 13.

## Task di area

Portata dall'anteprima `t-base.html` con righe e colonne come le Issue.

- **[DEC] Conversione in issue**: invariata nel backend (`convert-to-issue`: copia titolo, descrizione, priorità, commenti e, se idoneo, l'assegnatario; il task si completa e resta collegato). Nel pannello: riquadro "Trasforma in issue" nei Dettagli e voce nel menu; sui convertiti riquadro con la issue e "Apri la issue"; nella riga il segno "→ Issue #…".
- **[DEC] Indicatori**: nuova azione `GET /area-tasks/stats/?area=`; `summary` resta com'era (contatore della barra laterale).
- **[DEC] Completati**: le viste mostrano solo quelli chiusi negli ultimi 3 giorni, come la regola della lista (prima la pagina usava `include_hidden=1`).
- **[UI] Card Task nella Dashboard**: apre lo stesso nuovo pannello (`AreaTaskDetail`); la card in sé non è ancora ridisegnata.
- **[UI] Motivo dell'attesa**: le Issue hanno un motivo per "In attesa", i task no (servirebbe un campo nel modello).
- **[TEST] Vitest**: test della pagina riscritti sul nuovo comportamento (19 al posto di 30); baseline ora 144/144, lint 13.

## Piano ferie

Portata dall'anteprima `pf-base.html` (`shared/pf.js`, `shared/pf.css`). Colori dei motivi invariati (`pianoFerieShared.ts`, legenda HR).

- **[DEC] Richiesta**: le mezze giornate con lo stesso `request_group`, motivo e stato formano una richiesta; le righe storiche senza gruppo si uniscono per persona, motivo, stato e nota su giorni lavorativi contigui (`features/pianoferie/pfModel.ts`).
- **[DEC] Copertura**: soglie fisse nel frontend, bassa sotto il 60% dei presenti dell'area, da guardare sotto l'80%. Se servono soglie per area, campo su `LeaveArea`.
- **[DEC] Modifica**: riapre il dialogo precompilato; al salvataggio `bulk` riscrive i giorni nuovi e cancella le mezze giornate vecchie rimaste fuori. Nessuna azione backend nuova.
- **[DEC] Inserimento del coordinatore**: nasce già validato (prima si poteva scegliere lo stato). Chi non coordina vede solo il motivo Ferie (il backend rifiuta gli altri).
- **[UI] Esporta**: il pulsante dell'anteprima non c'è; non esiste un export del piano ferie (servirebbe un'azione `/absences/export/`, es. Excel con la legenda HR).
- **[UI] Tolti**: vista "Persona", pannello Riepilogo, card "Assenti oggi" (ora indicatore) e "Prossime festività" (le festività restano come colonne spente con il nome nel tooltip).
- **[UI] Annulla**: c'è dopo Valida/Rifiuta (riporta a proposta); non dopo Elimina/Ritira (il ripristino richiede il permesso `change`), che chiedono conferma.
- **[UI] Pannello**: nessuna scheda Attività separata; l'attività (richiesta, validazione) è in fondo ai dettagli, ricavata dai campi della richiesta e non dall'audit.
- **[TEST] Vitest**: nuovi test del modello (`pfModel.test.ts`, 8); baseline ora 152/152, lint 13.

## Wiki

Portata dall'anteprima `w-base.html`, variante **E · Archivio** (cartelle, schede d'archivio, scaffale, registro, foglietti). Stili in `features/wiki/archive/archive.css` (generato dal foglio dell'anteprima, limitato a `.wa`, colori dal tema via variabili CSS).

- **[BE] Preferiti**: nuovo modello `WikiPageFavorite` (migrazione `wiki/0014`), azione `POST/DELETE /wiki-pages/{id}/favorite/`, filtro `?favorite=1`, campi `is_favorite`/`favorited_at`; esposto anche `created_by` (per "Le tue bozze"). Test in `wiki/tests/test_favorites.py`.
- **[SEC] Barriera Portal sulle azioni `view` e `rate`** delle pagine Wiki: dichiarano `permission_classes=[IsAuthenticated]` e quindi saltano `IsInternalOrPortalDedicatedApp`. Non toccate in questo lavoro; la nuova azione `favorite` la include esplicitamente. Da allineare.
- **[DEC] Icone delle cartelle**: ricavate dal nome della categoria (`catIcon` in `archiveModel.ts`); l'emoji del modello non è più mostrata.
- **[DEC] Passi da spuntare**: gli elenchi numerati di primo livello diventano passi spuntabili; le spunte restano solo sulla pagina aperta (non salvate).
- **[DEC] Colori delle cartelle**: sono il colore della categoria (dato). Testo bianco o scuro scelto in base al contrasto. Nei grafici ogni cartella ha sempre nome e numero scritti (i colori da soli non bastano per chi non distingue i colori).
- **[UI] Pagina padre**: il modello ha `parent` ma il serializer non lo espone; non c'è nel design.
- **[UI] Collegamenti**: come prima solo clienti (il modello supporta anche sito e inventario).
- **[UI] Codice rimasto non usato**: `WikiAttachmentsTab` e `WikiLinkedCustomersTab` ora forniscono solo i tipi; il componente `WikiRevisionsTab` è usato nel dialogo Cronologia.
- **[UI] Confronto fra revisioni**: non c'è (solo anteprima e ripristino, come prima).
- **[TEST] Baseline**: frontend lint 13, vitest 152/152; backend pytest 846.

## Manutenzione (Scadenze, Piani, Rapportini)

Portata dall'anteprima `mt-base.html`: **A · Elenco** come vista predefinita, **B · Calendario** (colori più tenui) come alternativa (`?modo=calendario`); C · Tabellone scartato. Dialogo Rapportino **1 · Esito unico**.

- **[BE] `todo` riorganizzato**: calcolo comune in `_todo_rows`; ogni riga ha `last_result` / `last_date`; nuovi filtri `due=overdue|next30|later|override` e `type`; `page_size` fino a 500.
- **[BE] Azione `GET /maintenance-plans/todo-stats/`**: conteggi per stato, copertura del ciclo (fatte / totale), scadute per cliente, prossime uscite (cliente · sito), carico dei 12 mesi, rapportini del mese, KO e parziali degli ultimi 60 giorni, scelte per i filtri. Test in `maintenance/tests/test_todo.py`.
- **[UI] Testata**: sottosezioni Scadenze · Piani · Rapportini, interruttore Elenco / Calendario, «Registra rapportino».
- **[UI] Elenco**: viste Tutte, Scadute, Prossimi 30 giorni, Più avanti, Scadenza modificata; filtri da intestazione cliente, tipo, piano (`m_customer`, `m_type`, `m_plan`; il vecchio `m_due` resta valido); selezione multipla con «Registra rapportino» e «Non prevista»; scadenza su due righe, la modifica della scadenza sta nella colonna Piano.
- **[UI] Calendario**: carico dei 12 mesi, mese con i clienti giorno per giorno (giorni appena tinti, etichette chiare con pallino), pannello «Da recuperare» o del giorno con selezione e registrazione.
- **[UI] Scheda della scadenza** su `FloatingDetail`: scadenza spiegata, piano, inventario, ultimo intervento, storico dell'inventario; Modifica scadenza (dialogo esistente), Non prevista, Registra.
- **[UI] Rapportino**: esito a quattro schede, Oggi/Ieri, tecnico ricordato, nota obbligatoria per KO e parziale, per i KO «Apri una issue» (con `issues.add_issue`), PDF facoltativo, prossima scadenza calcolata.
- **[UI] Piani** (`/maintenance/plans`): indicatori (in corso, completati nel ciclo, con scadute, copertura), viste In corso · Con scadute · Completati · Archiviati, colonne con cadenza in chiaro e copertura del ciclo (fatte/coperte, scadute), scheda con avanzamento, programmazione, inventari con lo stato di ciascuno e storico; Report PDF (invariato, ora in `features/maintenance/planPdf.ts`), «Vedi da fare», dialogo crea/modifica ridisegnato (`PlanDialog.tsx`). Link diretto `?apri=<id>` (usato da «Apri il piano» nelle Scadenze).
- **[BE] Piani**: in elenco `todo_count` / `overdue_count` per piano con la stessa regola delle Scadenze; filtro `state=active|overdue|completed|archived` (archiviato = scadenza prima dell'anno corrente o non attivo); azione `plan-stats`. `completed_count` resta ma la UI non lo usa più (contava i rapportini dell'anno, non le manutenzioni del ciclo).
- **[UI] Rapportini** (`/maintenance/rapportini`): indicatori (mese, KO e parziali, senza PDF, per tecnico negli ultimi 90 giorni), viste Tutti · KO e parziali · Senza PDF · Non previste, filtri da intestazione cliente, piano, tecnico, esito; selezione con «Carica un PDF per tutti» ed «Elimina»; scheda con anteprima del PDF firmato (carica, sostituisci, rimuovi), «Apri issue» per KO e parziali, «Segna come non prevista».
- **[BE] Rapportini**: filtri `results=ko,partial` e `has_pdf`, azione `stats`; il serializer espone `customer_id` e `site_id` (servono per aprire la issue).
- **[FIX] Tipi del piano**: il dialogo proponeva solo i tipi hardware e, salvando, toglieva dal piano gli altri tipi; ora i tipi già presenti restano.
- **[RM] Rimossi** i vecchi componenti della manutenzione (dialogo rapportino, pannello del piano, `DueBadge`, `YearFilterField`, `maintenanceShared.ts`); in `MaintenanceLegacy.tsx` resta solo «Modifica scadenza».
- **[SEC] Da allineare**: le azioni `reset`, `restore` e `bulk_restore` dei rapportini dichiarano `permission_classes` senza `IsInternalOrPortalDedicatedApp` (stesso schema già segnalato per Drive upload e Wiki view/rate).
- **[DEMO] Dati fittizi in dev** marcati `demo-restyle` (siti, inventari, piani, rapportini, scadenze modificate); id in scratchpad `demo_mt_ids.json`.
- **[TODO] Aree**: divisione per area rimandata (anteprima pronta, disattivata con `AREAS_ON`); serve decidere se l'area sta sul cliente, sul sito o sul piano.

## Contratti

Portata sullo schema delle pagine anagrafiche (Siti, PO): testata, indicatori, viste, filtri da intestazione, scheda flottante.

- **[BE] Filtro `expiry`** su `/api/contracts/`: `ok | notice | expiring | expired | attention` (attention = preavviso + in scadenza), stessa logica di `Contract.expiry_state_on` tradotta in query (`contracts.api.expiry_q`).
- **[BE] Azione `GET /api/contracts/stats/`**: conteggi per stato e per scadenza, prossime 6 scadenze, `active_value` solo con `contracts.view_contract_value`; accetta `customer`, `seller`, `company`. Test in `contracts/tests/test_expiry_stats.py`.
- **[UI] Viste**: Tutti, Da gestire, Scaduti, In corso, Bozze, Disdetti (parametro `vista`); filtri da intestazione per cliente, tipo, venditore, società, anno (colonna Periodo) e stato; viste salvate ed esportazione CSV.
- **[UI] Colonna Stato unica**: per i contratti attivi mostra la scadenza (In corso, Preavviso, In scadenza, Scaduto), per gli altri lo stato (Bozza, Disdetto).
- **[UI] Periodo** come linea inizio → disdetta → fine con il giorno di oggi (tabella, scheda, card mobile).
- **[UI] Scheda** su `FloatingDetail` (sostituisce `ContractDrawer`, rimosso): Proprietà modificabili sul posto con annulla, Periodo con spiegazione della scadenza, Importo con ripartizione lineare mese/anno, Documento PDF, Note; schede Device e Attività (audit, valore mascherato dal backend).
- **[DEC] Indicatori**: i conteggi delle viste ignorano anno, tipo e stato; seguono solo cliente, venditore e società.
- **[UI] Dialogo contratto** (anteprima `ct-base.html`): **creazione a tre passi** (Cliente e tipo → Periodo → Valore e documenti), **modifica come scheda unica** con riepilogo a destra che si aggiorna (periodo, disdetta, rate). Logica comune in `features/contracts/contractForm.ts` (con test), campi in `ContractFormParts.tsx`.
- **[UI] Nel dialogo**: durata a scelta rapida (1/2/3/5 anni o «Fino al…»), preavviso 30/60/90/180 o altro, titolo composto da tipo e cliente finché non lo si cambia, codice proposto come successivo dell'ultimo dell'anno, società proposta dal cliente, importi all'italiana («36.000» = trentaseimila), «Salva come bozza» o «Crea contratto».
- **[UI] PDF già in creazione**: caricato subito dopo il salvataggio (solo con `view_contract_value`); se fallisce il contratto resta creato e compare un avviso.

## Drive

Portato dall'anteprima `d-base.html`, variante **A · Esplora file** (albero cartelle e clienti, Recenti, tabella o griglia, trascinamento su tutto il riquadro, pannello del file). Stili in `features/drive/drive.css`, icone dei file in `features/drive/DriveIcons.tsx` (disegnate, stile icone di sistema; colori fissi come un'immagine, tipo sempre scritto).

- **[BE] Campo `access`** su file e cartelle (sola lettura): le restrizioni per gruppo lungo la catena, con i nomi dei gruppi. Serve a "Chi può vederlo" senza leggere `/admin-groups/`. Test in `drive/tests/test_access_field.py`.
- **[SEC] `DriveFileUploadView`** (`/api/drive-files/upload/`, tenuta per compatibilità) dichiara `IsAuthenticated, CanUploadDriveFile` e quindi salta `IsInternalOrPortalDedicatedApp`. La pagina usa `/api/drive-files/`, che è protetto. Da allineare o eliminare.
- **[DEC] Filtro e ricerca**: elenco piatto su tutto il Drive (`?customer=` / `?search=` senza `root`), non più solo la radice.
- **[DEC] Link**: `/drive?cartella=<id>` e `/drive?file=<id>` (apre la cartella e il pannello); "Copia link" usa questi.
- **[UI] Attività** nel pannello: dal registro di audit, solo per chi ha `audit.view_auditevent`; gli aggiornamenti del Drive non registrano i campi cambiati, quindi spesso compare "lo ha modificato".
- **[UI] Spostamento multiplo**: come prima solo un elemento alla volta.
- **[UI] Rimossi** i componenti vecchi (`PreviewDrawer`, `FolderCard`, `FileCard`, righe, menu, `UploadZone`).
- **[TEST] Baseline**: frontend lint 11, vitest 152/152 (test Drive riscritti sulla nuova interfaccia); backend pytest 848.

## Struttura e tema

- **[DEC] Palette Blu e Indaco**: implementate, non selezionabili (`selectable: false` in `themeRegistry.ts`).
- **[UI] Modalità scura**: alcune pagine non migrate hanno ancora colori chiari scritti nel codice (es. `#f8fafc`, `grey.50`).
- **[UI] Pagina di login**: invariata.
- **[UI] Dashboard**: widget e card con gradienti (`BirthdaysCard`, `ContributorCard`, `QuickActionsPairCard`, …).
- **[UI] PDF dei Piani di manutenzione**: intestazione a gradiente.
- **[UI] `useDataGridZebraSx`** e alcune card hanno ancora gli stili del tema precedente nelle pagine non migrate.

## Pagine da migrare (ordine deciso)

1. Clienti, Siti, Inventari, Contratti, Manutenzione (testata, indicatori, viste, filtri da intestazione).
2. Le altre pagine.

I pannelli di dettaglio di tutti i moduli sono già nello stile nuovo (`DrawerShell`/`DrawerParts` con aspetto "campo").

## Fase 2

- **Portal** (`frontend-portal/`): restyle dopo Archie; oggi resta volutamente invariato.
