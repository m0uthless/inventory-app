# Restyle "Campo sterile" — TODO

Aggiornato: 2026-11-05 · Ramo: `restyle` · Riferimento: `design-previews/h-base.html` (Issue), `design-previews/po-base.html` (Purchase Order).

Legenda: **[UI]** solo frontend · **[BE]** serve backend · **[DEC]** serve una decisione.

## Pagina Issue

### Presente nell'anteprima, non ancora nell'app
- **[BE] Prossimo passo** (chi, cosa, quando, "Fatto"): non esiste un campo sulla issue.
- **[BE] Procedura dalla Wiki** con spunte e "Cerca nella Wiki": manca il collegamento issue ↔ articolo.
- **[BE] Dove intervenire completo**: referente di reparto con telefono, device con seriale, credenziali bloccate. Oggi mostriamo cliente, sito, inventario collegato e ServiceNow.
- **[BE] Scheda Allegati**: le issue non hanno allegati (solo i task di area hanno `drive_files`).
- **[BE] "Visibile al cliente nel Portale"** su commenti e allegati, etichette Cliente/Interno nella cronologia.
- **[BE] Indicatore "Entro SLA"** (percentuale e obiettivo): nessun dato SLA. Al suo posto: Tempo medio di chiusura e Risolte negli ultimi 30 giorni.
- **[BE] Variazione del tempo di risoluzione** ("−0,4 g sulla settimana prima"): `/issues/summary/` dà solo la media.
- **[BE] "+ Salva vista"**: fatto, ma le viste sono salvate nel browser (per utente e pagina). Per averle su tutti i dispositivi serve salvarle sul server.
- **[UI] Avviso "nessun inventario collegato"** (triangolo accanto al titolo nella vecchia tabella): tolto dalla riga come nell'anteprima; resta nel pannello ("Nessun inventario collegato · Collega un inventario").
- **[UI] Ricerca Ctrl K a finestra** con risultati raggruppati (clienti, siti, device, issue, azioni): oggi Ctrl K porta il cursore nel campo e Invio apre la pagina Ricerca.

### Presente nella UI di prima, tolto o non ancora ridisegnato
- **[DEC] Grafico "Andamento issue"** (aperte/risolte, giornaliero/settimanale/mensile): sostituito dai mini grafici negli indicatori. Da decidere se serve ancora, magari in Dashboard.
- **[UI] Dialogo "Nuova issue / Modifica"** (`IssueDialog`): funziona, ma è il modulo vecchio con il nuovo tema, non ridisegnato.
- **[UI] Dialogo "Collega a inventory"**: idem.
- Colonne extra di prima (Categoria, Commenti, Data chiusura, Giorni passati): restano a destra di Scadenza, raggiungibili scorrendo o dal menu colonne.

## Pagina Purchase Order

- **[BE] "Da fatturare" in `summary`**: oggi calcolato dal frontend leggendo le righe dell'anno.
- **[DEC] Margine**: calcolato in pagina (importo − costi), non è un campo.
- **[UI] Dialogo Nuovo/Modifica PO** (`PurchaseOrderDialog`) e **dialogo di avanzamento** (`PurchaseOrderTransitionDialog`): funzionano, non ridisegnati (l'anteprima aveva un dialogo breve con solo i campi del passo).
- **[UI] Totali nel piè** ("Totale € … · Costi sostenuti € …" dell'anteprima): non ancora.
- **[UI] Ripristino multiplo dal cestino**: la logica c'è, ma la pagina non ha più un selettore di vista "cestino" visibile (va riesposto, es. come scheda o voce di menu).

## Comportamenti globali

- Pannelli di dettaglio (scheda flottante e drawer "campo"): si chiudono con un clic fuori e con Esc. I clic dentro menu, popover, dialoghi e messaggio con Annulla aperti dal pannello non lo chiudono.
- **[UI] Mappa Leaflet** dei drawer Clienti/Siti: caricata da unpkg.com. Senza internet la richiesta resta appesa; valutare di includerla nel bundle.

## Pagina Clienti

Fatta su `design-previews/c-base.html` (variante A · Scheda).

- **[BE] Lettura della password VPN non registrata nell'audit**: l'anteprima diceva "ogni visualizzazione resta nel log"; oggi `GET /customers/<id>/vpn/` restituisce la password a chi ha il permesso senza registrare nulla. Nell'app la frase è stata tolta.
- **[UI] Drawer cliente vecchio** (`CustomerDrawer`): ancora usato da Site Repository e Profilo.
- **[UI] Credenziali degli inventari nella scheda Inventari**: l'anteprima mostrava utenza e password per riga; l'elenco API non le include (servono la scheda dell'inventario e il permesso `inventory.view_secrets`).
- **[UI] Città e indirizzo**: stanno nei campi personalizzati, quindi si modificano solo da "Modifica", non sul posto. Tag non mostrati nel pannello.
- **[UI] Site Repository dal pannello**: non c'è un collegamento diretto (la pagina non accetta il cliente nell'URL).

## Struttura e tema

- **[DEC] Palette Blu e Indaco**: implementate, non selezionabili (`selectable: false` in `themeRegistry.ts`).
- **[UI] Modalità scura**: alcune pagine non migrate hanno ancora colori chiari scritti nel codice (es. `#f8fafc`, `grey.50`).
- **[UI] Pagina di login**: invariata.
- **[UI] Dashboard**: widget e card con gradienti (`BirthdaysCard`, `ContributorCard`, `QuickActionsPairCard`, …).
- **[UI] PDF dei Piani di manutenzione**: intestazione a gradiente.
- **[UI] `useDataGridZebraSx`** e alcune card hanno ancora gli stili del tema precedente nelle pagine non migrate.

## Pagine da migrare (ordine deciso)

1. Clienti, Siti, Inventari, Contratti, Manutenzione (testata, indicatori, viste, filtri da intestazione).
2. Le altre pagine.

I pannelli di dettaglio di tutti i moduli sono già nello stile nuovo (`DrawerShell`/`DrawerParts` con aspetto "campo").

## Fase 2

- **Portal** (`frontend-portal/`): restyle dopo Archie; oggi resta volutamente invariato.
