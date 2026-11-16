# Restyle frontend Archie — sintesi di progetto

Data: 2026-11-04 · Stato: **decisioni aperte risolte, in attesa di conferma finale** · Ramo: `restyle`
Riferimento visivo: `design-previews/h-base.html` (Issue) e `design-previews/po-base.html` (Purchase Order).

## 1. Per chi e per cosa

- **Chi:** tecnici e sistemisti Biotron in sessioni lunghe da desktop (tabelle, filtri, pannelli di dettaglio) e, sul campo, da telefono o tablet. A seguire l'amministrazione (Contratti, Purchase Order, Piano Ferie, Rimborsi).
- **Modalità:** Operate. Il successo è chiudere un compito (trovare, aggiornare, far avanzare) in pochi passi, non "guardare" l'interfaccia.
- **Problema di oggi:** il tema attuale ("The Control Panel": Inter ridotto a 11,2px, app bar ottanio, sidebar notte, gradienti e chip pastello ovunque) è denso ma rumoroso: tanti accenti, poca gerarchia, KPI a gradiente, drawer che restringono la tabella, filtri sparsi tra toolbar e colonne.

## 2. Risultato atteso e prova

- Ogni lista si legge e si filtra da un solo posto (intestazioni di colonna), le viste salvate coprono i casi frequenti, il dettaglio si apre sopra la tabella senza perdere il contesto.
- Le modifiche ai valori di gestione si fanno sul posto, si salvano subito, si possono annullare e finiscono nell'audit.
- Prova: le due pagine pilota (Issue, Purchase Order) coprono gli stessi compiti di oggi con meno clic e superano la catena di verifica senza regressioni.

## 3. Direzione scelta (dalle anteprime approvate)

**"Campo sterile"**: superfici neutre e calme, il colore entra solo per azione, selezione e stato.

- **Palette:** tre palette selezionabili per utente — **Verde chirurgico** `#1f6b5c` (predefinita), **Blu clinico** `#1f5f99`, **Indaco** `#4a48a6` — ognuna con neutri tinti nella propria tinta e versione **chiara e scura**. Errore, avviso e successo sono uguali in tutte le palette. Scala sequenziale a una tinta per dati ordinali (priorità, avanzamento).
- **Tipografia:** Geist (testo) e Geist Mono (codici, ID, numeri di caso), font locali. Base 13px, niente più riduzione globale 0.8 di MUI.
- **Forma:** raggio 6–8px su controlli, 10–12px su riquadri e schede flottanti; bordi sottili al posto di ombre e gradienti. Ombra solo su ciò che galleggia (pannello, menu, dialoghi).
- **Struttura (shell):**
  - **Sidebar unica (A):** logo ARCHIE + Biotron, voci raggruppate (Operatività, Anagrafiche, Conoscenza, Amministrazione, Sistema), comprimibile a icone, pannello a scomparsa su mobile.
  - **Topbar a cornice (B):** sidebar e topbar condividono il fondo tinto e incorniciano il contenuto, un foglio con l'angolo arrotondato. In topbar solo elementi globali: ricerca **Ctrl K** centrata, notifiche, profilo.
- **Pagina lista (modello Issue):** testata (titolo + azione primaria) → fascia **indicatori** comprimibile → riquadro con **viste a schede** → riga filtri attivi + lente (ricerca per colonna) + esporta + colonne → tabella con **ordinamento e filtro dall'intestazione** (imbuto visibile al passaggio).
- **Pannello di dettaglio (modello scheda intervento):** **scheda flottante sovrapposta** alla tabella (non la restringe), testata scura di marca con linguette Dettagli / Attività / Allegati (l'attiva prende il colore del corpo), navigazione precedente/successivo (J/K), Proprietà **comprimibili** in cima, valori modificabili sul posto con salvataggio immediato + **Annulla**, modulo completo da "⋯ → Modifica tutti i campi".
- **Conseguenza implementativa:** si rifà il tema MUI e si creano pochi componenti condivisi nuovi; le pagine si migrano una alla volta sopra questi componenti.

## 4. Perimetro

- **Fase 1 (questo ramo):** `frontend/` — tema, shell, componenti condivisi, pagine pilota **Issue** e **Purchase Order**, poi migrazione progressiva delle altre pagine.
- **Fase 2 (dopo):** `frontend-portal/`. In fase 1 il Portal **non deve cambiare aspetto**: i componenti in `shared/src/ui` toccati dal restyle restano retro-compatibili (nuove varianti opt-in o componenti nuovi), e il tema del Portal resta il suo.
- **Fuori perimetro:** login (ritocco minimo per coerenza), nessuna modifica di permessi, scoping Portal, crittografia, flussi di dominio.
- **Anti-obiettivi:** niente gradienti decorativi, niente KPI "a cartolina", niente nuovi colori per singolo modulo, nessuna funzione inventata nelle pagine pilota.
- **Intoccabili:** i valori esadecimali di `pianoFerieShared.ts`; i colori di riconoscimento esistenti (es. `committenteColor`) restano come dato, cambia solo la resa.

## 5. Stati e volumi realistici

- Liste da poche righe a migliaia (paginazione server di `ServerDataGrid` invariata); titoli lunghi (2 righe max), clienti con nomi lunghi, campi vuoti (`—`), righe nel cestino.
- Stati da coprire per ogni pagina: caricamento (scheletri), vuoto vero, vuoto da filtri ("Azzera filtri"), errore, sola lettura per permessi mancanti (azione disattivata con motivo), segreti nascosti senza permesso.
- Pannello: issue/PO con e senza documenti, senza procedura Wiki ("Cerca nella Wiki"), scadute, senza scadenza.

## 6. Interazione e layout

- Gerarchia: titolo pagina → indicatori → viste → tabella; nel pannello: proprietà (chiuse) → prossimo passo / flusso → contenuto.
- Responsive: ≥1180px pannello sovrapposto a destra; sotto 860px sidebar a scomparsa, tabella a card, pannello a tutto schermo, indicatori in striscia scorrevole. Gli indicatori si adattano alla larghezza della colonna (container query), non della finestra.
- Feedback: salvataggi con messaggio "… · salvato" + Annulla (6s); passaggi di stato a più campi con dialogo breve (es. "Registra PO ricevuto").
- Tastiera: Ctrl K ricerca, J/K scorrono le righe nel pannello, Esc chiude menu → pannello. Focus visibile ovunque, `aria-label` sulle azioni a icona (regola `docs/ui-standards.md`).
- Movimento: solo transizioni brevi (≤200ms) su pannello, sidebar, menu; rispetto di `prefers-reduced-motion`.

## 7. Vincoli e decisioni aperte

**Vincoli tecnici**
- React 19 + MUI v7 + MUI X DataGrid 8: il restyle passa da `createTheme` (palette, tipografia, `shape`, `components` overrides) e dai token in `frontend/src/theme/`. Colori sempre via `useTheme()`, mai import statico del tema.
- Preferenza palette e chiaro/scuro salvate per utente: si estende `UserProfile.theme` (oggi solo `default`) con le chiavi `verde` / `blu` / `indaco` e si aggiunge la modalità chiaro/scuro/sistema → **una migrazione** `AlterField` (choices) + campo nuovo.
- Catena di verifica obbligatoria a ogni passo (tsc, build, lint ≤ 27, vitest, check, makemigrations).

**Lavori backend separati (non bloccano tema e shell)**
- Issue: salvataggio campo per campo già possibile via PATCH; da aggiungere "prossimo passo", collegamento a procedura Wiki con spunte, visibilità dei commenti e allegati nel Portale. Ogni ViewSet nuovo estende `IsInternalOrPortalDedicatedApp`.
- Purchase Order: conteggio "da fatturare" in `summary`; soglie "da sollecitare" da decidere; margine calcolato in frontend.
- Ricerca Ctrl K: usa l'endpoint di ricerca globale esistente.

**Decisioni prese (2026-11-04)**
1. **Chiaro/scuro:** predefinito **chiaro**; lo scuro si attiva dal profilo utente (opzione "segue il sistema" disponibile ma non predefinita).
2. **Palette:** si implementano tutte e tre (Verde, Blu, Indaco) nel registro temi, ma **per ora è attiva solo Verde**: Blu e Indaco non compaiono nella scelta del profilo finché non si decide di aprirle.
3. **Soglie "da sollecitare" PO:** da inviare oltre **7** giorni, in attesa del PO oltre **21**, da fatturare oltre **14**.
4. **Ordine di migrazione:** Issue e Purchase Order (pilota), poi **Clienti, Siti, Inventari, Contratti, Manutenzione**, poi il resto.

## 8. Piano di consegna (dopo conferma)

1. `frontend/DESIGN.md` riscritto sulla nuova direzione (token + regole), sostituisce "The Control Panel".
2. Tema MUI + token + font Geist; preferenza palette/modalità per utente (migrazione).
3. Shell: sidebar A, topbar B, ricerca Ctrl K.
4. Componenti condivisi: fascia indicatori, viste a schede, filtri/ordinamento in intestazione per `ServerDataGrid`, pannello flottante con proprietà modificabili e annulla.
5. Pagina Issue, poi Purchase Order.
6. Migrazione delle altre pagine, una per commit, con verifica visiva a 1440px e 390px in chiaro e scuro.
