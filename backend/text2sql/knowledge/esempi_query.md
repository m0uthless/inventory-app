# Esempi di domande e query corrette (PACS Philips Vue)
<!-- Ogni esempio inizia con "### Domanda:". Il servizio sceglie automaticamente i più simili alla domanda. -->

### Domanda: quanti esami sono stati eseguiti per anno?
```sql
-- READ | Numero di esami per anno di esecuzione
SELECT TO_CHAR(study_date, 'YYYY') AS anno, COUNT(*) AS n_esami
FROM medistore.didb_studies
GROUP BY TO_CHAR(study_date, 'YYYY')
ORDER BY anno;
```

### Domanda: quanti esami sono stati archiviati oggi?
```sql
-- READ | Studi archiviati oggi sul PACS
SELECT COUNT(*) AS n_esami
FROM medistore.didb_studies
WHERE insert_time >= TRUNC(SYSDATE) AND insert_time < TRUNC(SYSDATE) + 1;
```

### Domanda: quanti esami sono stati eseguiti ieri per modalità?
```sql
-- READ | Esami eseguiti ieri raggruppati per lista modalità
SELECT study_modality, COUNT(*) AS n_esami
FROM medistore.didb_studies
WHERE study_date >= TRUNC(SYSDATE) - 1 AND study_date < TRUNC(SYSDATE)
GROUP BY study_modality
ORDER BY n_esami DESC;
```

### Domanda: quando è arrivato l'ultimo studio e quante ore fa?
```sql
-- READ | Ultimo studio archiviato e ore trascorse
SELECT TO_CHAR(MAX(insert_time), 'YYYY-MM-DD HH24:MI') AS ultimo_arrivo,
       ROUND((SYSDATE - MAX(insert_time)) * 24, 1) AS ore_fa
FROM medistore.didb_studies;
```

### Domanda: esami archiviati per macchina con data dell'ultimo arrivo
```sql
-- READ | Studi per AE di archiviazione con ultimo arrivo
SELECT storing_ae, COUNT(*) AS n_esami,
       TO_CHAR(MAX(insert_time), 'YYYY-MM-DD HH24:MI') AS ultimo_arrivo
FROM medistore.didb_studies
GROUP BY storing_ae
ORDER BY n_esami DESC;
```

### Domanda: quanti esami DX sono stati eseguiti a gennaio 2026?
```sql
-- READ | Esami con modalità DX eseguiti a gennaio 2026
SELECT COUNT(*) AS n_esami
FROM medistore.didb_studies
WHERE study_modality LIKE '%\DX\%'
  AND study_date >= DATE '2026-01-01' AND study_date < DATE '2026-02-01';
```

### Domanda: quanti esami XA per anno?
```sql
-- READ | Esami con modalità XA per anno di esecuzione
SELECT TO_CHAR(study_date, 'YYYY') AS anno, COUNT(*) AS n_esami
FROM medistore.didb_studies
WHERE study_modality LIKE '%\XA\%'
GROUP BY TO_CHAR(study_date, 'YYYY')
ORDER BY anno DESC;
```

### Domanda: quanti esami ha prodotto la macchina SRV-GEVPOINT01 nel presidio 999?
```sql
-- READ | Esami eseguiti da una modalità in un presidio
SELECT COUNT(*) AS n_esami
FROM medistore.didb_studies
WHERE original_storing_ae = 'SRV-GEVPOINT01' AND site_id = 999;
```

### Domanda: esami al giorno di una macchina con sito non assegnato
```sql
-- READ | Studi per giorno di archiviazione di una modalità con site_id = 0
SELECT TO_CHAR(insert_time, 'YYYY-MM-DD') AS giorno, COUNT(*) AS n_esami
FROM medistore.didb_studies
WHERE original_storing_ae = :ae_title AND site_id = 0
GROUP BY TO_CHAR(insert_time, 'YYYY-MM-DD')
ORDER BY giorno DESC;
```

### Domanda: esami non refertati degli ultimi 7 giorni per modalità
```sql
-- READ | Studi UNREAD eseguiti negli ultimi 7 giorni, per lista modalità
SELECT study_modality, COUNT(*) AS n_esami
FROM medistore.didb_studies
WHERE study_status = 'UNREAD'
  AND study_date >= TRUNC(SYSDATE) - 7
GROUP BY study_modality
ORDER BY n_esami DESC;
```

### Domanda: esami non sincronizzati col RIS archiviati questo mese
```sql
-- READ | Studi orfani (senza ordine RIS) archiviati nel mese corrente
SELECT accession_number, study_instance_uid, storing_ae,
       TO_CHAR(insert_time, 'YYYY-MM-DD HH24:MI') AS archiviato
FROM medistore.didb_studies
WHERE mdl_order_dbid IS NULL
  AND insert_time >= TRUNC(SYSDATE, 'MM')
ORDER BY insert_time;
```

### Domanda: distribuzione degli studi per flag di backup e stato online
```sql
-- READ | Conteggio studi per study_need_backup e study_online
SELECT study_need_backup, study_online, COUNT(*) AS n
FROM medistore.didb_studies
GROUP BY study_need_backup, study_online
ORDER BY n DESC;
```

### Domanda: quali studi sono stati esclusi a mano dal backup?
```sql
-- READ | Studi trattenuti manualmente dal backup (lettera diversa da Y)
SELECT study_need_backup AS flag, COUNT(*) AS n_studi
FROM medistore.didb_studies
WHERE study_need_backup IS NOT NULL AND study_need_backup <> 'Y'
GROUP BY study_need_backup
ORDER BY n_studi DESC;
```

### Domanda: quanti studi offline ci sono per anno?
```sql
-- READ | Studi non online per anno di esecuzione
SELECT TO_CHAR(study_date, 'YYYY') AS anno, COUNT(*) AS n_studi
FROM medistore.didb_studies
WHERE study_online = 'N'
GROUP BY TO_CHAR(study_date, 'YYYY')
ORDER BY anno;
```

### Domanda: numero medio di immagini per studio MR nel primo trimestre 2026
```sql
-- READ | Media immagini per studio MR, gennaio-marzo 2026
SELECT ROUND(AVG(number_of_study_images)) AS media_immagini
FROM medistore.didb_studies
WHERE study_modality LIKE '%\MR\%'
  AND study_date >= DATE '2026-01-01' AND study_date < DATE '2026-04-01';
```

### Domanda: esami CT refertati dal dottor Perchinunno nel 2026
```sql
-- READ | Esami CT 2026 per medico firmatario, per descrizione e presidio
SELECT study_description, site_id, COUNT(*) AS n_esami
FROM medistore.didb_studies
WHERE UPPER(signing_physician_last_name) LIKE UPPER('%PERCHINUNNO%')
  AND study_modality LIKE '%\CT\%'
  AND study_date >= DATE '2026-01-01' AND study_date < DATE '2027-01-01'
GROUP BY study_description, site_id
ORDER BY n_esami DESC;
```

### Domanda: TC del pronto soccorso senza sito assegnato, per macchina
```sql
-- READ | CT del PS con site_id = 0 nel 2026, per AE di archiviazione
SELECT storing_ae, COUNT(*) AS n_esami
FROM medistore.didb_studies
WHERE study_modality LIKE '%\CT\%'
  AND site_id = 0 AND patient_location LIKE '%PS%'
  AND study_date >= DATE '2026-01-01' AND study_date < DATE '2027-01-01'
GROUP BY storing_ae
ORDER BY n_esami DESC;
```

### Domanda: quanto spazio occupa il PACS locale?
```sql
-- READ | GB occupati sulla sorgente locale
SELECT ROUND(SUM(l.image_size) / 1024 / 1024 / 1024, 2) AS gb_locali
FROM medistore.didb_image_locations l
WHERE l.source_db_uid = 1;
```

### Domanda: quanti GB sono stati archiviati per anno?
```sql
-- READ | GB per anno di archiviazione, solo sorgente locale
SELECT TO_CHAR(s.insert_time, 'YYYY') AS anno,
       ROUND(SUM(l.image_size) / 1024 / 1024 / 1024, 2) AS gb
FROM medistore.didb_studies s
JOIN medistore.didb_raw_images_table i ON s.study_db_uid = i.study_db_uid
JOIN medistore.didb_image_locations l ON i.raw_image_db_uid = l.raw_image_db_uid
WHERE l.source_db_uid = 1
GROUP BY TO_CHAR(s.insert_time, 'YYYY')
ORDER BY anno;
```

### Domanda: peso degli esami per mese nel 2026
```sql
-- READ | Studi e GB per mese di esecuzione 2026, solo sorgente locale
SELECT TO_CHAR(s.study_date, 'YYYY-MM') AS mese,
       COUNT(DISTINCT s.study_db_uid) AS n_studi,
       ROUND(SUM(l.image_size) / 1024 / 1024 / 1024, 2) AS gb
FROM medistore.didb_studies s
JOIN medistore.didb_raw_images_table i ON s.study_db_uid = i.study_db_uid
JOIN medistore.didb_image_locations l ON i.raw_image_db_uid = l.raw_image_db_uid
WHERE l.source_db_uid = 1
  AND s.study_date >= DATE '2026-01-01' AND s.study_date < DATE '2027-01-01'
GROUP BY TO_CHAR(s.study_date, 'YYYY-MM')
ORDER BY mese;
```

### Domanda: dimensione media di uno studio nelle ultime tre settimane
```sql
-- READ | MB medi per studio eseguito negli ultimi 21 giorni, sorgente locale
SELECT ROUND(SUM(l.image_size) / 1024 / 1024 / NULLIF(COUNT(DISTINCT s.study_db_uid), 0), 2) AS mb_medi_per_studio,
       COUNT(DISTINCT s.study_db_uid) AS n_studi
FROM medistore.didb_studies s
JOIN medistore.didb_raw_images_table i ON s.study_db_uid = i.study_db_uid
JOIN medistore.didb_image_locations l ON i.raw_image_db_uid = l.raw_image_db_uid
WHERE l.source_db_uid = 1
  AND s.study_date >= TRUNC(SYSDATE) - 21 AND s.study_date < TRUNC(SYSDATE);
```

### Domanda: studi presenti solo sul PACS locale e non ancora replicati sul backup
```sql
-- READ | Studi con location solo sulla sorgente 1
SELECT s.study_db_uid, s.accession_number, s.study_date
FROM medistore.didb_studies s
WHERE EXISTS (SELECT 1 FROM medistore.didb_study_locations l
              WHERE l.study_db_uid = s.study_db_uid AND l.source_db_uid = 1)
  AND NOT EXISTS (SELECT 1 FROM medistore.didb_study_locations l
                  WHERE l.study_db_uid = s.study_db_uid AND l.source_db_uid <> 1)
ORDER BY s.study_date;
```

### Domanda: quanti studi di una macchina hanno una copia sulla sorgente collegata?
```sql
-- READ | Studi di una modalità e presidio con copia su una sorgente indicata dall'utente
SELECT COUNT(DISTINCT s.study_db_uid) AS n_studi
FROM medistore.didb_studies s
JOIN medistore.didb_study_locations l ON s.study_db_uid = l.study_db_uid
WHERE s.original_storing_ae = :ae_title AND s.site_id = :site_id
  AND l.source_db_uid = :source_db_uid;
```

### Domanda: elenco delle sorgenti con tipo e disponibilità
```sql
-- READ | Sorgenti configurate con tipo e disponibilità
SELECT s.source_db_uid, t.source_type_name, s.source_ae, s.source_ip, s.source_status,
       a.availability_type_name
FROM medistore.didb_sources s
JOIN medistore.didb_sources_types t ON s.source_type_db_uid = t.source_type_db_uid
LEFT JOIN medistore.didb_availability_types a ON s.availability_type_db_uid = a.availability_type_db_uid
ORDER BY s.source_db_uid;
```

### Domanda: percorso dei file delle immagini di uno studio dato l'accession
```sql
-- READ | Path completo su filesystem delle immagini di uno studio
SELECT DISTINCT
       l.file_system || '/' ||
       SUBSTR(LPAD(s.patient_db_uid, 12, '0'), 1, 3) || '/' ||
       SUBSTR(LPAD(s.patient_db_uid, 12, '0'), 4, 3) || '/' ||
       SUBSTR(LPAD(s.patient_db_uid, 12, '0'), 7, 3) || '/' ||
       SUBSTR(LPAD(s.patient_db_uid, 12, '0'), 10, 3) || '/' ||
       s.study_db_uid || '/' || i.series_db_uid || '/' || i.raw_image_db_uid || '.img' AS file_immagine,
       l.source_db_uid, l.image_size, i.image_online
FROM medistore.didb_studies s
JOIN medistore.didb_raw_images_table i ON s.study_db_uid = i.study_db_uid
JOIN medistore.didb_image_locations l ON i.raw_image_db_uid = l.raw_image_db_uid
WHERE s.accession_number = :accession
  AND l.file_system IS NOT NULL AND INSTR(l.file_system, '.img') = 0;
```

### Domanda: quali serie di uno studio hanno immagini offline?
```sql
-- READ | Serie con immagini non online per un accession
SELECT DISTINCT t.series_number, t.modality, t.series_description
FROM medistore.didb_studies s
JOIN medistore.didb_raw_images_table i ON s.study_db_uid = i.study_db_uid
JOIN medistore.didb_serieses_table t ON t.study_db_uid = i.study_db_uid AND t.series_db_uid = i.series_db_uid
WHERE s.accession_number = :accession AND i.image_online = 'N'
ORDER BY t.series_number;
```

### Domanda: dettagli di uno studio dato l'accession number
```sql
-- READ | Stato, disponibilità e backup di uno studio
SELECT s.study_db_uid, s.study_instance_uid, s.accession_number, s.study_date, s.study_modality,
       s.study_status, s.study_online, s.study_availability, s.study_need_backup,
       s.storing_ae, s.original_storing_ae, s.site_id, s.number_of_study_images
FROM medistore.didb_studies s
WHERE s.accession_number = :accession;
```

### Domanda: studi di un paziente dato il PID
```sql
-- READ | Studi di un paziente tramite PID (ponte MediLink)
SELECT p.patient_db_uid, p.last_name, p.first_name, s.accession_number, s.study_date, s.study_modality
FROM medistore.didb_patients p
JOIN medistore.didb_studies s ON p.patient_db_uid = s.patient_db_uid
JOIN medilink.mdb_rep_cx_field v ON p.mdl_patient_dbid = v.dbid AND v.column_dbid = 101
WHERE v.internal_pid = :pid
ORDER BY s.study_date;
```

### Domanda: cerca un paziente per cognome e nome con PID e studi
```sql
-- READ | Pazienti per nome con PID e studi
SELECT v.val_id AS pid, v.val_assign_auth_name, p.last_name, p.first_name,
       s.accession_number, s.study_date, s.study_modality, s.study_online
FROM medistore.didb_patients p
JOIN medistore.didb_studies s ON p.patient_db_uid = s.patient_db_uid
JOIN medilink.mdb_rep_cx_field v ON p.mdl_patient_dbid = v.dbid AND v.column_dbid = 101
WHERE UPPER(p.last_name) LIKE UPPER('%ROSSI%')
  AND UPPER(p.first_name) LIKE UPPER('MARIO%')
ORDER BY s.study_date;
```

### Domanda: ci sono PID duplicati?
```sql
-- READ | PID presenti più volte in MediLink
SELECT val_id AS pid, COUNT(*) AS n
FROM medilink.mdb_rep_cx_field
WHERE column_dbid = 101
GROUP BY val_id
HAVING COUNT(*) > 1
ORDER BY n DESC;
```

### Domanda: studi archiviati a luglio 2026 con stato del referto
```sql
-- READ | Studi archiviati a luglio 2026 con stato referto dal RIS
SELECT s.accession_number, s.study_modality, s.storing_ae,
       TO_CHAR(s.study_date, 'YYYY-MM-DD') AS data_esame,
       CASE WHEN r.results_status = 'F' THEN 'Refertato' ELSE 'Da refertare' END AS stato_referto
FROM medistore.didb_studies s
JOIN medilink.mdb_orders o ON s.mdl_order_dbid = o.order_dbid
LEFT JOIN medilink.mdb_reports r ON o.order_dbid = r.order_dbid
WHERE s.insert_time >= DATE '2026-07-01' AND s.insert_time < DATE '2026-08-01'
ORDER BY s.study_date;
```

### Domanda: referti di uno studio dato l'accession
```sql
-- READ | Referti collegati a uno studio (senza testo del referto)
SELECT s.accession_number, r.report_dbid, r.results_status, r.has_sr,
       TO_CHAR(r.report_datetime, 'YYYY-MM-DD HH24:MI') AS refertato_il
FROM medistore.didb_studies s
JOIN medilink.mdb_reports r ON s.mdl_order_dbid = r.order_dbid
WHERE s.accession_number = :accession
ORDER BY r.report_datetime;
```

### Domanda: quanti referti finali sono stati fatti questo mese?
```sql
-- READ | Referti finali del mese corrente
SELECT COUNT(*) AS n_referti
FROM medilink.mdb_reports
WHERE results_status = 'F'
  AND report_datetime >= TRUNC(SYSDATE, 'MM');
```

### Domanda: ordini cancellati ricevuti la settimana scorsa
```sql
-- READ | Ordini RIS in stato CA ricevuti negli ultimi 7 giorni
SELECT filler_entity_id AS accession, placer_entity_id, proc_text, modality,
       TO_CHAR(order_datetime, 'YYYY-MM-DD HH24:MI') AS ricevuto
FROM medilink.mdb_orders
WHERE order_status = 'CA'
  AND order_datetime >= TRUNC(SYSDATE) - 7
ORDER BY order_datetime;
```

### Domanda: ultimo accesso degli utenti attivi
```sql
-- READ | Ultimo login per utente attivo
SELECT login_id, TO_CHAR(last_login, 'YYYY-MM-DD HH24:MI') AS ultimo_accesso, last_login_app
FROM medilink.secm_users
WHERE status = 'ACTIVE'
ORDER BY last_login DESC;
```

### Domanda: quali utenti sono connessi adesso?
```sql
-- READ | Sessioni attive
SELECT login_id, application, ip_address,
       TO_CHAR(last_activity, 'YYYY-MM-DD HH24:MI') AS ultima_attivita
FROM medilink.secm_sessions
ORDER BY last_activity DESC;
```

### Domanda: elenco utenti con nome reale, gruppo e ultimo accesso
```sql
-- READ | Utenti con nome reale, gruppo primario e ultimo accesso
SELECT u.login_id, d.name_family, d.name_given, g.group_name,
       TO_CHAR(u.last_login, 'YYYY-MM-DD HH24:MI') AS ultimo_accesso, u.email
FROM medilink.secm_users u
JOIN medilink.secm_groups g ON g.dbid = u.security_group_id
JOIN medilink.secm_person_details d ON d.dbid = u.details_row_id
ORDER BY d.name_family, d.name_given;
```

### Domanda: quanti utenti per dominio?
```sql
-- READ | Utenti per dominio
SELECT domain, COUNT(*) AS n_utenti
FROM medilink.secm_users
GROUP BY domain
ORDER BY n_utenti DESC;
```

### Domanda: accessi al sistema del 20 luglio 2026
```sql
-- READ | Login del giorno dall'audit
SELECT TO_CHAR(event_date, 'YYYY-MM-DD HH24:MI') AS quando, user_name, location_ip, sub_category
FROM auditing.audit_log
WHERE sub_category = 'User Authenticated'
  AND event_date >= DATE '2026-07-20' AND event_date < DATE '2026-07-21'
ORDER BY event_date;
```

### Domanda: login dell'utente mrossi nell'ultima settimana
```sql
-- READ | Autenticazioni di un utente negli ultimi 7 giorni
SELECT TO_CHAR(event_date, 'YYYY-MM-DD HH24:MI') AS quando, location_ip, category, sub_category, action
FROM auditing.audit_log
WHERE category IN ('Account Management', 'System Access')
  AND UPPER(user_name) LIKE UPPER('%mrossi%')
  AND event_date >= TRUNC(SYSDATE) - 7
ORDER BY event_date DESC;
```

### Domanda: storia delle modifiche di uno studio nell'audit
```sql
-- READ | Eventi PHI diversi da Access per un accession (finestra di date obbligatoria)
SELECT TO_CHAR(event_date, 'YYYY-MM-DD HH24:MI') AS quando, user_name, sub_category, action,
       last_name, first_name, patient_id, description
FROM auditing.audit_log
WHERE category = 'PHI Access' AND action <> 'Access'
  AND study_accession_no = :accession
  AND event_date >= DATE '2026-01-01' AND event_date < DATE '2026-12-01'
ORDER BY event_date DESC;
```

### Domanda: quanti esami sono stati aperti sulla workstation 192.168.23.225 il 20 luglio?
```sql
-- READ | Esami distinti aperti su una workstation in un giorno
SELECT COUNT(DISTINCT study_accession_no) AS esami_aperti
FROM auditing.audit_log
WHERE sub_category = 'Instances Used'
  AND location = '192.168.23.225'
  AND event_date >= DATE '2026-07-20' AND event_date < DATE '2026-07-21';
```

### Domanda: pazienti visti per workstation nella prima settimana di luglio
```sql
-- READ | Pazienti distinti visti per IP di workstation
SELECT location AS workstation_ip, COUNT(DISTINCT patient_id) AS pazienti_visti
FROM auditing.audit_log
WHERE sub_category = 'Instances Used'
  AND event_date >= DATE '2026-07-01' AND event_date < DATE '2026-07-08'
GROUP BY location
ORDER BY pazienti_visti DESC;
```

### Domanda: immagini e studi cancellati per anno
```sql
-- READ | Cancellazioni amministrative per anno
SELECT TO_CHAR(delete_date, 'YYYY') AS anno,
       COUNT(*) AS n_immagini,
       COUNT(DISTINCT study_instance_uid) AS n_studi
FROM medistore.didb_deleted_images
GROUP BY TO_CHAR(delete_date, 'YYYY')
ORDER BY anno;
```

### Domanda: quanti esami sono stati cancellati a gennaio 2026?
```sql
-- READ | Studi distinti cancellati in un periodo
SELECT COUNT(DISTINCT study_instance_uid) AS n_studi_cancellati
FROM medistore.didb_deleted_images
WHERE delete_date >= DATE '2026-01-01' AND delete_date < DATE '2026-02-01';
```

### Domanda: elenco degli studi cancellati a luglio con filesystem per il recupero
```sql
-- READ | Studi cancellati a luglio 2026 con n. immagini e filesystem
SELECT study_instance_uid, COUNT(*) AS n_immagini, MIN(file_system) AS filesystem,
       TO_CHAR(MIN(delete_date), 'YYYY-MM-DD HH24:MI') AS cancellato_il
FROM medistore.didb_deleted_images
WHERE delete_date >= DATE '2026-07-01' AND delete_date < DATE '2026-08-01'
GROUP BY study_instance_uid
ORDER BY cancellato_il;
```

### Domanda: uno studio è stato cancellato? (dato lo study instance uid)
```sql
-- READ | Verifica cancellazione di uno studio
SELECT study_instance_uid, source_db_uid, COUNT(*) AS n_immagini,
       TO_CHAR(MIN(delete_date), 'YYYY-MM-DD HH24:MI') AS cancellato_il
FROM medistore.didb_deleted_images
WHERE study_instance_uid = :study_uid
GROUP BY study_instance_uid, source_db_uid;
```

### Domanda: chi ha cancellato gli esami nella prima settimana di luglio e di quali pazienti?
```sql
-- READ | Cancellazioni con utente e paziente dall'audit (LENTO: finestra stretta)
SELECT TO_CHAR(event_date, 'YYYY-MM-DD HH24:MI') AS quando, user_name,
       last_name, first_name, patient_id, study_accession_no, study_instance_uid
FROM auditing.audit_log
WHERE category = 'PHI Access' AND action = 'Delete'
  AND event_date >= DATE '2026-07-01' AND event_date < DATE '2026-07-08'
ORDER BY event_date DESC;
```

### Domanda: comandi dell'InfoRouter per tipo e stato nell'ultima settimana
```sql
-- READ | Comandi InfoRouter per tipo e stato, ultimi 7 giorni
SELECT UPPER(type) AS tipo, run_status, COUNT(*) AS n
FROM autorouter.commands_data
WHERE start_date >= TRUNC(SYSDATE) - 7
GROUP BY UPPER(type), run_status
ORDER BY tipo, run_status;
```

### Domanda: backup falliti con il motivo
```sql
-- READ | Comandi BACKUP falliti con messaggio di errore
SELECT command_db_uid, accession_number, identifier AS study_instance_uid, destination,
       TO_CHAR(start_date, 'YYYY-MM-DD HH24:MI') AS avviato, log_message
FROM autorouter.commands_data
WHERE UPPER(type) = 'BACKUP' AND run_status = 8
ORDER BY start_date DESC;
```

### Domanda: studi mandati in backup ieri
```sql
-- READ | Studi con comando BACKUP avviato ieri
SELECT DISTINCT accession_number, identifier AS study_instance_uid, destination,
       TO_CHAR(start_date, 'YYYY-MM-DD HH24:MI') AS avviato
FROM autorouter.commands_data
WHERE UPPER(type) = 'BACKUP'
  AND start_date >= TRUNC(SYSDATE) - 1 AND start_date < TRUNC(SYSDATE)
ORDER BY avviato;
```

### Domanda: quanti comandi ha generato ogni regola dell'InfoRouter?
```sql
-- READ | Volume comandi per regola e tipo
SELECT c.originating_rule_db_uid, r.rule_description, UPPER(c.type) AS tipo, COUNT(*) AS n
FROM autorouter.commands_data c
LEFT JOIN autorouter.rules_data r ON c.originating_rule_db_uid = r.rule_db_uid
GROUP BY c.originating_rule_db_uid, r.rule_description, UPPER(c.type)
ORDER BY n DESC;
```

### Domanda: valore del parametro di configurazione management_kind
```sql
-- READ | Valore di un parametro CFG (path esatto)
SELECT value
FROM cfg.cfg_repository
WHERE path_segment = 'imaginet\system\applications\um\management\management_kind';
```

### Domanda: parametri sotto il nodo um\management della configurazione
```sql
-- READ | Figli diretti di un nodo CFG
SELECT path_segment, value
FROM cfg.cfg_repository
WHERE parent_path_segment = 'imaginet\system\applications\um\management'
ORDER BY path_segment;
```

### Domanda: tutta la configurazione di ris_sync
```sql
-- READ | Intero sottoalbero CFG (ESCAPE '!', underscore come !_)
SELECT path_segment, value
FROM cfg.cfg_repository
WHERE path_segment LIKE 'imaginet\system\applications\ris!_sync\%' ESCAPE '!'
ORDER BY path_segment;
```

### Domanda: stato della migrazione per lotto
```sql
-- READ | Studi in import per lotto e stato numerico (0 da fare, 4 OK, 5 errore)
SELECT custom_tag AS lotto, study_status, COUNT(*) AS n_studi, MAX(time_ended) AS ultima_elaborazione
FROM medistore.didb_studies_import
GROUP BY custom_tag, study_status
ORDER BY custom_tag, study_status;
```

### Domanda: rimetti da backuppare gli studi del media 1832716093
```sql
-- WRITE | Imposta study_need_backup = 'Y' per gli studi di un media LTSM (solo quelli con flag NULL)
--   1) anteprima
SELECT s.study_db_uid, s.accession_number, s.study_need_backup
FROM medistore.didb_studies s
WHERE s.study_need_backup IS NULL
  AND s.study_instance_uid IN (SELECT m.study_instance_uid FROM medistore.ltsm_study_media m
                               WHERE m.media_id = '1832716093');
--   2) modifica (nessun COMMIT: controlla le righe, poi COMMIT a mano)
UPDATE medistore.didb_studies SET study_need_backup = 'Y'
WHERE study_need_backup IS NULL
  AND study_instance_uid IN (SELECT m.study_instance_uid FROM medistore.ltsm_study_media m
                             WHERE m.media_id = '1832716093');
-- COMMIT;
```

### Domanda: assegna il presidio 999 agli studi senza sito della macchina SRV-GEVPOINT01
```sql
-- WRITE | Riassegna site_id da 0 a 999 per una modalità
--   1) anteprima
SELECT study_db_uid, accession_number, original_storing_ae, site_id
FROM medistore.didb_studies
WHERE site_id = 0 AND original_storing_ae = 'SRV-GEVPOINT01';
--   2) modifica (nessun COMMIT: controlla le righe, poi COMMIT a mano)
UPDATE medistore.didb_studies SET site_id = 999
WHERE site_id = 0 AND original_storing_ae = 'SRV-GEVPOINT01';
-- COMMIT;
```

### Domanda: escludi dal backup lo studio con accession 3035927901 (operatore Federico)
```sql
-- WRITE | Trattiene a mano uno studio dal backup (flag = iniziale operatore)
--   1) anteprima
SELECT study_db_uid, accession_number, study_need_backup
FROM medistore.didb_studies
WHERE accession_number = '3035927901' AND study_need_backup = 'Y';
--   2) modifica (nessun COMMIT: controlla le righe, poi COMMIT a mano)
UPDATE medistore.didb_studies SET study_need_backup = 'F'
WHERE accession_number = '3035927901' AND study_need_backup = 'Y';
-- COMMIT;
```

### Domanda: lo studio 3035927901 è rimasto OFFLINE, rimettilo NEARLINE
```sql
-- WRITE | Corregge study_availability da OFFLINE a NEARLINE per un accession
--   1) anteprima
SELECT study_db_uid, accession_number, study_availability, study_online
FROM medistore.didb_studies
WHERE study_availability = 'OFFLINE' AND accession_number = '3035927901';
--   2) modifica (nessun COMMIT: controlla le righe, poi COMMIT a mano)
UPDATE medistore.didb_studies SET study_availability = 'NEARLINE'
WHERE study_availability = 'OFFLINE' AND accession_number = '3035927901';
-- COMMIT;
```

### Domanda: cancella tutti gli studi vecchi
```sql
-- IMPOSSIBILE: serve un criterio di filtro preciso (quali studi, quale data, quale sorgente). Non genero DELETE senza WHERE.
```
