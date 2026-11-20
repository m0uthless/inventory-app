# Schema PACS Philips Vue su Oracle — conoscenza per il generatore SQL

## 0. Regole di generazione (vincolanti)
- L'app NON esegue nulla: rispondi solo con la query da copiare.
- Prima riga sempre `-- READ | <cosa fa>` oppure `-- WRITE | <cosa fa + raggio d'azione>`.
- Consentiti SELECT, INSERT, UPDATE, DELETE. Per ogni UPDATE/DELETE genera SEMPRE il pacchetto, in quest'ordine:
  1) SELECT di anteprima con lo STESSO identico WHERE della DML; 2) la DML; 3) la riga `-- COMMIT;` commentata
  (il commit lo dà l'utente a mano dopo aver controllato le righe colpite).
- Mai UPDATE/DELETE senza WHERE: se manca il criterio rispondi `-- IMPOSSIBILE: serve un criterio di filtro`.
- SELECT: JOIN ANSI `JOIN ... ON`. UPDATE/DELETE: niente JOIN, filtra con `IN (SELECT ...)` o `EXISTS`.
- Mai `SELECT *` e mai colonne pesanti (BLOB/LONG/CLOB/XMLTYPE): ICON_BLOB, DUMP_*, REPORT_TEXT, E_REPORT_TEXT,
  ADDITIONAL_DETAILS, IMAGE_CUSTOM_XML_FIELD, PROPERTIES.
- Usa solo tabelle e colonne di questo documento, sempre con lo schema davanti
  (medistore., medilink., auditing., autorouter., cfg.). Se un dato non c'è: `-- IMPOSSIBILE: <motivo>`.
- SITE_ID, AE Title, PATIENT_CLASS, sorgenti diverse da 1: valori forniti dall'utente, mai inventati.
  Se la domanda non li dà usa un parametro (:site_id, :ae_title, :source_db_uid).
- Date: "eseguiti" o periodo generico → STUDY_DATE; "archiviati / arrivati / entrati" → INSERT_TIME.
  Intervalli sempre `col >= DATE 'aaaa-mm-gg' AND col < DATE 'aaaa-mm-gg'`; oggi = `>= TRUNC(SYSDATE) AND < TRUNC(SYSDATE) + 1`.
- Studio univoco = STUDY_INSTANCE_UID. ACCESSION_NUMBER non è garantito univoco: usalo solo per ricerche puntuali.
- Join studi → immagini → location MOLTIPLICA le righe (una per copia): filtra sempre `l.source_db_uid = 1`
  oppure conta `COUNT(DISTINCT s.study_db_uid)`. Mai COUNT(*) o SUM(image_size) grezzi su quel join.
- SOURCE_DB_UID = 1 = PACS locale (unico valore fisso). Backup / PACS collegati = `source_db_uid <> 1`.
- Modalità in DIDB_STUDIES.STUDY_MODALITY è una lista `\MOD1\MOD2\`: filtra con `LIKE '%\CT\%'` (senza ESCAPE), mai `=`.
  SR = referto strutturato, non è una modalità immagine: di norma escluso dai conteggi per modalità.
- Nomi di persona: `UPPER(col) LIKE UPPER('%valore%')`.
- AUDITING.AUDIT_LOG è enorme e lento: usalo solo se servono utente, paziente o azione e limita SEMPRE EVENT_DATE a una finestra stretta.
- Colonne sensibili (dati paziente, credenziali SECM): interrogabili.

## 1. Schemi e ponti
- medistore = archivio immagini (DIDB_*). medilink = RIS: ordini/referti/pazienti (MDB_*) e utenti (SECM_*).
- auditing = AUDIT_LOG. autorouter = motore di routing InfoRouter (COMMANDS_DATA, RULES_DATA). cfg = configurazione centrale (CFG_REPOSITORY).
```
Paziente store↔RIS : DIDB_PATIENTS.MDL_PATIENT_DBID = MDB_PATIENTS.PATIENT_DBID
Studio↔ordine RIS  : DIDB_STUDIES.MDL_ORDER_DBID = MDB_ORDERS.ORDER_DBID   (ponte preferito)
                     MDL_ORDER_DBID IS NULL = studio NON syncato col RIS ("orfano")
Accession          : DIDB_STUDIES.ACCESSION_NUMBER = MDB_ORDERS.FILLER_ENTITY_ID (alternativa)
PID reale          : DIDB_PATIENTS.MDL_PATIENT_DBID = MDB_REP_CX_FIELD.DBID AND COLUMN_DBID = 101 → INTERNAL_PID / VAL_ID
                     (mai usare DIDB_PATIENTS.ID come PID)
```

## 2. medistore

### DIDB_STUDIES — un record per studio
Chiave join STUDY_DB_UID; univoco STUDY_INSTANCE_UID.
```
STUDY_DB_UID, STUDY_INSTANCE_UID, PATIENT_DB_UID → DIDB_PATIENTS
MDL_ORDER_DBID → MDB_ORDERS.ORDER_DBID (NULL = non syncato col RIS)
ACCESSION_NUMBER, STUDY_DESCRIPTION, STUDY_BODY_PART
STUDY_MODALITY        lista \MOD\ (es. \DX\SR\)
STUDY_DATE            data ESECUZIONE esame;  STUDY_TIME ora (parte tempo)
INSERT_TIME           data ARCHIVIAZIONE;  LAST_IMAGE_INSERT_TIME ultimo arrivo immagine;  LAST_ACCESS_TIME ultimo accesso
STORING_AE            AE che ha archiviato lo studio su questo PACS
ORIGINAL_STORING_AE   AE della MODALITÀ che ha eseguito l'esame ("esami prodotti dalla macchina X")
STUDY_STATUS          refertazione: UNREAD = non refertato, APPROVED = refertato; intermedi READ, FINAL, PRELIM, WETREAD,
                      PROCESSING FINAL; NOREPORTING = nessun referto atteso
STUDY_HAS_REPORT      'Y' = ha referto;  SIGNING_PHYSICIAN_LAST_NAME cognome medico refertante
STUDY_ONLINE          'Y' online, 'N' non online ("offline" per l'utente);  STUDY_AVAILABILITY 'ONLINE'/'NEARLINE'
STUDY_KEEP_ONLINE     'Y'/'N' mantieni online;  LTSM_AVAILABILITY disponibilità su backup a lungo termine
STUDY_NEED_BACKUP     'Y' = da backuppare; NULL = non da backuppare (già fatto);
                      altra lettera = trattenuto a mano dal backup (iniziale dell'operatore, NON decodificare)
                      → trattenuti: study_need_backup IS NOT NULL AND study_need_backup <> 'Y'
SITE_ID               presidio (numero dato dall'utente); 0 = sito non assegnato
PATIENT_CLASS         valori diversi per cliente: li dà l'utente
PATIENT_LOCATION      reparto (es. LIKE '%PS%' = Pronto Soccorso)
NUMBER_OF_STUDY_SERIES, NUMBER_OF_STUDY_IMAGES
FREE_TEXT*, FREE_CHAR*, FETCH_TIME  flag custom non documentati: non usarli
```

### DIDB_SERIESES_TABLE — una riga per serie
`STUDY_DB_UID`, `SERIES_DB_UID` (→ DIDB_RAW_IMAGES_TABLE.SERIES_DB_UID), `SERIES_NUMBER`, `MODALITY` (codice singolo, es. 'CR': qui si usa `=`), `SERIES_DESCRIPTION`.

### DIDB_RAW_IMAGES_TABLE — una riga per immagine
`RAW_IMAGE_DB_UID` (→ DIDB_IMAGE_LOCATIONS), `STUDY_DB_UID`, `SERIES_DB_UID`, `PATIENT_DB_UID`, `SOP_INSTANCE_UID`, `SOP_CLASS_UID`,
`IMAGE_ONLINE` ('Y'/'N'), `IMAGE_NEED_BACKUP`, `KEY_IMAGE`.

### DIDB_IMAGE_LOCATIONS — dove sta ogni immagine (una riga per immagine e sorgente)
`RAW_IMAGE_DB_UID`, `SOURCE_DB_UID` (→ DIDB_SOURCES), `FILE_SYSTEM`, `IMAGE_SIZE` (byte; GB = /1024/1024/1024), `FILE_NUM`, `FILE_TYPE`.
Path file immagine = FILE_SYSTEM/ + LPAD(PATIENT_DB_UID,12,'0') in 4 gruppi da 3 / STUDY_DB_UID / SERIES_DB_UID / RAW_IMAGE_DB_UID.img

### DIDB_STUDY_LOCATIONS — dove sta ogni studio (PK STUDY_DB_UID + SOURCE_DB_UID)
`STUDY_DB_UID`, `SOURCE_DB_UID`, `AVAILABILITY_TYPE_DB_UID`, `NUM_OF_IMAGES`.

### DIDB_SOURCES — sorgenti/storage
`SOURCE_DB_UID`, `SOURCE_AE`, `SOURCE_IP`, `SOURCE_STATUS`, `SOURCE_TYPE_DB_UID` (→ DIDB_SOURCES_TYPES), `AVAILABILITY_TYPE_DB_UID` (→ DIDB_AVAILABILITY_TYPES).
Lookup: DIDB_SOURCES_TYPES (`SOURCE_TYPE_DB_UID`, `SOURCE_TYPE_NAME`, `AVAILABILITY_TYPE_DB_UID`): 1=FIR primario, 2=SIR backup.
DIDB_AVAILABILITY_TYPES (`AVAILABILITY_TYPE_DB_UID`, `AVAILABILITY_TYPE_NAME`): 1 ONLINE, 2 NEARLINE, 3 OFFLINE, 4 AUTO, 5 NEARLINE1, 6 OFFLINE_CLOUD
(non ordinare per AVAILABILITY_POWER: usa un CASE).

### DIDB_PATIENTS — anagrafica lato archivio
`PATIENT_DB_UID` (→ DIDB_STUDIES), `MDL_PATIENT_DBID` (ponte RIS e PID), `LAST_NAME`, `FIRST_NAME`, `BIRTH_DATE`, `SEX`, `NUMBER_OF_PATIENT_STUDIES`.
`ID` NON è il PID. Vista DIDB_PATIENTS_VIEW: `PATIENT_DB_UID`, nome e `ALL_PIDS` (tutti i PID concatenati; più lenta).

### DIDB_STUDY_HEADER_LOCATION
`STUDY_DB_UID`, `DIRECTORY_PATH` (cartella dello studio), `NUM_OF_IMAGES`, `NUM_OF_FILES`.

### DIDB_DELETED_IMAGES — cancellazioni vere (una riga per immagine cancellata)
Da usare per "esami/immagini cancellati". `STUDY_INSTANCE_UID`, `SERIES_INSTANCE_UID`, `SOP_INSTANCE_UID`, `STUDY_DB_UID`, `PATIENT_DB_UID`,
`SOURCE_DB_UID`, `FILE_SYSTEM`, `DELETE_DATE` (data cancellazione). Immagini = COUNT(*); studi = COUNT(DISTINCT study_instance_uid).
NON contiene accession né nome paziente: per quelli → AUDIT_LOG via STUDY_INSTANCE_UID. Gli studi cancellati non esistono più in DIDB_STUDIES.
DIDB_DELETED_LOCATIONS = rimozioni di singole copie (milioni di righe): NON usarla per contare cancellazioni; mai filtrarla per DELETE_DATE.

### DIDB_STUDIES_IMPORT — tabella di lavoro delle migrazioni
`ACCESSION_NUMBER`, `STUDY_STATUS` NUMERICO (0 = da processare, 4 = OK, 5 = errore, 6 = da confermare), `CUSTOM_TAG` (lotto),
`SESSION_ID`, `SOURCE_ID`, `TIME_ENDED`. Non confonderlo con lo STUDY_STATUS testuale di DIDB_STUDIES.

### Altre
- LTSM_STUDY_MEDIA: `STUDY_INSTANCE_UID`, `MEDIA_ID` (studi su un supporto di backup). Il resto di SIR_*/LTSM_* non è documentato.
- INT_TELE_PUBLISH (coda pubblicazione XDS): `ACCNUM` (= accession), `PID`, `STATUS` (0, 3), `INSERTTIME`, `VAL_ASSIGN_AUTH_NAME`.
- DIDB_FIR_FS: `SOURCE_DB_UID`, `FS_NAME` (filesystem dello storage).

## 3. medilink

### MDB_ORDERS — ordini RIS
`ORDER_DBID`, `PATIENT_DBID`, `VISIT_DBID`, `FILLER_ENTITY_ID` (= accession), `PLACER_ENTITY_ID`, `PROC_ID`, `PROC_TEXT` (prestazione),
`CLINICAL_INFO`, `DIAGNOSTIC_SERVICE_SECTION_ID` (reparto erogante), `MODALITY`,
`ORDER_STATUS` (SC programmato, CM completato, CA cancellato), `RESULTS_STATUS` (F finale, vuoto = nessun risultato),
`ORDER_DATETIME` (ordine ricevuto), `SCHEDULED_DATETIME` (esecuzione prevista).

### MDB_REPORTS — referti
`REPORT_DBID`, `ORDER_DBID` (→ MDB_ORDERS), `RESULTS_STATUS` (F finale, P preliminare), `REPORT_DATETIME` ("refertati nel periodo"), `HAS_SR`.
RESULT_DATETIME è sempre NULL: non usarla. REPORT_TEXT / E_REPORT_TEXT / ADDITIONAL_DETAILS mai in SELECT.

### MDB_REP_CX_FIELD — qui vive il PID
`DBID` (= DIDB_PATIENTS.MDL_PATIENT_DBID = MDB_PATIENTS.PATIENT_DBID), `TABLE_DBID` = 1 e `COLUMN_DBID` = 101 per il PID,
`INTERNAL_PID`, `VAL_ID` (il PID), `VAL_ASSIGN_AUTH_NAME`, `CURRENT_DBID`.

### MDB_PATIENTS — anagrafica RIS
`PATIENT_DBID`, `NAME_FAMILY`, `NAME_GIVEN`, `NAME_MIDDLE`, `BIRTH_DATETIME`, `SEX`, `IS_TRUSTED`.

### SECM_* — utenti
```
SECM_USERS          DBID, LOGIN_ID, EMAIL, DOMAIN, STATUS (ACTIVE/SUSPENDED), SECURITY_GROUP_ID (→ SECM_GROUPS.DBID, gruppo primario),
                    DETAILS_ROW_ID (→ SECM_PERSON_DETAILS.DBID), LAST_LOGIN, LAST_LOGIN_APP, NUM_OF_FAILURES, LAST_FAILED_LOGIN, CREATION_TIME
SECM_PERSON_DETAILS DBID, NAME_FAMILY, NAME_GIVEN (nome reale dell'utente)
SECM_GROUPS         DBID, GROUP_NAME, GROUP_DISPLAY_NAME, SITE_ID, DEPARTMENT_ID, DOMAIN
SECM_USER_IN_GROUP  USER_DBID, GROUP_DBID (tutte le appartenenze)
SECM_SESSIONS       sessioni attive ORA: USER_DBID, LOGIN_ID, APPLICATION, IP_ADDRESS, STATUS, LAST_ACTIVITY, ROLE
SECM_PERMISSIONS    PERMISSION_NAME, RESOURCE_NAME, VALUE, ENTITY_DBID
```
Ultimo accesso = SECM_USERS.LAST_LOGIN; connessi ora = SECM_SESSIONS; accessi di un giorno passato = AUDIT_LOG.

## 4. auditing.AUDIT_LOG — un record per evento (LENTO)
`LOG_DBID`, `EVENT_DATE`, `USER_NAME`, `LOCATION` / `LOCATION_IP`, `CATEGORY`, `SUB_CATEGORY`, `ACTION`, `ORIG_AE`, `SRC_AE`, `DEST_AE`,
`LAST_NAME`, `FIRST_NAME`, `PATIENT_ID`, `STUDY_INSTANCE_UID`, `STUDY_ACCESSION_NO`, `DESCRIPTION`, `SEVERITY`.
- Login: `SUB_CATEGORY = 'User Authenticated'` (oppure `CATEGORY IN ('Account Management','System Access')`).
- Immagini aperte su una workstation: `SUB_CATEGORY = 'Instances Used'`, `LOCATION` = IP della workstation.
- Dati paziente: `CATEGORY = 'PHI Access'` con ACTION Access, Delete, Merge, Split, Modify (da confermare).

## 5. autorouter (InfoRouter) — storico di circa 2 settimane
### COMMANDS_DATA — un comando per riga
`COMMAND_DB_UID`, `TYPE`, `RUN_STATUS`, `COMPLETED`, `PERCENT_COMPLETED`, `ORIGINATING_RULE_DB_UID` (→ RULES_DATA.RULE_DB_UID),
`PARENT_COMMAND_DB_UID`, `START_DATE`, `END_DATE`, `LAST_UPDATE_TIME`, `LOG_MESSAGE` (esito/errore), `IDENTIFIER` (= STUDY_INSTANCE_UID),
`ACCESSION_NUMBER`, `PATIENT_ID`, `USER_NAME`, `SOURCE`, `DESTINATION`, `DESCRIPTION`, `PRIORITY`.
TYPE (confronta con UPPER): SERIES-ICON, COPY, BACKUP, TURNOFFNEEDBACKUP, GROUP, CREATE_SR, CREATEHCFF, DYNAMICCOPY.
RUN_STATUS: 4 completato, 8 fallito (motivo in LOG_MESSAGE), 1 in corso. Backup falliti = UPPER(type)='BACKUP' AND run_status = 8.
Non estrarre dati da PROPERTIES e non interrogare le code AR_*_QUEUE_TABLE.
### RULES_DATA — regole
`RULE_DB_UID`, `RULE_DESCRIPTION` (nome leggibile), `RULE_COMMENT`, `OWNER`, `DATE_ENTERED`, `STATUS`.

## 6. cfg.CFG_REPOSITORY — configurazione centrale ad albero
`PATH_SEGMENT` (path completo con separatore `\`), `PARENT_PATH_SEGMENT`, `VALUE` (NULL per i nodi cartella), `REMARK`, `SEQ_CHANGED`.
- Valore di un parametro: `path_segment = '<path esatto>'`.
- Figli diretti: `parent_path_segment = '<path nodo>'`.
- Sottoalbero: `path_segment LIKE '<path>\%' ESCAPE '!'` scrivendo gli underscore del prefisso come `!_`. Mai `ESCAPE '\'` (ORA-01424).

## 7. Da non usare
- Schemi esterni o non documentati: radsql, sio, sio_rn, uma, san, net, imagoweb, sysman, cdsurf, vipa; database link (@...).
- medistore.ac_*, sync/dict, tabelle DR$*, code AQ. Code RIS medilink.mdb_*_queue_table: solo COUNT(*).
