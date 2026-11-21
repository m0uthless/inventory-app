# Restyle "Campo sterile" — TODO

Aggiornato: 2026-11-06 · Ramo: `restyle` · Riferimento: `design-previews/h-base.html` (Issue), `design-previews/po-base.html` (Purchase Order).

Legenda: **[UI]** solo frontend · **[BE]** serve backend · **[DEC]** serve una decisione.

## Pagina Issue

### Presente nell'anteprima, non ancora nell'app
- **[BE] Prossimo passo** (chi, cosa, quando, "Fatto"): non esiste un campo sulla issue.
- ~~**[BE] Procedura dalla Wiki**~~ fatto (2026-11-09): articoli Wiki collegati alla issue (`WikiLink` con `entity_type="issue"`, migrazione `wiki/0015`), passi ricavati dall'articolo (lista `- [ ]`, altrimenti il primo elenco numerato; `wiki/procedure.py`) e spunte salvate sul collegamento (`checked_steps`). Endpoint `GET/POST /issues/{id}/wiki/`, `PATCH/DELETE /issues/{id}/wiki/{link}/` (lettura: issue + Wiki; scrittura: modifica issue), audit sulla issue. Sezione «Procedura» nella scheda (`features/issues/IssueProcedure.tsx`) e, in cima sotto le Proprietà, la card «Prossimo passo» con il primo passo da fare e «Fatto» (a procedura finita: «Procedura completata»); stato condiviso in `useIssueWiki.ts`. Test in `issues/tests/test_issue_wiki.py`. In dev c'è l'articolo dimostrativo «Riavvio servizio MWL».
- ~~**[BE] Dove intervenire completo**~~ fatto il 20/11: referente del sito con «Chiama» ed email, seriale e K-number, credenziali dell'inventario (30 secondi, con permesso).
- ~~**[BE] Scheda Allegati**~~ fatta il 20/11: caricamento diretto (`issues.IssueAttachment`), eredità «[Task]» dai task di area.
- ~~**[BE] "Visibile al cliente nel Portale"**~~ su commenti e allegati: scartato da Fede (20/11).
- ~~**[BE] Indicatore "Entro SLA"**~~: scartato da Fede (20/11). Restano Tempo medio di chiusura e Risolte negli ultimi 30 giorni.
- ~~**[BE] Variazione del tempo di risoluzione**~~: scartata da Fede (20/11), insieme allo SLA.
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
- ~~**[UI] Ripristino multiplo dal cestino**~~ fatto il 21/11: PO, Contratti e Issue sono nella pagina Cestino, che ha la selezione multipla.

## Comportamenti globali

- Pannelli di dettaglio (scheda flottante e drawer "campo"): si chiudono con un clic fuori e con Esc. I clic dentro menu, popover, dialoghi e messaggio con Annulla aperti dal pannello non lo chiudono.
- ~~**[DEC] Mappa dei drawer Clienti/Siti**~~ fatta il 20/11: variante B di `design-previews/map-base.html` (MapLibre + OpenFreeMap ricolorata con i colori dell'app, chunk `vendor-maplibre` caricato solo con la mappa, «Ingrandisci» per la mappa grande). Leaflet e unpkg tolti.

## Pagina Clienti

Fatta su `design-previews/c-base.html` (variante A · Scheda).

- ~~**[BE] Lettura della password VPN non registrata nell'audit**~~ fatto il 21/11 (`?reveal=1` + azione `view_secret`).: l'anteprima diceva "ogni visualizzazione resta nel log"; oggi `GET /customers/<id>/vpn/` restituisce la password a chi ha il permesso senza registrare nulla. Nell'app la frase è stata tolta.
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

- ~~**[UI] Ripristino multiplo dal cestino**~~ fatto il 21/11: PO, Contratti e Issue sono nella pagina Cestino, che ha la selezione multipla.
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

- **[UI] Colori delle cartelle in pastello** (2026-11-08, richiesta di Fede): il colore salvato viene ricondotto alla tinta pastello più vicina della Dashboard (`tintOf`/`catColor` in `features/wiki/archive/archiveModel.ts`, chiaro e scuro); il gestore cartelle propone solo le 7 tinte più il grigio (rimossi i colori accesi e il selettore libero, `ui/wikiCategoryColors.ts` eliminato); il colore mostrato è tenue come la Dashboard (via di mezzo tra il fondo chiaro della tinta e il suo tono medio; in scuro tra il fondo scuro e il tono medio), testi su cartelle e linguette con l'inchiostro calcolato sul colore. Nessuna migrazione: i colori vecchi restano nel database e si vedono in pastello.

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

## Rimborso spese (Nota spese)

Portato dall'anteprima `ns-base.html`, variante **A · Foglio** (scelta da Fede): le 12 categorie come righe del modello Excel, trasferte km sotto il rimborso chilometraggio, riepilogo a destra. Componenti in `features/expenses/` (`nsModel.ts` con test, `nsUi.tsx`, `ExpenseKpis.tsx`, `ExpenseSheet.tsx`, `ExpenseSummary.tsx`, `ExpenseDialogs.tsx`).

- **[BE] Campo `submitted_at`** su `ExpenseReport` (migrazione `0002`, impostato da `submit`, riempito con `updated_at` per le note già inviate): serve per "Inviata il" e "in attesa da N giorni". Resta valorizzato dopo validazione o rifiuto.
- **[BE] `km_rate`** nel serializer della nota: la tariffa €/km del proprietario (prima il frontend conosceva solo quella di chi guarda, da `/meta/`). Test in `expenses/tests/test_submitted_at_km_rate.py`.
- **[UI] Elenco**: per il dipendente indicatori (mese in corso, nota rifiutata, rimborsato nell'anno, spese per mese) e viste Tutte / Da completare / Inviate / Validate; per la segreteria indicatori (da validare con la più vecchia, senza scontrino, validato nel mese, rimborsato per persona), viste Da validare / Rifiutate / Validate / In compilazione / Tutte, filtro Dipendente dall'intestazione, attese oltre 14 giorni in rosso. La segreteria passa a "Le mie note" con il selettore in testata (`?ambito=mie`).
- **[UI] Nota**: importi, descrizioni e date modificabili nelle righe (salvataggio all'uscita dal campo, importi all'italiana), scontrini come chip con anteprima (immagine o PDF), etichetta "manca" per le voci senza scontrino, suggerimento dallo scontrino (OCR) da applicare alla riga, trasferte con destinazioni già usate proposte e km riempiti.
- **[UI] Dialoghi**: Nuova nota (griglia dei 12 mesi con quelli già usati disattivati), Rifiuto con motivi frequenti, Anteprima scontrino, **Tariffe km** per la segreteria (prima solo dall'admin di Django).
- **[DEC] Tariffa km**: il rimborso si ricalcola solo quando si inserisce/modifica/toglie una trasferta (comportamento del backend invariato); il dialogo lo dice.
- **[UI] Variante B · Voci** dell'anteprima (solo voci compilate, scontrini trascinati e assegnati alla categoria): non portata.
- **[UI] Rimossa** la vecchia pagina a griglia "foglio Excel" con bordi neri.

## Audit

Portato dall'anteprima `au-base.html`, variante **A · Registro** (scelta da Fede), con le colonne **Data** e **Ora** separate al posto di "Quando" (richiesta di Fede). Componenti in `features/audit/` (`auditModel.ts` con test, `auditUi.tsx`, `AuditKpis.tsx`, `useAuditStats.ts`, `AuditDetailCard.tsx`); rimosso `AuditEventDrawer`.

- **[BE] Azione `GET /api/audit-events/stats/`**: eventi di oggi (e modifiche), eventi per giorno degli ultimi 14 giorni, accessi falliti nelle 24 ore con la coppia nome utente/IP più frequente, eliminazioni dei 7 giorni, chi ha modificato di più (7 giorni), eventi del sistema. Test in `audit/tests/test_stats.py`.
- **[BE] Filtri nuovi**: `actions` (più azioni insieme), `actor_null` (eventi del sistema), `ip`; campo `actor_name` nel serializer.
- **[BE] Link "Apri …"** (`config/ui_paths.py`): piano di manutenzione su `/maintenance/plans?apri=`, cartella Drive su `?cartella=`, aggiunti contratti, task di area e note spese. Corretto anche il link della Ricerca ai piani (`pages/Search.tsx`).
- **[UI] Viste**: Tutto, Modifiche, Eliminazioni, Accessi, Accessi falliti (parametro `vista`), con i conteggi sugli stessi filtri; **periodo** Oggi / 7 giorni / 30 giorni / Sempre (parametro `periodo`; da un link con utente o oggetto parte da "Sempre"). Filtri da intestazione per utente (anche "Sistema"), azione e tipo; esportazione CSV.
- **[UI] Pannello**: differenze campo per campo (Prima barrato / Dopo), password mai mostrate, chi e da dove con browser leggibile, dettagli tecnici chiusi, storico dell'oggetto, per gli accessi falliti i tentativi dallo stesso IP in 24 ore e se l'indirizzo è interno; pulsanti "Solo questo oggetto", "Apri …" (dal percorso del backend) o "Apri il Cestino".
- **[UI] Variante B · Cronologia** dell'anteprima: non portata.

## Dashboard

Portata dall'anteprima `db-base.html`, variante **A · Tinte** (scelta da Fede dopo due proposte bocciate perché troppo sobrie): widget a tinte tenui, griglia personalizzabile come prima. Widget in `features/dashboard/widgets/` (`WidgetShell`, `tints.ts`, `WelcomeWidget`, `QuickActionsWidget`, `IssuesWidget`, `MaintenanceWidget`, `AnnouncementsWidget`, `TodoWidget`, `NoteWidget`, `PeopleWidgets`); `ui/AreaTaskCard.tsx` ridisegnato sul posto (test invariati, ora con il tema). Rimossi i vecchi `WeatherHeroCard`, `weatherPalette`, `RecentIssuesCard`, `AnnouncementsCard`, `TodoCard`, `MaintenanceAlertsCard`, `StickyNoteCard`, `BirthdaysCard`, `QuickActionsPairCard`, `QuickActionTile`, `ContributorCard`.

- **[DEC] Colore solo in Dashboard**: tinte pastello nel tema (`palette.archie.tints`, uguali in tutte le palette, chiaro/scuro); le pagine operative restano sulla regola "colore per azione, selezione, stato". Icone dei widget piene e colorate, senza tessera.
- **[BE] Migrazione `core/0043_dashboard_tinte_widgets`**: nuovo widget `team` ("Il team oggi", assenze di oggi dal Piano ferie, 2×1–3×2) e formati in più per `contributor` (2×2), `birthdays` (2×1, 2×2), `quick-actions-pair` (2×1). I formati vecchi restano validi: i layout salvati non cambiano.
- **[UI] Widget**: benvenuto con saluto per ora del giorno, data, riepilogo (issue tue, task tuoi, manutenzioni scadute, con link alle viste) e meteo Open-Meteo con 4 giorni (limite 8 s); issue aperte con barra per priorità e Tutte/Mie; manutenzioni con scadute, prossimi 14 giorni e clienti con più scadute (da `todo-stats`); comunicazioni (staff: aggiungi, modifica, elimina); da fare; nota a quadernino (righe e margine, salvataggio automatico); compleanni; contributor del mese come prima (coriandoli, trofeo, anello) in pastello; il team oggi (solo per chi è nel Piano ferie).
- **[FIX] Nota**: il vecchio widget salvava a ogni tasto (pulizia dell'effetto legata al testo); ora salva dopo 800 ms e allo smontaggio.
- **[UI] Issue** accetta `?vista=mine|overdue|closed|all` (link dalla Dashboard).
- **[UI] Telefono**: widget uno sotto l'altro al posto del carosello.
- **[TODO] Layout predefinito**: i nuovi utenti partono da quello impostato con "Imposta come predefinito" (superuser); quello dell'anteprima va impostato da Fede in produzione. In dev l'ho applicato all'utente `verifica-ui`.

### Dashboard "Aurora" (2026-11-09)

Sostituisce "Tinte": anteprima `db-base.html`, variante **F · Aurora**, scelta da Fede perché la versione precedente aveva troppi colori estranei all'app.

- **[UI] Fascia in testa** (`features/dashboard/DashboardHero.tsx`): lo stesso sfondo animato della login (ShaderGradient, chunk `vendor-login-bg` caricato solo qui e nella login; gradiente fermo senza WebGL), saluto, data, settimana e meteo in una riga, Nuova issue e Triage, quattro numeri (issue tue, task tuoi, manutenzioni scadute, colleghi assenti oggi; l'ultimo solo per chi vede il Piano ferie). La prima riga di widget sale sulla fascia con un'ombra leggera.
- **[UI] Pausa delle animazioni**: pulsante accanto a Personalizza, ferma sfondo, coriandoli e palloncini; scelta ricordata nel browser (`archie-dash-anim`). Con "riduci movimento" restano ferme comunque.
- **[DEC] Colori**: solo verde, salvia e acciaio (il blu della login) più il giallo post-it della nota (`palette.archie.dash`, separato da `tints`, che restano per Wiki e ServiceNow). Il rosso resta allo stato "scaduto". Widget distinti per trattamento (`WidgetShell` `look`): Issue scuro (fascia delle schede), Manutenzioni, Comunicazioni e Da fare su carta, Task di area salvia, Il team oggi acciaio, Nota post-it con angolo piegato.
- **[UI] Compleanni**: se qualcuno compie gli anni oggi il widget festeggia (ritratto con anello che pulsa, palloncini che salgono); altrimenti riga tranquilla. Contributor del mese grande la metà (1×2), nei verdi.
- **[BE] Migrazione `core/0044_dashboard_aurora`**: disattiva i widget `weather` e `quick-actions-pair` (ora nella fascia), Contributor e Compleanni predefiniti 1×2, layout con Contributor 2×2 dimezzati. Rimossi `WelcomeWidget` e `QuickActionsWidget`; meteo e riepilogo in `features/dashboard/weather.ts`.
- **[TODO] Layout predefinito**: i layout salvati restano (i buchi lasciati dai widget tolti si richiudono da soli); quello per i nuovi utenti va reimpostato da Fede con "Imposta come predefinito".

## Inserimento dati (2026-11-09)

Linea comune scelta da Fede dall'anteprima `fm-base.html`, variante **C · Rapido**: titolo grande, descrizione (o note), proprietà come pillole che aprono un selettore con ricerca e tastiera, i campi rari in "Altri campi" con etichette sopra; Ctrl+Invio salva; stessa forma per creare e modificare. Componente `ui/campo/QuickForm.tsx` (`QuickForm`, `SelectPill`, `TextPill`, `DatePill`, `TogglePill`, `QuickField`, `QuickFields`, `QuickGroup`) e `ui/ProvincePill.tsx`.

- **[UI] Portati**: Task di area, Clienti, Siti, Inventari, Contatti (stesse props dei vecchi dialoghi, le pagine non cambiano). Inventari: rete, credenziali (stesse regole sul permesso), apparecchio, tag e campi personalizzati in "Altri campi", aperto da solo in modifica se c'è già qualcosa. Clienti: il nome visualizzato segue il nome finché non lo si cambia a mano.
- **[UI] Issue e Bug e feature** (2026-11-09): Issue con il cliente cercato sul server e "Non è in anagrafica? Scrivi il nome" in fondo al selettore (testo libero), Sito dopo il cliente, "In attesa di" con lo stato In attesa, inventario collegato come pillola, issue chiusa in sola lettura. Bug e feature: la frase principale come titolo e i dettagli sotto (salvati come un unico testo, prima riga = titolo), Tipo, Dove e Screenshot in pillole, Ctrl+V incolla lo screenshot ovunque nel modulo.
- **[TODO] Da portare**: Caso ServiceNow; "Creane un altro" è pronto nel componente ma va collegato nelle pagine che lo vogliono.
- **[DEC] Dove non usarlo**: Purchase Order, Contratti, Piani di manutenzione, Rimborso spese, Rapportino (importi, cadenze, righe, passi).

## Cestino e Bug e feature
- Fatte da `cb-base.html` (2026-11-08): Cestino variante A · Tabella, Bug e feature variante B · Bacheca. Niente KPI né sottotitolo (richiesta di Fede).
- Cestino: schede per tipo con conteggi, selezione multipla con barra Ripristina / Elimina definitivamente, stato per riga (Ripristinabile, Prima il padre, Ha collegati attivi), dialogo di eliminazione con "Ho capito", "Svuota il cestino". Nuovo endpoint `GET /api/trash/info/` (core/trash_api.py): blocchi di ripristino/eliminazione e "eliminato da" ricavato dall'Audit.
- Bug e feature: bacheca Bug aperti / Funzionalità richieste / Chiuse di recente (ultime 10, link a /bug-feature/resolved che mostra Risolte e Rifiutate). Scheda flottante con screenshot (anche incolla/trascina), Segna come risolta, Rifiuta con motivi pronti, Riapri. Dialogo "Segnala". `BugFeatureDrawer` rimosso; `NsDialog` spostato in `ui/campo/CampoDialog`.
- Da valutare: issue, contratti, PO e altri tipi nel Cestino (oggi hanno il cestino nella loro pagina).

## 404, Monitor e Ricerca
- Fatte da `mr-base.html` (2026-11-08), variante A per tutte e tre, senza KPI né sottotitolo.
- 404: dentro l'app, "404" a contorno nelle tinte, indirizzo sbagliato, Torna indietro / Vai alla Dashboard, campo di ricerca e scorciatoie.
- Monitor: schede per stato + "Senza workstation" (azione `stats`, filtro `inventory__isnull`, `customer_name` nel serializer, ricerca anche per workstation/sito/cliente), filtro Tipo nell'intestazione, scheda flottante con cambio stato al clic, workstation, monitor vicini e storia dall'Audit; dialogo Nuovo/Modifica con ricerca della workstation. Rimossi `MonitorDrawer` e `MonitorFormDrawer`.
- Ricerca: campo grande, colonna dei tipi con conteggi (`?tipo=`), gruppi per tipo con evidenziazione, ricerche recenti nel browser. Backend: risultati Drive aprono cartella/file, sottotitoli di ripiego in italiano, `SearchAPIView` ora con `IsInternalOrPortalDedicatedApp`.

## Profilo e Utenti e gruppi
- Fatte da `up-base.html` (2026-11-08), variante A. Il Profilo è una scheda flottante della stessa misura dei dettagli delle altre pagine (aperta dal menu utente e da /profile), con schede Dati, Aspetto, Sicurezza, Permessi, Attività. Backend: `/me` con `last_login` e `date_joined`, nuovo `GET /api/me/logins/` (ultimi 5 accessi riusciti).
- Utenti e gruppi: interruttore Utenti/Gruppi nella testata, viste Attivi / Solo Portal / Account funzionali / Disattivati / Tutti, scheda utente flottante (Permessi con livelli e origine "gruppo X" o "assegnato a mano", Portal e clienti, permessi speciali; Anagrafica e ruoli; Attività), gruppi come schede con la striscia dei permessi e scheda del gruppo. La stessa scheda utente è usata da Accesso Portal. Rimossi `UserDrawer`/`GroupDrawer` e il vecchio drawer del Profilo.
- Da valutare: descrizione dei gruppi (serve un campo), restyle della pagina Accesso Portal.
- 17/11: utente e gruppo si aprono nella finestra (`RecordModal`, anteprime `ud-base` variante D e `gd-base`) al posto della scheda flottante; menu del tasto destro su utenti e gruppi; membri gestiti dalla finestra del gruppo (`user_ids`).
- **[DEC] Permessi che non controllano nulla**: Piano ferie, Rimborso spese e Bug e feature compaiono nella matrice dei permessi, ma pagina e API sono aperte a ogni utente Archie (contano solo i flag del profilo: area ferie, coordinatore, segreteria spese); anche «Nessuno» non toglie l'accesso. Task di area (in `core`, dipende dall'area ferie) e Monitor (segue i permessi degli Inventari) non hanno una riga propria. Proposta: far valere i permessi per Rimborso spese e Bug e feature (verificare prima i gruppi in prod), togliere la riga Piano ferie dalla matrice. Tutti e cinque restano spegnibili dalla pagina Moduli.

## ServiceNow
- Fatte da `sn-base.html` (2026-11-09): Casi variante A e Dashboard casi (variante B delle statistiche), che sostituisce le pagine Statistiche e Assenze tecnici (i vecchi indirizzi portano alla Dashboard).
- Casi: riquadro "Oggi" senza gradiente, viste Tutti / Oggi / Miei / Da assegnare (filtri backend `opened_date` e `unassigned`), stesse colonne di prima, nessuno stato (il caso è solo una registrazione). Menu contestuale: Apri, Crea issue, Crea task (nuovo: apre il task già compilato), Messaggio (Philips), Modifica, Elimina. Scheda flottante e dialogo "Nuovo caso" con screenshot (stessa lettura OCR).
- Dashboard casi: Andamento (torta dei type e colonne per periodo, palette verificata), Per tecnico (mappa con assenze segnate), Oggi, Assenze della settimana. Backend: filtro `user` sulle assenze (prima ignorato).
- Da valutare: i type Philips tornano visibili quando si riattiva la categoria (visibleCategories.ts).

## Login
- Fatta da `lg-base.html` (2026-11-09), variante D · Tinte animate: scheda di accesso larga 456px al centro, sfondo animato con ShaderGradient (MIT) nei colori dell'app, fermo con "riduci animazioni", gradiente fisso senza WebGL. three.js e ShaderGradient in un chunk a parte (`vendor-login-bg`, ~290 kB gzip) caricato solo dalla login.
- Logo: `frontend/public/login-logo.svg` è un segnaposto da sostituire con il logo definitivo.
- La login di Archie non usa più `@shared/ui/LoginPage` (che resta per il Portale clienti); le foto `login-bg-*.jpg` in `frontend/public` non sono più usate da Archie.

## Accesso Portal
- Fatta il 2026-11-09 direttamente nello stile di Utenti e gruppi (senza anteprima, su richiesta di Fede): viste Tutti / Attivi / Sospesi / Anche in Archie, filtro Cliente dall'intestazione, colonne Utente, Livello, Cliente predefinito, Altri clienti, Archie, Ultimo accesso; la scheda utente si apre con la sezione Portal in cima (`portalFirst`).

## ~~Titolo nella linguetta~~ (scartato)

Fede (20/11), dopo l'anteprima aggiornata `tm-base` (ora tolta, resta in git): scartato insieme al colore per modulo. Non riproporlo.

Mockup in `design-previews/ct-base.html` (interruttore "Titolo: Nella pagina / Linguetta"), da disegno di Fede `design-previews/title-page-card.png`. Fede ne deve parlare internamente prima di portarlo nell'app.

- **[DEC] Titolo della pagina in una linguetta del foglio**: il foglio del contenuto sale nella barra in alto fino al titolo e scende con una curva prima della ricerca (che resta centrata).
- **[DEC] Pulsanti principali nella riga delle viste**, a destra dopo "Salva vista"; la riga dei pulsanti sopra gli indicatori sparisce. Su telefono tutto resta com'è.
- **[UI] Se approvato**: va nella struttura generale (`layout/AppLayout.tsx`, `PageHead`) per tutte le pagine; le pagine senza viste tengono i pulsanti dove sono.

## ~~Colore per modulo~~ (scartato, 20/11)

Scartato da Fede il 20/11 dopo l'anteprima `tm-base`. Resta valida la regola di DESIGN.md «nessun colore proprio per i moduli».

Proposta approvata da Fede come idea ma rimandata ("ottima idea ma prematura"); anteprima `design-previews/hm-base.html` (Issue) e interruttore "Colori modulo" in `db-base.html`, file `design-previews/shared/modcolors.css|js`.

- **[DEC] Un colore tenue per modulo o per categoria**, sempre lo stesso: icona della sidebar nel colore del modulo (in grassetto, scritte neutre), eco nell'icona accanto al titolo della pagina, widget della Dashboard nello stesso colore del loro modulo. Selezione sempre verde (consigliato) oppure nel colore del modulo: da decidere.
- **[DEC] Da aggiornare in `frontend/DESIGN.md`** la regola "nessun colore proprio per i moduli"; i colori di stato devono restare distinguibili dai colori dei moduli.
- **[UI] Da valutare** colori per modulo o per categoria della sidebar (Operatività, Anagrafiche, …): i moduli sono una ventina e i colori sei.

## Struttura e tema

- **[DEC] Palette Blu e Indaco**: implementate, non selezionabili (`selectable: false` in `themeRegistry.ts`).
- **[UI] Modalità scura**: alcune pagine non migrate hanno ancora colori chiari scritti nel codice (es. `#f8fafc`, `grey.50`).
- **[UI] Pagina di login**: invariata.
- **[UI] Dashboard**: widget e card con gradienti (`BirthdaysCard`, `ContributorCard`, `QuickActionsPairCard`, …).
- **[UI] PDF dei Piani di manutenzione**: intestazione a gradiente.
- **[UI] `useDataGridZebraSx`** e alcune card hanno ancora gli stili del tema precedente nelle pagine non migrate.

## Via il drawer: finestra dei record (dal 17/11)

Standard nuovo (DESIGN.md › Record window): il record si apre in una finestra larga e centrata, una sola barra di salvataggio. Fatti: utente, gruppo, cliente, sito, contatto (18/11, anteprima `core-base`). Navigazione nella stessa finestra fra cliente, sito e contatto fatta (pila con «‹ Cliente», 18/11). Inventari fatti (18/11, anteprima `inv-base` A seconda versione: lettura poi «Modifica» dal ⋯), anche nella pila e nel Site Repository. Lo schema «lettura, poi Modifica» vale ora anche per cliente, sito e contatto (18/11). Issue fatte (18/11, anteprima `iss-base` A; scartata la pagina divisa), frecce a destra in tutte le finestre. Task di area fatti (18/11, anteprima `tsk-base`). Contratti fatti (18/11, anteprima `ctr-base`; ritocchi estetici da decidere nei prossimi giorni). PO fatti (18/11, anteprima `pof-base`), con il nuovo «Seguito da». Il gruppo Issue/Task/Contratti/PO è chiuso. Manutenzione fatta (18/11, anteprima `mtw-base`: scadenza, piano, rapportino; «Modifica» apre i dialoghi esistenti). Audit fatto (19/11, anteprima `aud-base`). Drive fatto (19/11, pannello fisso, anteprima `drv-base` variante B). ServiceNow, Monitor, Piano ferie fatti (19/11, anteprima `rst-base`). Bug e feature e Profilo fatti (19/11, anteprima `bfp-base`). Con la vecchia scheda resta solo Moduli, per scelta. Loghi delle credenziali da fornire in `frontend/public/logos/`. Pezzi comuni in `ui/campo/RecordParts` + `recordShared` e `features/records/linked` (issue, inventari, persone, dove): il Contatto li riusa. Ordine concordato: Cliente (anteprima `cd-base`) → Siti, Contatti, Inventari → Issue, Task di area, Contratti, PO (valutare anche la «pagina divisa») → per ultime, o restano col pannello: Audit, caso ServiceNow, eventi e todo di Manutenzione, Piano ferie, Monitor; Drive caso a sé.

- ~~**[UI] Record collegati nella stessa finestra**~~ fatto 18/11: `RecordStackHost` + `PushedRecord`; issue, inventari, contratti aprono ancora la loro pagina finché non hanno la finestra.
- **[UI] Mappa nei test automatici**: la mappa ora usa MapLibre (stile da tiles.openfreemap.org) e la posizione da Nominatim; dove internet non c'è il riquadro mostra «Mappa non disponibile». Nei test nel browser bloccare o dirottare `tiles.openfreemap.org` e `nominatim`.

## Pagine da migrare (ordine deciso)

1. Clienti, Siti, Inventari, Contratti, Manutenzione (testata, indicatori, viste, filtri da intestazione).
2. Le altre pagine.

I pannelli di dettaglio di tutti i moduli sono già nello stile nuovo (`DrawerShell`/`DrawerParts` con aspetto "campo").

## Fase 2

- **Portal** (`frontend-portal/`): restyle dopo Archie; oggi resta volutamente invariato.

## Issue per area e assegnabili per gruppo (19-20/11)

Spec: `docs/superpowers/specs/2026-11-19-issue-area-assignee-groups-design.md`. Tutto su develop, non ancora rilasciato.

- **Deploy in produzione:**
  - lanciare `migrate` (`servicenow.0012`, `issues.0009`–`0011`, `core.0048`);
  - dare ai gruppi i tre permessi «È tecnico ServiceNow», «Può essere assegnatario delle issue» e «Vede le issue di tutte le aree». Finché mancano i primi due nessuno è assegnabile e l'email «nuova issue» non parte.
- ~~**[UI] Verifica nel browser**~~ fatta il 20/11 (Playwright): selettore d'area, Area nei Dettagli, assegnatario fuori area, cambio d'area, issue invisibile senza permesso, sola lettura con il permesso, menu col tasto destro di Contratti, Piani, Rapportini e Drive.
- ~~**[UI] Link a una issue invisibile**~~: fatto il 20/11, «Elemento non trovato o non visibile.» al posto del 404 grezzo di DRF (`shared/src/api/error.ts`).
- ~~**Rimandati dalla revisione e test mancanti**~~ fatti il 20/11: area disattivata rifiutata, assegnatario fuori area o senza permesso visibile nel selettore e tenuto al cambio d'area, «Assegna a me» solo agli assegnabili, una sola `get_object()`, titolo della issue convertita nascosto nei task di altre aree, `/api/wiki-links/` senza i link a issue invisibili (404 su dettaglio e ripristino), etichetta Wiki senza utente senza titolo; test per conteggi e riepiloghi di crm e inventory e per il superuser con un'area.
- **[DEC] Philips:** oggi non servono. Idea di Fede (20/11): spostare il flag Philips dal singolo utente all'appartenenza a un gruppo «Philips», così potranno avere i permessi di gruppo come gli altri. Da valutare quando torneranno.

## Generatore SQL PACS (20/11)

Spec: `docs/superpowers/specs/2026-11-20-text2sql-design.md`; anteprima `design-previews/sql-base.html` (variante A). Su develop, non ancora rilasciato.

- **Deploy in produzione:**
  1. installare Ollama e il modello (default `qwen2.5-coder:7b`) sulla macchina scelta, server o VM;
  2. impostare `OLLAMA_URL` in `.env.prod`;
  3. avviare il servizio `text2sql-worker`;
  4. lanciare `migrate` (`text2sql.0001`, `notifications.0004`);
  5. dare il permesso «Usa il generatore SQL PACS» ai gruppi dei tecnici.
- **[DEC] Dove far girare Ollama in produzione** e con quale modello. Su Poseidon il prototipo usa `qwen2.5-coder:3b`.
- **Dev:** `.env.dev` punta all'Ollama del prototipo (`http://t2s-ollama:11434`). Dopo ogni ricreazione del container `text2sql-worker` va ripetuto `docker network connect text2sql-test_default inventory-app-text2sql-worker-1`.
- ~~**[UI] Verifica nel browser**~~ fatta il 20/11: domanda vera all'Ollama del prototipo (28 s), campanella che si ferma alla risposta, notifica segnata letta, giudizio «Da correggere», Revisione, risposta in vista su telefono.
- ~~**Rimandati dalla revisione**~~ fatti il 20/11: campanella veloce che si ferma alla risposta (`features/text2sql/pending.ts`), `?apri` oltre le prime 50 domande e notifica segnata con `POST /text2sql/{id}/seen/`, notifica tolta cancellando la domanda, righe dell'elenco come pulsanti, risposta portata in vista su telefono; limiti di lunghezza, Redis nel `depends_on`, un solo lavoratore con advisory lock di Postgres, admin solo per il superuser.
- ~~**[BE] Query della Wiki come esempi**~~ fatto il 20/11: tutte le Query in SQL Oracle (`T2S_WIKI_LANGUAGE`, predefinito `sql`; in produzione controllare che la chiave del linguaggio sia questa).

## Ambiente dev e test

- ~~Modulo Wiki spento nel DB dev~~: riacceso il 20/11.
- ~~Test con il Redis dello stack dev~~: fatto il 20/11, `conftest` globale con LocMemCache vuota per ogni test.

## Decisioni del 20/11 (giro di domande)

Ordine di lavoro concordato: fix → verifiche nel browser → rilascio → Contratti fase 2.

- **Generatore SQL PACS**: si rilascia con il **modulo spento** finché non c'è una macchina per Ollama; modello di produzione `qwen2.5-coder:7b`. Prima di accenderlo: **le Query della Wiki come esempi** (`engine.load_examples()`).
- **Fix prima del rilascio, tutti i rimandati della revisione**:
  - Issue per area: fuga in `/api/wiki-links/`, area disattivata via API, assegnatario fuori area / «Assegna a me» / QuickPick «Area», test mancanti e piccole cose;
  - Generatore SQL: robustezza backend, notifiche, accessibilità e mobile.
- **Test**: `conftest` globale con LocMemCache al posto del Redis del dev; togliere quello locale di `text2sql`.
- **DB dev**: riaccendere il modulo Wiki.
- **Verifiche nel browser**: le fa Claude con Playwright (Issue per area, Generatore SQL, Task di area) e manda gli screenshot.
- **Task di area convertito in issue poi cestinata**: permettere la riconversione in una issue nuova; il badge dice che la issue è nel cestino.
- **Contratti**: il PDF si scarica **e si vede** solo con `view_contract_value`. I ritocchi estetici della finestra vanno nella fase 2.
- **Issue, pezzi dell'anteprima**: restano solo Allegati e «Dove intervenire» completo.

## Task di area: verifica nel browser (20/11)

- Fatta: issue collegata nel cestino (avviso, riconversione, «Issue #N nel cestino» in elenco), filtri a 1366 px, apertura con Invio.
- ~~**[UI] Esc nella finestra del task**~~: fatto il 20/11, la finestra si riapriva da `?open=` prima che sparisse dall'URL; ora l'apertura da URL reagisce solo a un id nuovo.
- Dati dev: il task T-4 è collegato alla issue #17 ma è «In attesa», non completato (dato di prova).

## Contratti fase 2 (20/11)

Spec `docs/superpowers/specs/2026-11-20-contracts-renewal-reminders-design.md`, piano `docs/superpowers/plans/2026-11-20-contracts-renewal-reminders.md`, anteprima `design-previews/ctr2-base.html`. Su develop, non rilasciato.

- ~~Promemoria di rinnovo, Impostazioni di Archie, via la disdetta, stato «Chiuso», via il rinnovo automatico~~ fatti il 20/11.
- **Deploy in produzione:** `migrate` (`contracts.0003`, `0004`, `core.0049`, `notifications.0005`), ricreare `cron`, impostare gli indirizzi dell'ufficio in `/impostazioni`, dare «Gestisce le impostazioni di Archie».
- **[DEC] Dev:** l'SMTP del dev è reale e i venditori demo hanno email finte: il cron delle 8 scrive a quegli indirizzi.
- ~~Limite di 200 clienti/device nel modulo~~ risolto il 20/11 in tutta l'app con `fetchAll` (variante A scelta da Fede: si leggono tutte le pagine; la ricerca mentre si scrive servirà solo se si arriva alle migliaia).
- **[UI] Restano per i Contratti:** statistiche e cruscotto (fase 3 della spec di ottobre).

