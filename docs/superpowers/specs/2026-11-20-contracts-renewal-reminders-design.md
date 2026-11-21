# Contratti fase 2 — promemoria di rinnovo e Impostazioni di Archie

Data: 2026-11-20 · Stato: in approvazione · Anteprima: `design-previews/ctr2-base.html`
Sostituisce la sezione «Reminder» di `2026-10-27-contracts-design.md`.

## Perché

L'ufficio deve ricordarsi in tempo di **preparare e proporre il nuovo contratto** prima che quello in
corso finisca. Non esiste un termine di disdetta: nell'app non si deve più parlare di disdetta.

## Obiettivi

1. Per ogni contratto attivo, un **avviso di rinnovo** N giorni prima della fine (N per contratto).
2. Dalla data dell'avviso, un **promemoria via email ogni 10 giorni** (configurabile) finché il contratto
   non viene rinnovato o chiuso, fino alla data di fine compresa.
3. Ogni promemoria è **un'email a sé con il suo template** (non il riepilogo delle 8), **una per contratto**:
   due contratti con le stesse date producono due email.
4. Destinatari: il **venditore** del contratto e gli **indirizzi dell'ufficio** impostati nel pannello
   Impostazioni.
5. Nasce il pannello **Impostazioni di Archie**, base per future configurazioni applicative.

## Non obiettivi

- Statistiche e cruscotto (fase 3 della spec di ottobre).
- Ricerca asincrona di clienti e device nel modulo contratto (resta il limite di 200; lavoro separato).
- Rate o collegamento ai Purchase Order.
- Preferenze di invio per utente (opt-out).

## Da evitare (anti-obiettivi)

- Qualsiasi testo su «disdetta», «preavviso di disdetta», «termine di disdetta».
- Una valanga di email: dopo un fermo del cron si manda al massimo **un** promemoria per contratto, non
  tutti quelli saltati.
- Importi nell'email: va anche a indirizzi esterni.

## Decisioni di Fede

| Tema | Decisione |
|------|-----------|
| Disdetta | Non esiste: il campo «preavviso» diventa «Avviso di rinnovo: N giorni prima della fine». |
| Anticipo | Per contratto (30 / 60 / 90 / 180 o a mano), predefinito nelle Impostazioni. |
| Ripetizione | Ogni 10 giorni dalla data dell'avviso, fino alla scadenza, finché non rinnovato/chiuso. |
| Email | Template singolo, una per contratto e per promemoria. A: venditore, Cc: ufficio. Senza importi. |
| Venditore | Utente Archie **oppure** nominativo inserito a mano (nome e cognome, email). |
| Indirizzi ufficio | Un'email o una lista separata da `;` nel pannello Impostazioni. |
| Stato «Disdetto» | Diventa **«Chiuso»**. |
| Rinnovo automatico | **Tolto** (campo `auto_renew` rimosso). |
| Impostazioni | Pannello «Impostazioni di Archie»: superuser o chi ha il permesso dedicato. |

## Approcci considerati

**Destinatari** — (A, scelto da Fede in forma modificata) venditore + indirizzi dell'ufficio da un pannello
impostazioni; (B) gruppo «Contratti - Reminder» creato in automatico, scartato: i gruppi li crea Fede e
il progetto è passato ai permessi di gruppo; (C) solo venditore, scartato: oggi nessun venditore ha un
utente e i contratti senza venditore non avviserebbero nessuno.

**Anticipo** — per contratto con predefinito nelle Impostazioni (scelto) contro un valore unico per tutti
(scartato: contratti di peso diverso richiedono anticipi diversi).

**Frequenza** — avviso singolo, avviso + richiamo a 30 giorni, oppure ripetizione ogni 10 giorni (scelto).

**Invio** — dentro il riepilogo delle 8 (scartato: «non deve rischiare di perdersi») contro email
dedicata per contratto (scelto).

## Modello dati (`backend/contracts`)

- `Contract.notice_days` → rinominato **`reminder_days`** (`RenameField`, default 90; validazione 1–365).
  Proprietà `notice_deadline` → **`reminder_date = end_date - reminder_days`** (stessa protezione da
  `OverflowError`).
- `Contract.auto_renew` → **rimosso** (`RemoveField`).
- `ContractStatus.DISDETTO` → **`CHIUSO = "chiuso", "Chiuso"`**, con migrazione dati
  `disdetto → chiuso` (e reverse).
- `ExpiryState`: `ok` («In corso»), **`renew`** («Da rinnovare»: oggi ≥ `reminder_date` e oggi ≤ fine),
  `expired` («Scaduto»), `none` (non attivo). Spariscono `notice` ed `expiring`.
- Nuovo **`ContractReminder`**: `contract` (FK, CASCADE), `due_on` (data del promemoria nel calendario),
  `sent_at`, `to` (testo), `cc` (testo), `ok` (bool), `error` (testo). Vincolo unico `(contract, due_on)`.
  È lo storico mostrato nella finestra e la protezione contro i doppi invii.
- `Seller`: resta `name` (etichetta «Nome e cognome»), `email`, `phone`, `user` facoltativo. Regole:
  - con `user` l'email usata è `user.email` (il campo `email` del venditore resta come ripiego se l'utente
    non ne ha una); senza `user` serve `email` (validazione: obbligatoria se manca l'utente);
  - `user` accetta solo utenti attivi con accesso ad Archie (`core.access_archie` o superuser), non
    utenti solo-Portal (nota della fase 1).

## Calendario dei promemoria

Per un contratto `attivo`, non nel cestino, di un cliente non nel cestino:

```
date = [reminder_date + k·every  per k = 0, 1, 2 …  finché ≤ end_date]
```

`every` = impostazione «Ripeti ogni» (predefinito 10). Il calendario si ricalcola sempre dai dati attuali:
spostare in avanti la fine (Rinnova…) o cambiare l'anticipo sposta tutte le date; segnare «Chiuso» ferma.

**Invio (comando `send_contract_reminders`)** — per ogni contratto idoneo: prende l'**ultima** data del
calendario `≤ oggi`; se non c'è già un `ContractReminder` con quella `due_on`, manda l'email e lo registra.
Così un fermo del cron produce un solo invio di recupero, e un contratto creato già dentro la finestra
riceve subito il primo promemoria.

**Pianificazione** — nuovo ciclo nel servizio `cron` di `docker-compose.yml`, come
`send_deadline_digest`: ogni 15 minuti, esegue solo alle **8:00 locali** (stessa costante/approccio),
idempotente grazie al vincolo unico. Saltato se il modulo `contracts` è spento (`is_module_enabled`).

## Destinatari

- **A**: email del venditore (vedi regole `Seller`), se il venditore è attivo e ha un'email.
- **Cc**: indirizzi dell'ufficio dalle Impostazioni (validati, duplicati tolti).
- Senza venditore utile: tutto l'ufficio in **A**. Senza nessun destinatario: nessun invio, si registra
  `ContractReminder` con `ok=False` e `error` («Nessun destinatario»), visibile nella finestra.
- Errore SMTP: `ok=False` con l'errore; **non** si ritenta automaticamente la stessa data (la successiva
  parte da calendario). Il fallimento compare nella finestra.

## Campanella (in-app)

- Nuovo `NotificationType.CONTRACT_RENEWAL` («Contratto da rinnovare»).
- Solo per il venditore **utente Archie**: una notifica per contratto (`source_key = <contract_id>`),
  `event_date = end_date`, link `/contracts?open=<id>`. Creata/aggiornata a ogni promemoria inviato,
  rimossa (se non letta) quando il contratto non è più «Da rinnovare».
- Nessuna email di riepilogo per questa notifica (`last_emailed_event_date` impostato all'invio, così il
  digest non la riprende). Nascosta se il modulo è spento (`hidden_notification_types`).

## Email

- Template `core/templates/emails/contract_renewal.html` sullo stile «Bollettino» delle altre email
  (`send_templated_email`), linguetta «Contratti · promemoria i di n».
- Oggetto: `Rinnovo contratto <codice> · <cliente> · scade il <gg/mm/aaaa>`.
- Corpo: saluto al venditore (nome) o «Buongiorno» se va all'ufficio; giorni mancanti alla fine;
  tabella contratto (titolo, codice, tipo, società), cliente, periodo, venditore, numero di device;
  pulsante «Apri il contratto in Archie» (`ARCHIE_PUBLIC_URL/contracts?open=<id>`); data del prossimo
  promemoria o «È l'ultimo promemoria»; piè di pagina con il motivo della ricezione.
- **Nessun importo** e nessun PDF.

## Impostazioni di Archie

- Base dati: il modello esistente **`core.AppSetting`** (chiave/valore). Chiavi:
  `contracts.reminder_emails` (testo, `;`), `contracts.reminder_default_days` (90),
  `contracts.reminder_every_days` (10). Lettura tramite un piccolo registro in `core/app_settings.py`
  (chiave, tipo, predefinito, validatore, sezione), con valori predefiniti se la riga manca.
- Permesso nuovo **`core.manage_app_settings`** («Gestisce le impostazioni di Archie»), da dare ai gruppi;
  il superuser passa sempre.
- API `GET /api/app-settings/` (solo le chiavi del registro, per sezione) e `PATCH /api/app-settings/`
  (validazione per chiave; email non valide → 400 con l'elenco). Ogni modifica nell'Audit.
  `POST /api/app-settings/contracts/test-email/`: email di prova agli indirizzi dell'ufficio.
  ViewSet/APIView con `IsInternalOrPortalDedicatedApp` + il permesso; non è un modulo spegnibile.
- Frontend: pagina `/impostazioni` (voce nel menu utente, come «Moduli», visibile con il permesso),
  sezione «Contratti» come nell'anteprima: indirizzi con etichette e controllo, avviso predefinito a
  pastiglie, «Ripeti ogni N giorni», «Manda un'email di prova», barra di salvataggio.

## Frontend Contratti

Come `ctr2-base.html`:
- testata: «finisce il», «avviso di rinnovo dal/il», «prossimo promemoria» (porta alla sezione);
- Periodo: linea inizio → avviso → fine con oggi e zona dei promemoria; frasi senza disdetta;
- nuova sezione **Promemoria di rinnovo**: destinatari (venditore con tipo, ufficio) e calendario
  (inviati con esito, prossimo, previsti; i molti già inviati si ripiegano) — dati da un campo
  `reminders` nel dettaglio del contratto (calendario calcolato + storico `ContractReminder`);
- Dettagli: «Avviso di rinnovo: N giorni prima» (in modifica pastiglie 30/60/90/180 + numero, con la data
  risultante); niente «Rinnovo automatico»; stato «Chiuso»; ⋯ «Segna come chiuso»;
- elenco: vista «Da rinnovare» al posto di «Da gestire» (filtro `expiry=renew`), «Chiusi»;
  indicatori riscritti senza «Preavviso»/«In scadenza»; colonna Venditore;
- modulo Nuovo/Modifica contratto: «Avviso di rinnovo» con il predefinito dalle Impostazioni, riepilogo
  senza disdetta;
- Venditori: etichetta «Nome e cognome», email obbligatoria se manca l'utente, utente solo tra gli
  utenti Archie.

Ogni testo «disdett*», «preavviso» sparisce da frontend, API (messaggi), email e changelog nuovi.

## Vincoli

- Tutti i nuovi endpoint con `IsInternalOrPortalDedicatedApp`; `app-settings` registrato nel router.
- Migrazioni nuove, mai modifiche a quelle applicate; `makemigrations --check` pulito.
- `npm run gen:api` dopo i cambi di schema.
- Catena di verifica completa (tsc, build, lint baseline 5, vitest, pytest, check).
- Rilascio in dev e prova nel browser (Playwright) delle tre parti.

## Lasciato al costruttore

- Nomi esatti di componenti e file frontend; ripartizione del registro impostazioni.
- Quanti promemoria inviati mostrare prima di ripiegarli.
- Forma esatta del campo `reminders` nel serializer.

## Scelte fatte da Claude (da controllare)

- `Seller.name` resta un campo unico «Nome e cognome» invece di due campi separati.
- `notice_days` rinominato in `reminder_days` anche nell'API (rottura per il solo frontend Archie).
- Invio alle 8:00 locali, come il riepilogo esistente.
- Nessun nuovo tentativo automatico dopo un errore SMTP.
- Campanella solo per il venditore utente Archie, non per altri.
