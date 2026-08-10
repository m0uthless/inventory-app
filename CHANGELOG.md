# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
il versionamento segue [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

### Fixed
- uso di displayname invece che name relativo al site per import inventory

### Changed
- aggiunto supporto a maggiore dimensione dei widget notizie, task, task area e issues
- cambiata navigabilità di site repository da città a provincia per un maggior ordinamento
- aggiunta filtra tipo po, modifica struttura datagrid purchase order
- CRM — Coerenza visiva dei drawer di dettaglio: il drawer Inventory ora usa lo stesso componente condiviso (hero con tab integrate, sezioni standard) di Customer/Site/Monitor, eliminando le differenze di stile (tab bar, larghezza, azioni) tra i moduli
- Aggiunta in attesa da su issues, aggiuunto link a issue, minor fix su issues

### Added
- supporto ai temi e aggiunta primo tema secondario navy
- supporto alla procincia in customer e sites, con vista site-repository divisa per provincia e citta
- Site Repository — Rimosso il bottone di modifica rapida sulla riga cliente (resta disponibile dal menu contestuale); il pulsante note ora apre un modal con il testo completo invece del tooltip troncato; aggiunta la colonna Modello nell'elenco inventario. Nuovo: cartina d'Italia cliccabile per regione/provincia per saltare rapidamente al cliente cercato.

## [0.8.1] - 2026-08-08

## [0.8.0] - 2026-08-08

### Added
- Baseline changelog riscritto da zero, allineato alla versione attualmente in produzione.
