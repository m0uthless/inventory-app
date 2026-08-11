# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
il versionamento segue [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

### Added
- **[customers]** Colonna Provincia nella datagrid Customers (punto 6).
- **[customers]** Campo `Customer.province` come campo strutturato (sostituisce la chiave JSON in custom_fields), con migrazione `0010_customer_province.py` (punto 4).
- **[profile]** Selezione tema cross-device dal profilo utente (punto 1).
- **[site-repository]** Colonna Modello in `InventoryInlineList`, con aggiunta di `model` a `InventoryListSerializer`.
- **[purchase-order]** Toggle filtro Tutti/Ordinario/Extra, collegato sia alla lista che alla KPI `summary/` (nuovo parametro `?kind=`).
- **[dashboard]** Mappa Italia con confini reali ISTAT (choropleth SVG con drill-down province/capoluoghi), al posto del primo tentativo a cartogramma a griglia (scartato).
- **[servicenow]** Export PDF statistiche ServiceNow (endpoint `stats-export-pdf` + pulsante in pagina).
- **[ausl-bo]** Riordinamento colonne ↑↓ e upload certificato .p12 WiFi (testato e2e).

### Changed
- **[crm]** `InventoryDrawer` riscritto da zero per allinearsi al pattern condiviso `DrawerShell`/`DrawerSection`/`DrawerFieldList`, mantenendo le specificità (targa SVG K-Number, password auto-hide 30s via `SecretRow`, warning issue attiva, pulsanti di navigazione).
- **[customers]** Campi custom un-nested (modalità inline) in `CustomerDialog`.
- **[dashboard]** Range dimensioni widget (punto 3).
- **[site-repository]** Rimosso pulsante di modifica dalla riga cliente (resta accessibile solo dal menu contestuale).
- **[site-repository]** Pulsante nota: da tooltip troncato a modale con testo completo.
- **[crm]** Rimossi tutti i pulsanti azione (Apri cliente, Apri sito, Apri inventario, Lista filtrata) da `ContactDrawer` e `InventoryDrawer`, senza sostituzione.
- **[crm]** Redesign visivo `InventoryDrawer`: accent colore per categoria con bordo laterale (`DrawerSection` esteso con prop `accent`: info/secondary/warning/success/neutral), angoli completamente arrotondati.
- **[dashboard]** Widget meteo (`WeatherHeroCard`): due iterazioni di redesign con landmark proposte e scartate entrambe — ripristinata la versione originale, rimandato a una futura sessione con Claude Design.

### Fixed
- **[purchase-order]** Bug MUI X DataGrid: rimosso `headerAlign: 'right'` dalle colonne Importo/Costi sostenuti (causava il menu a tre puntini spostato a sinistra dell'etichetta).
- **[crm]** Incoerenza font tra label credenziale e campi password in `SecretRow` (allineato a `variant="caption"` / `color: text.disabled` come `DrawerFieldRow`).
- **[scripts]** `fix-push.sh`: non chiede più il numero di versione, lo calcola automaticamente come patch bump (es. 0.8.0 → 0.8.1).

### Security
- Nessuna modifica specifica di sicurezza in questo periodo.

## [0.8.0] - 2026-08-08

### Added
- Baseline changelog riscritto da zero, allineato alla versione attualmente in produzione.
