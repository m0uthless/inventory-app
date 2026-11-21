# Issue — allegati e «Dove intervenire» completo

Data: 2026-11-20 · Stato: approvato a voce da Fede (A per allegati, A per referente, A per l'archiviazione)

## Perché

Chi lavora una issue sul campo deve poter allegare screenshot, log e documenti, e avere sotto mano chi
chiamare, su quale macchina intervenire e come entrarci, senza aprire altre finestre.

## Allegati

**Decisioni di Fede**
- Caricamento diretto nella issue (trascinare o scegliere i file).
- Una issue nata da un task di area **eredita gli allegati del task**, mostrati col prefisso «[Task]».

**Approcci considerati**: (A, scelto) allegati propri della issue in una tabella, file nella cartella
protetta dei media, scaricati solo via API; (B) caricamento nel Drive in una cartella per issue —
scartato: la issue dipenderebbe dal modulo Drive e dai suoi permessi; (C) entrambi — scartato per ora.

**Modello** `issues.IssueAttachment`
- `issue` FK (CASCADE, `related_name="attachments"`), `file` FileField (`issues/attachments/<issue_id>/…`,
  facoltativo), `drive_file` FK a `drive.DriveFile` (facoltativo, SET_NULL), `name` (nome mostrato),
  `size`, `mime_type`, `from_task` (bool), `uploaded_by`, `created_at`.
- Esattamente uno fra `file` e `drive_file` (vincolo).
- Cancellazione definitiva del file su disco quando si toglie l'allegato (niente cestino).

**Regole**
- Limiti: **25 MB** per file; estensioni ammesse: pdf, png, jpg, jpeg, gif, webp, txt, log, csv, zip,
  docx, xlsx (`core.uploads.validate_upload`, controllo del tipo reale come per i contratti).
- Lettura: chi può vedere la issue (permesso `issues.view_issue` + visibilità per area: issue invisibile
  → 404). Gli allegati `drive_file` si vedono solo se l'utente ha accesso a quel file nel Drive
  (`drive.access.has_file_access`); altrimenti non compaiono.
- Aggiunta e rimozione: chi può modificare la issue (`issues.change_issue` + `can_edit_issue`, cioè
  rispettando l'area); issue chiusa → sola lettura.
- Ogni aggiunta/rimozione va nell'attività della issue e nell'Audit (nome del file).
- Download solo via API (`protected_media_response`), mai via nginx; per i `drive_file` il download
  passa dall'endpoint del Drive.

**API**
- `GET /api/issues/{id}/attachments/` → elenco `{id, name, size, mime_type, from_task, url, uploaded_by_name, created_at}`.
- `POST /api/issues/{id}/attachments/` (multipart `file`, anche più file) → 201 con gli allegati creati.
- `DELETE /api/issues/{id}/attachments/{att_id}/`.
- `GET /api/issues/{id}/attachments/{att_id}/download/`.
- Il campo `attachments_count` nell'elenco/dettaglio della issue.

**Eredità dal task** (`AreaTask.convert_to_issue`): per ogni `drive_files` del task una riga
`IssueAttachment(drive_file=…, name="[Task] <nome>", from_task=True)`. Nessuna copia del file.

**Frontend** (finestra della issue): sezione «Allegati» al centro, dopo la descrizione, con elenco
(icona per tipo, nome, dimensione, chi e quando, apri/scarica, togli), zona per trascinare e
pulsante «Allega file»; conteggio nella testata. Anteprima immagini e PDF in una nuova scheda.

## Dove intervenire

**Decisione di Fede**: referente automatico (A).
- **Referente**: il contatto principale del sito della issue (nome, reparto, telefono con «Chiama»,
  email); senza principale, i contatti del sito (al massimo 3, con «Altri N»); senza sito, niente riga.
- **Device**: dell'inventario collegato si aggiungono seriale e K-number accanto a hostname/IP.
- **Credenziali**: dell'inventario collegato, con lo stesso comportamento della finestra dell'inventario
  (mostra per 30 secondi, copia); senza il permesso «Credenziali» la riga dice «Serve il permesso
  Credenziali». Il pezzo delle credenziali si estrae dalla finestra dell'inventario e si riusa.
- I dati arrivano da `GET /api/inventories/{id}/` e `GET /api/contacts/?site=` già esistenti: nessuna
  modifica al backend per questa parte.

## Non obiettivi

Visibilità al cliente nel Portal, allegati ai commenti, collegamento di file del Drive a mano
(«Collega dal Drive»), anteprima dei file dentro la finestra.

## Vincoli

Endpoint con `IsInternalOrPortalDedicatedApp`; modulo Issue spegnibile già coperto dal segmento
`/api/issues/`; nessun accesso diretto ai file da nginx; catena di verifica completa; prova nel browser.

## Scelte di Claude (da controllare)

25 MB e l'elenco delle estensioni; niente cestino per gli allegati; massimo 3 contatti mostrati.
