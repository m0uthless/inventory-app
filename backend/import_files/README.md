# backend/import_files/

Cartella di lavoro locale per file da dare in pasto ai comandi di import
manuale (es. `import_inventory`, `import_customers`, `import_sites`,
`import_contacts` in `crm/management/commands/` e
`inventory/management/commands/`).

**Nessun file dentro questa cartella deve mai essere committato.**

0.9.1 (WP-04, `archie-secretartifacts` — audit 2026-08-19, SEC-009): un
`inventory.xlsx` dimenticato qui conteneva hostname, IP e credenziali
VNC/OS reali di clienti — è finito in un archivio del progetto condiviso
con terzi per un audit. Rimosso in Fase 0 di questa roadmap; se serve di
nuovo un file di esempio per test/import, tienilo **fuori da Git**:

- `.gitignore` esclude `backend/import_files/*` (eccetto questo README e
  `.gitkeep`)
- se prepari uno zip manuale del progetto (non tramite `git archive`),
  usa `scripts/make-safe-archive.sh` invece di `zip -r`/`tar` diretti
  sulla working directory: quello script include solo i file tracciati
  da Git e fa un controllo post-hoc su pattern di file vietati

Se ti serve un file di esempio per testare l'import, usa dati sintetici
(hostname/IP/credenziali finte), mai un export reale da produzione.
