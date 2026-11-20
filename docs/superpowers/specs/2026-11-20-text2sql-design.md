# Generatore SQL PACS in Archie

Data: 2026-11-20. Stato: approvato da Fede in chat (2026-11-20), con il giudizio delle risposte.

## Perché

Su Poseidon c'è un prototipo, `/home/fede/text2sql-test`, che trasforma una domanda in italiano in una query Oracle per il PACS Philips Vue. Usa un modello locale con Ollama e una conoscenza scritta a mano: `schema.md` e `esempi_query.md`. Fede vuole portarlo in Archie, sotto **Conoscenza**, come strumento per i tecnici: serve a scrivere più in fretta le query da lanciare a mano sul PACS dei clienti. L'accesso si dà con un permesso di gruppo o utente.

Il modulo `pacs_sql` era **in pausa** nel CLAUDE.md. Fede lo ha sbloccato il 2026-11-20: la riga del CLAUDE.md va aggiornata.

## Obiettivi

- Pagina sotto Conoscenza: il tecnico scrive la domanda e riceve la query da copiare, con il tipo (lettura, scrittura, impossibile) e gli avvisi.
- Nessun blocco di Archie: una risposta richiede circa un minuto sulla CPU, senza GPU.
- Notifica in-app quando la risposta è pronta, anche se il tecnico è passato ad altro.
- Storico delle proprie domande, con la possibilità di riaprire una query già generata.
- Giudizio del tecnico su ogni risposta (corretta / da correggere, con query corretta e nota) e revisione da parte di Fede, per migliorare esempi e schema.

## Non obiettivi

- **Eseguire** le query. Archie non si collega mai al PACS e la query si lancia a mano, come oggi.
- Modificare schema ed esempi dall'interfaccia. Li mantiene solo Fede, nel repository.
- Usare le Query della Wiki come esempi aggiuntivi. Fede lo vuole **in futuro**: il design lascia l'aggancio (vedi «Fonti degli esempi») ma non lo implementa.

## Approcci considerati

- **A · Coda con un lavoratore dedicato** (scelto da Fede). La domanda va in una tabella; un processo a parte, con la stessa immagine del backend come il `cron`, la elabora e salva la query; la pagina controlla lo stato ogni pochi secondi.
- B · Thread nel backend: più semplice, ma la domanda in corso si perde se il backend si riavvia.
- C · Richiesta che aspetta il minuto intero: tiene occupato uno dei 4 processi del backend (timeout 120 s) e rallenta Archie per tutti. Scartata.

## Decisioni

### Ollama fuori da Archie

- Ollama **non** entra nel `docker-compose` di Archie. Gira sul server, installato fuori da Docker, oppure su un'altra VM della rete, e Archie lo raggiunge all'indirizzo `OLLAMA_URL`.
- Variabili, da documentare in `.env.example`:
  - `OLLAMA_URL`;
  - `T2S_MODEL`, default `qwen2.5-coder:7b`;
  - `T2S_NUM_CTX`, default 16384;
  - `T2S_TIMEOUT`, default 900 s;
  - `T2S_ORACLE_VERSION`, default 12;
  - `T2S_NUM_ESEMPI`, default 6;
  - `T2S_MAX_SCHEMA_TOKENS`, default 10000.
- Senza `OLLAMA_URL` il modulo risponde con un errore chiaro («generatore non configurato») invece di mettere in coda domande che non partiranno mai.

### Backend: nuova app `text2sql`

- **Logica del prototipo portata dentro Archie** in `backend/text2sql/engine.py`: regole, divisione e selezione delle sezioni dello schema, scelta degli esempi, costruzione del prompt, chiamata a Ollama, controlli sulla risposta (tipo READ/WRITE/IMPOSSIBILE e avvisi). Il comportamento resta quello di `text2sql.py`; sparisce solo il server HTTP.
- **Conoscenza** in `backend/text2sql/knowledge/schema.md` e `esempi_query.md`, copiate dal prototipo. Si rileggono quando cambiano (stessa cache sul tempo di modifica del prototipo).
- **Fonti degli esempi**: una funzione `load_examples()` restituisce la lista degli esempi. Oggi legge solo il file; in futuro potrà aggiungere le Query Wiki di un linguaggio dedicato senza toccare il resto.
- **Modello** `Text2SqlRequest`:
  - `user` (FK utente);
  - `question` (testo);
  - `status`: `queued` | `running` | `done` | `error`;
  - `sql` (testo);
  - `kind`: `read` | `write` | `impossible` | vuoto;
  - `warnings` (JSON lista);
  - `seconds` (decimale);
  - `error` (testo);
  - `created_at`, `started_at`, `finished_at`.
- **Permesso** `text2sql.use_text2sql` «Usa il generatore SQL PACS», da dare a gruppi o utenti.
- **API** `/api/text2sql/` (viewset con la barriera `IsInternalOrPortalDedicatedApp`, più il permesso):
  - `POST`: crea la domanda in coda e risponde subito con la riga e lo stato;
  - `GET` elenco: solo le proprie domande, le più recenti per prime;
  - `GET` dettaglio: solo le proprie (le altre rispondono 404);
  - `DELETE`: toglie una propria domanda dallo storico.
- Domanda vuota o più lunga di 2000 caratteri → 400.
- **Lavoratore**: comando `python manage.py text2sql_worker`, nuovo servizio `text2sql-worker` nel compose (stessa immagine del backend, entrypoint vuoto, come `cron`).
  - Prende una domanda alla volta, la più vecchia in coda, con `select_for_update(skip_locked=True)`.
  - Durante l'elaborazione la segna `running`, poi la chiude in `done` o in `error`.
  - All'avvio rimette in coda le domande rimaste `running`, cioè quelle interrotte da un riavvio.
  - Con il modulo spento (`is_module_enabled`) non elabora nulla.
  - Senza domande in coda controlla ogni 2 secondi.
- **Modulo spegnibile**: registrato in `core/modules.py` (segmento API `text2sql`) e in `moduleRegistry.ts` (chiavi uguali).

### Notifica

- Nuovo `NotificationType.TEXT2SQL_READY`, «Query SQL pronta». Il lavoratore crea la notifica a fine elaborazione, anche in caso di errore («Query SQL non riuscita»):
  - titolo: la domanda accorciata;
  - `link`: `/knowledge/sql?apri=<id>`;
  - `source_key`: l'id della domanda;
  - `event_date`: oggi.
- Il comando `refresh_notifications` lavora tipo per tipo, quindi non le tocca.
- Se il tecnico apre la risposta dalla pagina, la notifica si segna letta da sola.
- La campanella oggi controlla ogni 5 minuti. Finché il tecnico ha una domanda in attesa passa a ogni 15 secondi, poi torna ai 5 minuti. Come fa la campanella a sapere che c'è una domanda in attesa lo decide chi implementa: per esempio un segnale lasciato dalla pagina all'invio, oppure un conteggio dal server.

### Frontend

- Voce **«Generatore SQL»** nel gruppo Conoscenza, percorso `/knowledge/sql`, visibile solo con il permesso e con il modulo acceso.
- Pagina:
  - in alto la domanda (campo di testo più «Genera»);
  - sotto la risposta selezionata: la query in un blocco di codice con «Copia», il tipo (Lettura / Scrittura / Impossibile, con la scrittura evidenziata) e gli avvisi;
  - a lato o sotto, lo storico delle proprie domande con lo stato («in coda», «in elaborazione…», tempo impiegato).
- Mentre una domanda è in attesa la pagina ne controlla lo stato ogni 3 secondi.
- `?apri=<id>` apre direttamente quella risposta.
- Lo stile segue Campo sterile. Per una pagina nuova vale la regola di Fede: **prima l'anteprima** in `design-previews` e il suo ok, poi la pagina nell'app.

### Giudizio delle risposte e revisione (decisione di Fede)

- Il modello non si riaddestra: le risposte migliorano con esempi e schema. Il giudizio dei tecnici serve a Fede per sapere dove intervenire e per avere esempi già corretti.
- Su `Text2SqlRequest` ci sono quattro campi nuovi:
  - `feedback`: `ok` | `ko` | vuoto;
  - `corrected_sql` (testo, facoltativo);
  - `feedback_note` (testo, facoltativo);
  - `feedback_at`.
- `PATCH /api/text2sql/<id>/feedback/`: solo l'autore della domanda, solo a domanda `done`. Il giudizio si può cambiare.
- Sotto ogni query ci sono «Corretta» e «Da correggere». Con «Da correggere» si aprono i campi «Query corretta» e «Nota».
- **Revisione solo per il superuser**, senza un permesso dedicato:
  - vista «Revisione» nella stessa pagina, con le risposte giudicate di tutti i tecnici, prima quelle «Da correggere»;
  - filtro per giudizio;
  - per ognuna: domanda, query generata, query corretta e nota, autore e data;
  - «Copia come esempio» prepara il blocco nel formato di `esempi_query.md` (la domanda più la query corretta, o quella generata se era giusta), da incollare nel file. Il formato si ricava dagli esempi esistenti;
  - «Segna come rivista» toglie la risposta dalla coda della revisione (campo `reviewed_at`).
- In revisione il superuser vede anche le domande degli altri: è un'eccezione voluta allo storico personale, limitata alle risposte che hanno ricevuto un giudizio.
- Nessun automatismo: le query giudicate corrette **non** diventano esempi da sole. L'aggancio `load_examples()` resta pronto se un giorno servirà.

## Sicurezza

- Le domande possono contenere nomi di pazienti, e lo schema rende interrogabili dati clinici e credenziali SECM. Per questo lo storico è **personale**: ognuno vede solo le sue domande. Unica eccezione: il superuser vede in «Revisione» le risposte che hanno ricevuto un giudizio.
- Nessun dato di Archie va a Ollama oltre alla domanda e alla conoscenza del PACS. Ollama gira in rete interna, non su servizi esterni.
- Le domande create e cancellate vanno nell'Audit, come gli altri oggetti.

## Rilascio

- Migrazioni nuove: `text2sql.0001`, più la scelta per il nuovo tipo di notifica (solo `choices`, nessuna tabella).
- Il nuovo servizio `text2sql-worker` va aggiunto anche all'override di produzione.
- Ollama e il modello vanno installati a mano sulla macchina scelta, con `OLLAMA_URL` in `.env.prod`.
- Il permesso «Usa il generatore SQL PACS» va dato ai gruppi dei tecnici.

## Lasciato a chi implementa

- Nomi esatti dei file e della migrazione, e come la campanella capisce che c'è una domanda in attesa (vedi sopra).
- Quanti elementi mostra lo storico; la proposta è 50, con «Mostra altri».
