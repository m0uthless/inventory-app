# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
il versionamento segue [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

### Fixed
- conflitto --version con flag builtin Django in create_changelog_entry, rinominato in --release-version

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
