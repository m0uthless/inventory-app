# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
il versionamento segue [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

### Added

- Contratti, sezione «Valore» (Contratti › Valore, solo con il permesso sui valori): i clienti per valore dei contratti, con interruttore «Attivi oggi / Storico» (lo storico comprende scaduti e chiusi, mai le bozze), quota sul totale e ripartizione per regione ricavata dalla provincia del cliente; un clic su una regione filtra la classifica, uno su un cliente lo apre. Nuovo endpoint `GET /api/contracts/value-by-customer/?scope=active|all`.
- Issue, allegati: screenshot, log e documenti si caricano direttamente nella finestra della issue (anche trascinandoli), fino a 25 MB (PDF, immagini, txt/log/csv, ZIP, docx, xlsx; il contenuto deve corrispondere all'estensione). Si scaricano solo passando dall'API, con i permessi e la visibilità per area della issue; li aggiunge e li toglie chi può modificarla (non a issue chiusa). Ogni aggiunta e rimozione compare nell'attività e nell'Audit. Una issue nata da un task di area eredita gli allegati del task come collegamenti ai file del Drive, con il prefisso «[Task]» e i permessi del Drive. Migrazione `issues.0012`.
- Issue, «Dove intervenire»: il referente del sito (il contatto principale, altrimenti fino a 3 contatti) con «Chiama» ed email; seriale e K-number dell'inventario collegato; le credenziali dell'inventario, visibili per 30 secondi con il permesso Credenziali.
- Contratti, promemoria di rinnovo: per ogni contratto attivo, dalla data dell'avviso di rinnovo (N giorni prima della fine, scelto contratto per contratto: 30, 60, 90, 180 o a mano) parte un'email per preparare e proporre il nuovo contratto, poi una ogni 10 giorni finché il contratto non viene rinnovato (fine spostata in avanti) o chiuso, fino alla scadenza. Un'email a sé per ogni contratto: A il venditore, Cc gli indirizzi dell'ufficio; senza venditore tutto l'ufficio in A; nessun importo. Il venditore utente di Archie la riceve anche nella campanella («Contratto da rinnovare»). Invio alle 8 dal servizio `cron` (`manage.py send_contract_reminders`), senza doppioni; dopo un fermo parte un solo promemoria di recupero. Nella finestra del contratto la sezione «Promemoria di rinnovo» mostra a chi vanno e il calendario con l'esito (inviato, non riuscito, saltato, prossimo, previsto). Migrazioni `contracts.0004`, `notifications.0005`.
- Impostazioni di Archie (menu utente): pannello per le configurazioni dell'applicazione, per il superuser e per chi ha il nuovo permesso «Gestisce le impostazioni di Archie» (`core.manage_app_settings`, migrazione `core.0049`). Prima sezione, Contratti: indirizzi dell'ufficio per i promemoria (separati da «;», controllati), avviso predefinito per i nuovi contratti, ogni quanti giorni ripetere il promemoria, email di prova. Ogni modifica va nell'Audit.

### Changed

- Mappa nel riquadro «Dove» di clienti e siti: nuova mappa nei colori dell'app (chiara e scura col tema), con il segnaposto nel colore principale e «Ingrandisci» per la mappa grande da muovere e ingrandire. Usa MapLibre con OpenFreeMap, senza chiavi; la libreria si carica solo quando si apre una mappa (prima Leaflet da unpkg a ogni apertura).
- Contratti: niente più disdetta. «Preavviso di disdetta» diventa «Avviso di rinnovo» (`notice_days` → `reminder_days`, `notice_deadline` → `reminder_date` nell'API); gli stati di scadenza sono In corso, Da rinnovare, Scaduto (via «Preavviso» e «In scadenza»; filtro `expiry=ok|renew|expired`); la vista «Da gestire» diventa «Da rinnovare». Lo stato «Disdetto» diventa «Chiuso» anche nei dati; tolto il rinnovo automatico (`auto_renew`). Migrazione `contracts.0003`.
- Venditori: senza un utente di Archie collegato l'email è obbligatoria (è quella che riceve i promemoria); l'utente collegato deve essere un utente di Archie attivo.

**Dopo il deploy**: lanciare `migrate`, ricreare `backend_nginx` (nuova regola che blocca `/media/issue_attachments/`) e il servizio `cron` (`up -d --force-recreate cron`), impostare gli indirizzi dell'ufficio in Impostazioni di Archie e dare il permesso «Gestisce le impostazioni di Archie» a chi deve gestirle. I contratti già dentro la finestra dell'avviso ricevono un promemoria alle 8 del giorno dopo il deploy.

### Fixed

- Elenchi tagliati a 200: in circa quaranta punti (scelta di clienti, siti, inventari e device nei moduli, calendario e piani della Manutenzione e PDF dei piani, Rapportini, Drive, Wiki e Query, Contratti, Purchase Order) l'app chiedeva 500 elementi ma il backend ne dà al massimo 200 per pagina, e quelli oltre il duecentesimo sparivano senza avviso. Ora si leggono tutte le pagine (`frontend/src/api/fetchAll.ts`, e `useList` delle schede).

## [1.1.0] - 2026-11-20

### Added
- Purchase Order: «Seguito da», la persona che segue il PO (sollecita il committente, carica i documenti). Si sceglie al volo dalla finestra, con «Lo seguo io» quando non lo segue nessuno, ed è una colonna dell'elenco; si filtra via API con `followed_by`. Nuovo campo `followed_by` (migrazione `purchaseorders.0008`).

- Utenti e gruppi: menu del tasto destro con voci rapide. Sugli utenti: apri, reimposta password (con conferma), aggiungi a un gruppo, copia email o username, vedi l'attività nell'Audit, disattiva o riattiva, elimina. Sui gruppi: apri, duplica con gli stessi permessi, copia i nomi dei membri, elimina. Le voci di modifica seguono le regole della finestra utente (account amministratori riservati ai superuser, il proprio account non si disattiva né si elimina).

- Issue per area: la issue può avere un'area (facoltativa; la nuova issue parte con l'area del proprio profilo, migrazione `issues.0010`). Le issue senza area restano modificabili da tutti come prima; quelle con un'area le vedono tutti ma le modificano solo i membri dell'area (anche stato, commenti, Wiki, eliminazione e ripristino), e per gli altri la finestra si apre in sola lettura. L'assegnatario di una issue con area è un membro di quell'area; cambiando area un assegnatario esterno si svuota con un avviso. Nell'elenco la colonna e il filtro «Area» e la vista «La mia area»; il contatore delle issue in barra laterale conta la propria area più le issue senza area. Trasformando un task di area in issue, la issue prende l'area del task.

- Issue, visibilità per area: chi non ha il nuovo permesso «Vede le issue di tutte le aree» (`issues.view_all_areas`, migrazione `issues.0011`) vede solo le issue della propria area e quelle senza area, ovunque: elenco, dettaglio, numeri, issue aperte di clienti e siti, segnale di issue attiva sugli inventari, titoli nei collegamenti Wiki. Chi ha il permesso (e il superuser) sceglie l'area dal selettore accanto al titolo della pagina Issue, come nei Task di area: una singola area, «Senza area» o «Tutte»; si parte dalla propria area se c'è, altrimenti da tutte, e la scelta resta ricordata; i numeri in testa seguono il selettore. Chi non ha un'area nel profilo vede tutto. Il cambio d'area di una issue si registra nell'Audit e nell'attività. Nei Dettagli della issue l'area si cambia al volo, anche da telefono; un assegnatario fuori dalla nuova area si toglie con un avviso. **Dopo il deploy**: dare il permesso ai gruppi che devono vedere tutte le aree.

- Generatore SQL PACS (Conoscenza › Generatore SQL): il tecnico scrive una domanda in italiano e riceve la query Oracle per il PACS Philips Vue da copiare (Archie non la esegue mai), con il tipo (lettura, scrittura, impossibile) e gli avvisi. Le domande vanno in coda e le elabora il nuovo servizio `text2sql-worker`, che chiama Ollama fuori da Archie; a risposta pronta arriva la notifica «Query SQL pronta». Il tecnico giudica la risposta («Corretta» / «Da correggere» con query corretta e nota) e il superuser la rivede in «Revisione», con «Copia come esempio» per `text2sql/knowledge/esempi_query.md`. Permesso «Usa il generatore SQL PACS», modulo spegnibile dalla pagina Moduli. Oltre agli esempi del file, il generatore usa come esempi tutte le Query della Wiki in SQL Oracle (linguaggio scelto con `T2S_WIKI_LANGUAGE`, predefinito `sql`). Migrazioni `text2sql.0001` e `notifications.0004`. **Dopo il deploy**: lanciare `migrate` e spegnere il modulo dalla pagina Moduli finché non c'è una macchina con Ollama (il servizio `text2sql-worker` parte comunque e a modulo spento resta in attesa). Per accenderlo: installare Ollama con il modello `qwen2.5-coder:7b`, impostare `OLLAMA_URL` in `.env.prod`, riavviare `text2sql-worker`, dare il permesso ai gruppi dei tecnici e riaccendere il modulo.

### Changed

- Clienti: il cliente si apre nella finestra larga al posto della scheda laterale, senza schede interne. Testata snella con codice, ragione sociale, città e P.IVA e i conteggi (siti, inventari, issue aperte, contratti, in arancio se uno scade a breve) che portano alla sezione; al centro issue aperte, siti, inventari con il filtro per tipo, device, contratti e documenti; a lato anagrafica, referenti con chiamata ed email, accesso remoto, mappa, note e ultime modifiche. Anagrafica e note si salvano insieme dalla barra «N modifiche da salvare», inviando solo i campi cambiati. Nell'elenco il clic seleziona la riga e il doppio clic (o Invio) apre il cliente; su telefono il tocco apre. Lo stesso vale ora per utenti e schede dei gruppi. La finestra compare già completa, senza finestra di attesa né spinner, e con ‹ › resta aperta cambiando solo il contenuto.
- Siti: il sito si apre nella finestra larga come il cliente, al posto della scheda laterale a schede. Nel sottotitolo il cliente (cliccabile) e l'indirizzo; conteggi di inventari, issue aperte e contatti; al centro issue aperte, inventari con il filtro per tipo e contatti del sito; a lato anagrafica (nome, nome breve, cliente, stato, indirizzo, CAP, città, provincia), mappa, note e ultime modifiche, salvate insieme inviando solo i campi cambiati. Clic per selezionare, doppio clic o Invio per aprire.
- Contatti: il contatto si apre nella finestra larga come cliente e sito. Testata con le iniziali, reparto, cliente e sito cliccabili, Chiama e Scrivi; al centro recapiti con copia, dove lavora (cliente e sito) e gli altri contatti dello stesso sito, che si aprono nella stessa finestra; a lato anagrafica (nome, reparto, telefono, email, sito, contatto primario), note e ultime modifiche, salvate insieme inviando solo i campi cambiati. Clic per selezionare, doppio clic o Invio per aprire.
- Clienti, siti e contatti si aprono uno sopra l'altro nella stessa finestra: dal cliente un suo sito, dal sito un contatto, con il percorso «‹ Cliente / Sito» in testata per tornare indietro senza ricaricare. Riaprire un record già nel percorso torna a quello; le modifiche in sospeso vanno salvate o annullate prima di cambiare record.
- Inventari: l'inventario si apre nella finestra larga (anche dal Site Repository e dalle finestre di cliente e sito, nella stessa finestra). Al centro l'accesso (hostname e IP con copia, credenziali con mostra per 30 secondi e copia, spazio a destra per il logo dell'applicazione), le issue aperte con tutto lo storico delle chiuse, manutenzione e monitor; a lato identità con la targa K-Number, dove si trova, note e attività. I dati si leggono come testo: «Modifica» nel ⋯ (con il permesso di scrittura) li trasforma in campi, credenziali comprese (le password solo con il permesso Credenziali), con un solo salvataggio dei campi cambiati. Tag e campi personalizzati restano nel modulo completo. Clic per selezionare la riga, doppio clic o Invio per aprire.
- Clienti, siti e contatti come l'inventario: i dati della finestra si leggono come testo, senza riquadri; «Modifica» nel ⋯ (con il permesso di scrittura) li trasforma tutti in campi, con la barra «In modifica» e un solo salvataggio. I campi che la finestra non tocca (città e indirizzo del cliente, campi personalizzati, cliente di sito e contatto) restano in «Tutti i campi…» nel ⋯.
- Issue: la issue si apre nella finestra larga al posto della scheda laterale a schede. Testata con stato, cliente, sito e inventario cliccabili, priorità, assegnatario, scadenza e commenti; «Segna come risolta» o «Riapri». Al centro prossimo passo e procedura Wiki, descrizione e attività (commenti e modifiche) con il commento in fondo; a lato dettagli, tempo dall'apertura e dove intervenire. Stato, priorità e assegnatario si cambiano al volo con un clic; il resto (titolo, descrizione, scadenza, categoria, ServiceNow, sito, cliente) da «Modifica» nel ⋯. «Assegna a me» sta accanto all'assegnatario. Clic per selezionare la riga, doppio clic o Invio per aprire.
- In tutte le finestre dei record la posizione e le frecce ‹ › stanno sempre all'estremità destra della testata, dopo i pulsanti: restano nello stesso punto passando da un record all'altro e in modifica restano lì, spente.
- Task di area: il task si apre nella finestra larga al posto della scheda laterale a schede, sullo schema della issue. L'azione principale segue il ciclo (Inizia, Completa, Riprendi, Riapri); stato, priorità e assegnatario si cambiano al volo, con «Assegna a me» accanto; descrizione, allegati da Drive e attività (commenti e modifiche insieme) in una sola pagina; «Trasforma in issue» a lato. Titolo, descrizione e scadenza da «Modifica» nel ⋯; sola lettura per chi non è dell'area. Clic per selezionare la riga, doppio clic o Invio per aprire.
- Contratti: il contratto si apre nella finestra larga al posto della scheda laterale a schede. Testata con codice, titolo, stato di scadenza, cliente cliccabile, fine, termine di disdetta, valore e «Rinnova…»; al centro periodo con disdetta e oggi, importo (al mese, all'anno, per fattura), device e note; a lato dettagli, PDF del contratto e attività. «Segna come disdetto» nel ⋯; i dati si leggono come testo e «Modifica» li rende campi, con un solo salvataggio. Importi e PDF restano visibili solo con il permesso sui valori. Clic per selezionare la riga, doppio clic o Invio per aprire.
- Purchase Order: il PO si apre nella finestra larga al posto della scheda laterale a schede. L'azione principale fa avanzare il flusso (Segna come inviato, Registra PO ricevuto, Registra fattura), «Torna a…» è nel ⋯; al centro il flusso a quattro passi con il PDF di ogni passo, l'importo con costi e margine, i documenti per tipo e le note; a lato dettagli, tempo e attività. I dati si leggono come testo e «Modifica» li rende campi; descrizione e importo restano modificabili solo in «Inserito». Clic per selezionare la riga, doppio clic o Invio per aprire.
- Manutenzione: scadenza, piano e rapportino si aprono nella finestra larga al posto delle schede laterali a schede. Scadenza: «Registra rapportino», stato della scadenza, interventi fatti sull'inventario, piano e inventario a lato. Piano: «Report PDF», avanzamento del ciclo, inventari coperti con il loro stato, storico dei rapportini, programmazione, note e attività. Rapportino: esito con le note, PDF firmato in anteprima, «Apri issue» o «Carica il PDF» come azione principale quando servono. Clic per selezionare la riga, doppio clic o Invio per aprire.
- Audit: l'evento si apre nella finestra larga, in sola lettura, al posto della scheda laterale a schede. Testata con oggetto, azione, chi e da dove (rete interna o IP esterno in arancio); «Apri l'oggetto» o «Apri il Cestino» come azione principale; avvisi per accessi falliti ed eliminazioni, tabella «Cosa è cambiato» e storico dell'oggetto nella stessa pagina; dettagli tecnici richiudibili. Clic per selezionare la riga, doppio clic o Invio per aprire.
- Drive: la scheda flottante del file o della cartella diventa un pannello fisso a destra dell'elenco, accanto alle cartelle e ai clienti. Il clic su un file o una cartella lo mostra nel pannello; doppio clic o Invio entra nella cartella o apre il file a tutto schermo. La × nasconde il pannello (scelta ricordata) e «Mostra i dettagli» lo riporta; sotto i 1500 px il pannello si apre sopra l'elenco, su mobile a tutto schermo. Rinomina, Sposta e Cestino passano nel menu ⋯.
- ServiceNow, Monitor, Piano ferie: il caso, il monitor e la richiesta si aprono nella finestra larga al posto della scheda laterale. Caso: «Apri in ServiceNow» come azione principale, descrizione e screenshot al centro, «Modifica» dal ⋯ apre il dialogo del caso. Monitor: «Apri la workstation», stato cambiato sul posto, dati che «Modifica» dal ⋯ trasforma in campi con un solo salvataggio (workstation compresa). Richiesta del Piano ferie: «Valida» / «Rifiuta» (o «Ritira la richiesta») in testata, copertura dell'area giorno per giorno. Clic per selezionare la riga, doppio clic o Invio per aprire.
- Bug e feature: la segnalazione si apre nella finestra larga al posto della scheda laterale, con «Segna come risolta» / «Rifiuta» (o «Riapri») in testata e ‹ › che scorrono la colonna della bacheca; clic per selezionare la scheda, doppio clic o Invio per aprirla (su mobile il tocco apre).
- Profilo: una pagina sola nella finestra al posto delle cinque schede: foto cambiabile dall'avatar in testata, dati personali in lettura con «Modifica i dati» e un solo salvataggio, aspetto, sicurezza (la password si cambia da «Cambia la password»), permessi, gruppi e attività recente.

- Utenti e gruppi e Accesso Portal: l'utente si apre in una finestra larga e centrata sopra l'elenco al posto della scheda laterale. Testata con identità, «Reimposta password» e scorrimento tra gli utenti; al centro gruppi, permessi come matrice (una riga per modulo, colonne Nessuno, Lettura, Scrittura, Completo, con l'origine di ogni livello), permessi speciali e Portal; a lato anagrafica (nome e cognome, email da copiare, data di nascita con il prossimo compleanno, genere, area ferie con il suo coordinatore), ruoli, attività recente e account. Niente più schede interne né salvataggi per sezione: una barra «N modifiche da salvare» salva tutto insieme e chiede conferma se esci con modifiche in sospeso.
- Utenti e gruppi: anche il gruppo si apre nella stessa finestra. Testata con riepilogo e la striscia dei livelli, scorrimento tra i gruppi e «Duplica»; al centro la matrice dei permessi con la colonna «Eccezioni» (i membri che hanno già di più a mano), permessi speciali e Portal; a lato i membri, che ora si aggiungono e si tolgono direttamente dal gruppo, e nome, duplica ed elimina. La barra di salvataggio dice anche su quante persone ricade la modifica. Le API dei gruppi accettano `user_ids` con le stesse regole della modifica utente (account amministratori solo dal superuser, nessun utente Philips nei gruppi).
- Tecnici ServiceNow e assegnatari delle issue si decidono dai gruppi: due permessi distinti, «È tecnico ServiceNow» (`servicenow.be_technician`) e «Può essere assegnatario delle issue» (`issues.be_assignee`), al posto dell'interruttore «Tecnico ServiceNow» sul profilo utente, che sparisce (migrazioni `servicenow.0012`, `issues.0009`, `core.0048`). Il superuser non è tecnico né assegnatario se non sta in un gruppo con il permesso. L'email «nuova issue» va agli assegnatari delle issue. **Dopo il deploy**: lanciare le migrazioni e dare i due permessi ai gruppi giusti dalla pagina Gruppi; finché non lo si fa nessuno è assegnabile ai case né alle issue e l'email «nuova issue» non parte. In Utenti il ruolo Philips non si mostra più (filtro solo d'interfaccia, i profili restano).

### Fixed

- Issue: l'API rifiuta un'area disattivata o nel cestino (le issue che ci stanno già restano modificabili); la modifica carica la issue una volta sola.
- Issue, assegnatario: chi è assegnato ma sta fuori dall'area, o ha perso il permesso, resta visibile e selezionato nel selettore «Assegnata a» invece di lasciarlo vuoto; cambiando area si tiene l'assegnatario che fa parte della nuova area anche senza il permesso (come controlla il backend); «Assegna a me» compare solo a chi è assegnabile nell'area della issue.
- Task di area: se la issue in cui era stato trasformato finisce nel cestino, il task lo dice («La issue #N è nel cestino») e si può trasformare di nuovo in una issue nuova; prima restava un collegamento morto e la conversione rispondeva 409. Nuovo campo `converted_to_issue_deleted`.
- Generatore SQL: la campanella torna al ritmo normale appena arriva la risposta, invece di controllare ogni 15 secondi per 20 minuti; aprendo una domanda dalla notifica oltre le prime 50 la si carica e si segna letta la sua notifica, non quella della prima domanda (nuova azione `POST /api/text2sql/{id}/seen/`); cancellare una domanda (anche con «Riprova») toglie la sua notifica; le righe dell'elenco sono annunciate come pulsanti; su telefono scegliere una domanda porta in vista la risposta.
- Generatore SQL, lavoratore: un solo `text2sql-worker` alla volta elabora la coda (lock di Postgres); un secondo resta in attesa e subentra se il primo cade, invece di rimettere in coda le domande in corso dell'altro. Il servizio aspetta anche Redis all'avvio. Query corretta e nota del giudizio hanno un limite di lunghezza (20.000 e 2.000 caratteri).
- Task di area: aperta la finestra con Invio (o doppio clic) dall'elenco, il primo Esc non la chiudeva: la finestra si riapriva subito dall'indirizzo `?open=`, ancora presente per un attimo.
- Messaggi d'errore: «No … matches the given query.» (un record inesistente o non visibile, es. il link a una issue di un'altra area) diventa «Elemento non trovato o non visibile.», in Archie e nel Portal.
- Test: la suite usa una cache locale e vuota per ogni test invece del Redis dello stack dev, che faceva fallire a caso i test dei moduli spenti.

### Security

- Wiki: `/api/wiki-links/` non elenca più i collegamenti a issue di un'altra area (id e note dicevano che la issue esiste e di cosa parla), e il dettaglio e il ripristino rispondono 404; senza utente l'etichetta di un collegamento a una issue non mostra il titolo. Nei task di area il titolo della issue convertita non si legge se la issue è di un'altra area.
- Generatore SQL: nell'admin Django le domande (che possono contenere nomi di pazienti) le vede solo il superuser, qualunque permesso abbia lo staff.

## [1.0.0] - 2026-11-16

### Added

- Moduli (menu utente, solo superuser): accendere e spegnere i moduli di Archie per tutti. Si possono spegnere Issue, Task di area, Manutenzione, ServiceNow, Monitor, Wiki, Drive, Contratti, Purchase Order, Rimborso spese, Piano ferie e Bug e feature. Un modulo spento sparisce per chi non è superuser: le sue API rispondono 404, la pagina porta alla 404, spariscono voce di menu, widget e contatori della Dashboard, risultati della ricerca, notifiche e pulsanti che lo raggiungono da altre pagine, e i job del cron (notifiche di scadenza, riepilogo giornaliero, chiusura automatica delle issue) lo saltano. I dati restano. Il superuser continua a vederlo, con l'etichetta «spento» nel menu e sui widget della Dashboard e un banner nella pagina, per provarlo prima del rilascio. Con il Piano ferie spento restano attive le assenze dei tecnici ServiceNow e le aree degli utenti. Ogni accensione e spegnimento, con il motivo, finisce nell'Audit. Migrazione `core 0046`.
- Modalità manutenzione (pagina Moduli, solo superuser): chiude Archie a chi non è superuser. Il login viene rifiutato con il messaggio scelto (o «Archie è in manutenzione. Riprova più tardi.»), la pagina di login mostra l'avviso «Sistema in manutenzione» e chi è già collegato viene fatto uscire alla prima azione. Il Portal clienti resta aperto. Il superuser vede una fascia in alto finché la manutenzione è attiva. Attivazione e disattivazione finiscono nell'Audit. Migrazione `core 0047`.

### Changed

- Nuova interfaccia «Campo sterile» per tutto Archie: colori acciaio e verde chirurgico, carattere Geist, modalità chiara e scura e tre palette (Verde, Blu clinico, Indaco). Barra laterale con le voci raggruppate per lavoro (Operatività, Anagrafiche, Conoscenza, Amministrazione, Sistema) e comprimibile, ricerca globale con Ctrl K, footer sempre visibile. Le pagine elenco hanno indicatori in testa, viste salvate, filtri dalle intestazioni delle colonne e una scheda di dettaglio flottante sopra la tabella; inserimento rapido (titolo, descrizione e campi a pillola, Ctrl+Invio) per issue, task di area, clienti, siti, inventari e contatti. Rifatte anche Dashboard (fascia «Aurora» e widget nei colori dell'app), login, Wiki (archivio per categoria), Drive (esplora file), Manutenzione (scadenze in elenco o calendario), ServiceNow (casi e Dashboard casi al posto di Statistiche e Assenze), Piano ferie, Rimborso spese, Contratti, Purchase Order, Audit, Cestino, Bug e feature, Utenti e gruppi, Profilo, Ricerca e pagina 404.
- Nuovo logo di Archie (schedario + scritta "archie" a tratto unico) al posto del segnaposto, nella barra laterale e nella login. È disegnato inline dal componente `ui/ArchieLogo.tsx` e quindi segue il tema e la modalità chiara/scura. Aggiornati anche `public/logo.svg` e il favicon.
- Email rifatte nello stile «Bollettino» (anteprima `design-previews/em-base.html`): header con il logo e la data, linguetta con la categoria nel colore del modulo (Issue, ServiceNow, Task di area, Piano ferie, Bug e feature, Scadenze, Account), una riga per giorno con il riquadro della data, pulsanti che aprono direttamente la issue, il task, il case o la segnalazione in Archie, footer sottile. Tolta la mascotte; il logo parte come immagine inline. La versione solo testo non contiene più il CSS e riporta l'indirizzo dei pulsanti. Nuova impostazione `ARCHIE_PUBLIC_URL` (predefinita `https://archie.biotron.it`) per i link delle email.

### Security

- Utenti e gruppi: un amministratore con il solo permesso `core.manage_users` non può più modificare, disattivare, eliminare o reimpostare la password e i permessi di un account superuser o staff (403). Prima poteva resettare la password del superuser, riceverla in risposta ed entrare al suo posto. Nella scheda utente le azioni su questi account sono disabilitate per chi non è superuser.
- Accesso ad Archie: il permesso `core.access_archie` ora è verificato al login anche quando la pagina non indica l'ambito, e la barriera Portal/Archie lo richiede per ogni sessione interna. Prima un utente senza alcun permesso otteneva una sessione valida e leggeva via API issue, wiki, case ServiceNow, PO, manutenzione e l'elenco utenti. La pagina di login di Archie invia sempre l'ambito.
- Cestino: le azioni di ripristino ed eliminazione definitiva (`restore`, `bulk_restore`, `purge`) applicano ora la barriera Portal/Archie. Prima un utente con doppio profilo, collegato dal Portal, poteva ripristinare record dei moduli interni pur vedendosi negata la lista.
- File caricati: le anteprime (`preview`) di allegati wiki, Drive, rapportini, contratti, PO, spese, segnalazioni e ServiceNow aprono nel browser solo PDF, immagini PNG/JPEG/GIF/WebP e testo semplice, con il tipo ricavato dall'estensione e mai da quello dichiarato dal client; ogni altro file viene scaricato. nginx aggiunge `nosniff` e una CSP `sandbox` (esclusi i PDF) ai file serviti. Gli allegati wiki `.html`, `.svg`, `.xml` e simili vengono rifiutati. Prima un allegato HTML veniva eseguito aprendone l'anteprima.
- Audit: la password del certificato Wi-Fi (`pass_certificato`) non viene più registrata in chiaro nelle modifiche dei device, e nessun valore cifrato (`enc::…`) finisce più nell'audit. Per ripulire lo storico: `manage.py sanitize_audit_history --dry-run`, poi senza `--dry-run`.
- Bacheca e Changelog: creare, modificare ed eliminare comunicazioni e voci di changelog richiede ora il permesso `core.change_announcement` / `core.change_changelogentry` (i superuser restano abilitati). Prima bastava l'accesso ad Archie, e qualunque utente poteva scrivere via API. I pulsanti della UI seguono lo stesso permesso.
- API: rimossa l'autenticazione HTTP Basic, attiva di default in DRF ma non usata da nessun client. Permetteva di provare credenziali aggirando il rate limit del login.
- Cestino: il campo `deleted_at` non è più modificabile con POST/PUT/PATCH su clienti, siti, contatti, inventari, manutenzione, wiki, Drive, device, RIS/PACS e campi custom. Prima un PATCH cestinava un record senza il permesso di eliminazione, o lo ripristinava aggirando il blocco padre/figlio. Cestino e ripristino passano solo dalle azioni dedicate.

### Fixed

- ServiceNow: il flag "Tecnico ServiceNow" ora nasce disattivato per i nuovi utenti. La migrazione `core 0045` lo toglie a chi non ha un profilo interno (né accesso ad Archie, né tecnico Philips, né account funzionale), stampando l'elenco degli utenti modificati. Assegnazione di case e issue, elenchi dei tecnici, Triage, assenze tecnici ed email "nuova issue" considerano solo i tecnici interni: prima i clienti del Portal risultavano assegnabili e ricevevano le email delle nuove issue.
- Contratti: il caricamento del PDF falliva con errore 500 quando la cartella `media/contracts` era stata creata da un comando lanciato come root. All'avvio, il backend riallinea ora al proprio utente ogni file o cartella di `media/` che non gli appartiene, non solo la cartella principale; un errore di scrittura dei file restituisce un messaggio leggibile e finisce nel log. I test non scrivono più nel volume media reale.
- Rimborso spese: chi non ha permessi `expenses.*` espliciti può ora compilare la propria nota (voci, tragitti, scontrini); prima creava la nota ma tutto il resto rispondeva 403. Vale la proprietà della nota, come per la nota stessa: le note altrui e quelle non più modificabili restano protette, eliminazioni comprese.
- Portal, "Wi-Fi rapido" del device: il salvataggio usava l'id del device come id del Wi-Fi e non aggiornava nulla (404, poi 400). Ora aggiorna il Wi-Fi esistente o lo crea se manca.
- Login di Archie in dev: il link "Portale clienti" portava al Portal di produzione, perché la build leggeva sempre `.env.production`. In dev ora apre il Portal sullo stesso host della pagina (porta 8081); in produzione non cambia nulla.
- Sessione scaduta: l'API risponde ora 401 invece di 403 e l'app torna al login. Prima restava aperta con liste vuote e il messaggio "Non autorizzato".

## [0.10.0] - 2026-11-04

### Added

- Nuovo modulo Contratti: pagina `/contracts` con elenco (colonne tutte spostabili, filtri per stato e anno), colonna Società (stesse voci dello Stato dei clienti, proposta dal cliente del contratto), drawer di dettaglio e creazione/modifica dei contratti dei clienti, con indicatore di scadenza (preavviso, in scadenza, scaduto) e allegato PDF. Il PDF è servito solo tramite API (l'accesso diretto a `/media/contracts/` è bloccato da nginx) e il modulo non è accessibile dal Portal.
- Contratti: i valori economici e il PDF del contratto (che riporta il prezzo) sono visibili solo a chi ha il permesso `contracts.view_contract_value` e non compaiono mai nel registro di audit (le modifiche restano tracciate con valore mascherato).
- Contratti: il pulsante "Rinnova" crea il rinnovo manuale del contratto; l'opzione di rinnovo automatico è solo informativa e non genera rinnovi.
- Nuova anagrafica venditori (`/api/sellers/`): un venditore può essere un utente interno o un referente esterno ed è selezionabile nei contratti.
- Contratti: nel form del contratto si possono collegare i device del cliente; nel drawer del Cliente è disponibile la nuova tab "Contratti".
- I dati base dei Device sono ora gestibili anche da Archie, con la nuova tab "Device" nel drawer del Cliente; i device creati sono visibili anche nel Portal del cliente.
- Clienti: nuovi filtri sulle colonne per vendor, provincia, presenza della VPN e del contatto primario (API: `has_vpn`, `has_contact`), salvati nell'URL. Con nessun risultato la lista propone "Cancella ricerca" e "Azzera filtri".

### Changed

- Clienti: la colonna "Stato" si chiama ora "Vendor" (il lookup contiene il vendor) ed è testo neutro. Su mobile le card hanno pulsanti diretti per chiamare, scrivere e aprire la VPN; nel drawer il telefono del contatto primario si chiama o si copia con un tocco e le etichette dei campi personalizzati sono leggibili.
- Drawer: le tab scorrono quando non entrano nella larghezza (es. Cliente) e il testo dell'intestazione ha più contrasto. Le liste senza righe non mostrano più il paginatore.
- Mappe: le tile ora arrivano da OpenStreetMap (con attribuzione), perché il provider precedente (CARTO) richiede una API key e mostrava "API KEY REQUIRED" al posto della mappa.
- ServiceNow: la categoria Philips è temporaneamente nascosta nel pannello Triage, nelle Statistiche e nella pagina Assenze tecnici, che ora mostrano solo Biotron. Il filtro è solo lato frontend (`features/servicenow/visibleCategories.ts`): backend, case e utenti Philips restano invariati.
- Site Repository: elenco asset riordinato per l'uso in campo (prima nome, hostname, IP e K#, poi stato), colonne facoltative nascoste quando sono vuote in tutte le righe e testo cercato evidenziato nei risultati. Su telefono la barra va a capo senza coprire l'elenco, gli asset diventano card e la cartina si apre a schermo intero. Quando la ricerca non trova nulla, la pagina spiega dove cerca e propone "Cancella ricerca"; etichette e intestazioni hanno più contrasto.

### Fixed

- Liste: le colonne con filtro (imbuto nell'intestazione) non si potevano trascinare per cambiarne l'ordine; ora si spostano come le altre.
- Piano Ferie: la validazione e il rifiuto di una singola richiesta di assenza ora vengono registrati nel registro di audit, come già avveniva per le richieste di gruppo. In entrambi i casi l'evento riporta anche il cambio di stato.
- Issue: la riassegnazione di una issue ora compare nel registro di audit con il vecchio e il nuovo assegnatario. Prima l'email di riassegnazione partiva, ma l'evento di audit non indicava cosa fosse cambiato.
- Site Repository: il contatore "siti" di ogni cliente contava anche i siti senza asset; ora conta solo i siti con almeno un asset non eliminato.

## [0.9.4] - 2026-10-25

### Added
- I task di area inviano ora email: all'assegnazione o riassegnazione a chi diventa assegnatario e a chi non lo è più, e a ogni nuovo commento all'assegnatario e a chi ha creato il task (mai a chi ha scritto il commento o compiuto l'azione).
- Il Piano Ferie invia ora email: quando un dipendente invia una richiesta di ferie i coordinatori (e i superuser) ricevono un'email di notifica; quando la richiesta viene validata o rifiutata il dipendente ne riceve l'esito via email. Un'unica email per richiesta, anche se copre più giorni.
- Il modulo Bug & Feature invia ora email: alla nuova segnalazione a chi può gestirla, e a ogni cambio di stato (risolta/rifiutata/riaperta) al segnalatore, con la motivazione in caso di rifiuto.
- I task di area hanno ora un assegnatario (scelto tra gli utenti della stessa area), una priorità (bassa, media, alta, critica), un nuovo stato "In attesa", commenti e allegati collegati da Drive. Gli allegati mostrano solo i file a cui l'utente ha accesso, con le stesse regole di Drive.
- I task di area eliminati si possono ora ripristinare (singolarmente o in blocco) e l'elenco supporta filtri per stato, priorità, assegnatario, area e scadenza, oltre a ricerca e ordinamento.
- Il widget "Task di area" della dashboard apre ora un drawer di dettaglio con commenti e allegati collegati da Drive, e un dialog di modifica con assegnatario (utenti della stessa area), priorità, stato "In attesa" e scadenza. Ogni riga mostra priorità alta/critica, assegnatario, commenti e allegati.
- L'elenco utenti può essere filtrato per area (`/api/users/?leave_area=`) e riporta l'area di ciascun utente.
- Nuova pagina "Task" (`/tasks`) con l'elenco dei task di area: ricerca, filtri per area, priorità, "assegnati a me" e stato (aperti, completati, tutti), creazione di un nuovo task con assegnatario e scadenza e apertura del dettaglio con commenti e allegati Drive. Nel widget della dashboard è disponibile il link "Vedi tutti".
- I task di area hanno ora un menu contestuale (apri, modifica, commenta, cambia stato, trasforma in issue, elimina) dall'elenco `/tasks`.
- La sidebar mostra ora il numero dei propri task di area aperti, come già per le issue.
- Un task di area può essere trasformato in una issue (titolo, descrizione, priorità e commenti vengono portati nella nuova issue; il task risultante si completa e resta collegato alla issue creata).
- Diversi pulsanti a sola icona (ServiceNow, Bug & Feature, Rimborso spese, Dashboard, Ricerca) hanno ora una descrizione per chi usa uno screen reader; gli indicatori del carosello nella Dashboard sono ora utilizzabili anche da tastiera.

### Changed
- L'elenco dei task di area carica gli allegati Drive con un numero di query costante, indipendente dal numero di task.

### Fixed
- allega le immagini inline (cid:) referenziate dai template email
- Drive: lo spostamento in blocco di più file/cartelle selezionati è ora bloccato con un avviso, invece di spostare in silenzio solo il primo elemento della selezione.
- Wiki: la bozza di una pagina nuova non viene più sovrascritta se si apre un'altra pagina nuova in una scheda diversa del browser.
- Rimborso spese: quando un suggerimento automatico sull'importo non viene applicato a una riga a km (calcolato automaticamente), ora viene mostrato un messaggio invece di ignorarlo in silenzio.
- Piani di manutenzione: la data di scadenza mostrata quando è lontana nel tempo ha ora lo stesso formato ovunque (prima in alcuni casi era mostrata in formato non italiano).
- Rimossi un filtro e alcuni controlli di selezione multipla rimasti senza alcun effetto visibile nelle pagine Issue, Clienti, Siti e Inventari (il ripristino multiplo da cestino resta disponibile dalla pagina Cestino).

## [0.9.3] - 2026-09-09

## [0.9.2] - 2026-09-09

### Changed
- L'indirizzo mittente di default delle email è ora `noreply@biotron.it` (era `archie@biotron.it`).

### Added
- Le email inviate dall'applicazione (a partire dal reset password amministrativo) usano ora un layout HTML brandizzato (Archie o Portal a seconda del contesto), con testo alternativo in chiaro generato automaticamente.
- Il job periodico delle notifiche (manutenzioni e task di area in scadenza) invia ora anche un'email digest agli utenti con indirizzo email valorizzato, oltre alla notifica in-app. Un'unica email per utente per ciclo, inviata solo su notifiche nuove o con scadenza cambiata rispetto all'ultima email già inviata (nessun invio ripetuto sulla stessa scadenza a ogni refresh).
- Il modulo Issue invia ora email: alla creazione di una nuova issue a tutti i tecnici assegnabili, e su ogni cambio di assegnatario ai due utenti coinvolti (vecchio e nuovo). Nessuna email sulla disassegnazione (assegnatario svuotato senza un nuovo assegnatario).
- Alla creazione di un nuovo case ServiceNow già assegnato, l'assegnatario riceve ora anche un'email (oltre alla notifica Teams esistente, che resta invariata). Nessuna email per i case Philips quando la modalità di notifica è impostata su "modal" (stessa esclusione già in vigore per Teams).
- Nuova email giornaliera (alle 8:00) con le scadenze nei prossimi 3 giorni: task della propria area e issue assegnate, in un'unica digest per utente. Nessuna email per chi non ha scadenze imminenti.

## [0.9.1] - 2026-08-21

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
