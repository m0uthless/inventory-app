---
name: ARCHIE
description: Biotron's internal operational platform — calm, neutral surfaces where color only marks action, selection and state.
colors:
  surgical-green: "#1f6b5c"
  surgical-green-hover: "#18584c"
  surgical-green-ink: "#ffffff"
  steel-canvas: "#eef2f1"
  paper: "#ffffff"
  paper-2: "#f5f8f7"
  frame: "#e3eae8"
  hairline: "#d5dedb"
  hairline-strong: "#b9c7c3"
  ink: "#15201e"
  ink-muted: "#5b6b67"
  ink-faint: "#66766f"
  sterile-field: "#e2f0eb"
  neutral-tint: "#edf1f0"
  band: "#17463c"
  band-2: "#1f5a4d"
  success: "#2e7d4f"
  success-tint: "#e3f3e9"
  warning: "#9a5b00"
  warning-tint: "#fbefd9"
  error: "#c2362b"
  error-tint: "#fbe5e2"
  info: "#2f5f9e"
  info-tint: "#e5edf8"
  seq-1: "#b5d4cb"
  seq-2: "#6aa898"
  seq-3: "#2f7f6d"
  seq-4: "#164d42"
  dark-surgical-green: "#5fb8a3"
  dark-canvas: "#0f1615"
  dark-paper: "#151e1c"
  dark-paper-2: "#1a2523"
  dark-frame: "#121a19"
  dark-hairline: "#2a3734"
  dark-ink: "#e4ecea"
  dark-ink-muted: "#93a4a0"
  dark-sterile-field: "#183a33"
  dark-band: "#123a32"
  clinical-blue: "#1f5f99"
  indigo: "#4a48a6"
typography:
  page-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  panel-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.3
  kpi-value:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 550
  caption:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  full: "999px"
spacing:
  unit: "4px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.surgical-green}"
    textColor: "{colors.surgical-green-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 12px"
  button-primary-hover:
    backgroundColor: "{colors.surgical-green-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
  icon-button:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    size: "32px"
  status-badge:
    rounded: "5px"
    height: "22px"
    typography: "{typography.label}"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
  kpi-tile:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  table-header:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink-muted}"
    height: "36px"
  table-row:
    height: "40px"
  table-row-selected:
    backgroundColor: "{colors.sterile-field}"
  sidebar:
    backgroundColor: "{colors.frame}"
    width: "232px"
  topbar:
    backgroundColor: "{colors.frame}"
    height: "52px"
  drawer-card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    width: "460px"
  drawer-head:
    backgroundColor: "{colors.band}"
    textColor: "{colors.surgical-green-ink}"
---

# Design System: ARCHIE

> Replaces "The Control Panel" (Inter, 0.8 MUI density, ottanio app bar, night-teal sidebar, gradients). Decided on the `restyle` branch; visual reference in `design-previews/h-base.html` (Issue) and `design-previews/po-base.html` (Purchase Order). Brief: `docs/superpowers/specs/2026-11-04-restyle-design.md`.

## Overview

**Creative North Star: "Campo sterile"**

The surgical sterile field: a calm, neutral surface where only what matters is coloured. ARCHIE is an operating tool for technicians who spend whole days in tables and detail panels, so the surfaces stay quiet and the colour turns on for exactly three reasons: an action you can take, a thing you selected, a state you must notice. Everything else is ink on paper, separated by hairlines rather than shadows.

Density stays high but comes from structure, not from shrinking: 13px Geist at real size, 40px rows, filters and sorting living in the column headers instead of extra toolbars, a record window that opens wide and centred over the dimmed list instead of squeezing it (the floating detail card is being phased out on desktop). The app is framed: sidebar and topbar share one tinted frame and the content sits inside it as a sheet with a rounded corner. Brand colour concentrates in two places only — the primary action and the dark band at the top of the detail card.

Light is the default; dark is a first-class alternative built from the same tokens, not an inversion.

**Key Characteristics:**
- Neutral tinted surfaces; one hue per palette; status colours shared by all palettes.
- Geist / Geist Mono; hierarchy by weight and position, not by size jumps.
- Hairlines instead of shadows; shadow only on what floats.
- Lists filtered and sorted from column headers; saved views as tabs.
- Detail as a record window over the list (Band header, main column + person/summary rail, one save bar for all pending edits); pages not yet migrated still use the floating card with in-place edits that save at once and can be undone.

## Colors

One hue per palette, neutrals tinted towards that hue, semantic colours identical everywhere.

### Primary
- **Surgical Green** (#1f6b5c / dark #5fb8a3): primary buttons, focus ring, active tab underline, selected row edge, links. The default and, for now, the only palette enabled for users.
- **Clinical Blue** (#1f5f99) and **Indigo** (#4a48a6): alternative palettes, implemented in the theme registry with their own tinted neutrals and dark variants but **not selectable yet**. In Clinical Blue the `info` colour shifts to a teal (#1d6f86) so "Aperta" never reads as the primary.

### Neutral
- **Steel Canvas** (#eef2f1): page background behind the content sheet.
- **Frame** (#e3eae8): sidebar and topbar, together forming the frame.
- **Paper** (#ffffff) / **Paper 2** (#f5f8f7): content surfaces, table header, hover.
- **Hairline** (#d5dedb) / **Hairline Strong** (#b9c7c3): every separator and border; strong for inputs and hover.
- **Ink** (#15201e), **Ink Muted** (#5b6b67), **Ink Faint** (#66766f): text levels, all ≥ 4.5:1 on Paper.
- **Sterile Field** (#e2f0eb): selection — selected row, active nav item, active filter token, pressed segment.
- **Band** (#17463c → #1f5a4d): the dark brand band of the detail card header (and of the optional banded topbar).

### Semantic
Success #2e7d4f, Warning #9a5b00, Error #c2362b, Info #2f5f9e, each paired with its tint (#e3f3e9, #fbefd9, #fbe5e2, #e5edf8). Always tint background + full-tone text, never colour alone: status badges carry a shape mark (filled dot = open, half = in progress, ring = waiting, tick = resolved, dash = closed) and workflow badges carry step ticks.

### Sequential
Seq 1–4 (#b5d4cb → #164d42, reversed lightness in dark): ordinal data only — priority, workflow progress. Darker = more urgent / further along.

### Named Rules
**The Three Reasons Rule.** Colour appears only for action, selection or state. A coloured element that is none of these goes back to ink.

**The Shared Status Rule.** Semantic colours never change with the palette and are never used for series or decoration.

**The Single Source Rule.** Colours come from `theme.palette` / `useThemeTokens()` via `useTheme()`. No hex in pages. Sole exception: `pianoFerieShared.ts`, untouched.

## Typography

**Body Font:** Geist (self-hosted, 300–800 variable). **Mono Font:** Geist Mono, for IDs, case numbers, PO and invoice numbers, IPs, serials, credentials.

**Character:** one quiet sans at real size; hierarchy from weight (400 / 550 / 650) and placement.

### Hierarchy
- **Page title** (650, 22px, -0.015em): one per page, left of the primary action.
- **Panel title** (650, 18px): record title in the detail card.
- **KPI value** (650, 24px, tabular): indicator tiles only; 18–20px on narrow columns.
- **Body** (400, 13px, 1.5): default text, table cells.
- **Body small** (400, 12px): secondary lines, meta, helper text.
- **Label** (550, 12px): buttons, column headers, field labels, tabs.
- **Caption** (500, 11px): counts, timestamps, hints.
- **Mono** (500, 12px): copyable values.

### Named Rules
**The Sentence Case Rule.** No uppercase anywhere except the tiny "ORA" marker on timelines.

**The Tabular Numbers Rule.** Amounts, counts, dates and durations use tabular figures and right-align in tables.

## Layout

- **Shell:** sidebar 232px (64px collapsed, icons only, counts as corner badges); topbar 52px with global search centred (520px, Ctrl K), notifications and profile on the right. Sidebar and topbar share the Frame colour; the workspace is a Steel Canvas sheet with a 14px top-left radius and a hairline edge.
- **Content:** padding 20px 24px; page head (title + primary action) → KPI strip (optional, collapsible) → panel with saved-view tabs, filter row and table.
- **Spacing:** 4px unit; common steps 4 / 8 / 12 / 16 / 24.
- **Record window:** `ui/campo/RecordModal` — centred over the dimmed list, `min(1120px, 100vw − 48px)` wide, 40px from the top, body on the canvas colour with 16px padding; content as a main column + 320px rail; full screen below 900px (md).
- **Detail card (legacy):** floats over the table (never resizes it): 460px, inset 12px from the workspace edges; 760px variant when a side summary is needed. Being replaced page by page by the record window.
- **Responsive:** < 1180px the card stays an overlay; < 860px sidebar becomes an off-canvas sheet, tables become card lists, the detail card goes full screen, the KPI strip becomes a horizontal snap strip. KPI tiles respond to their container width, not the viewport.

## Elevation & Depth

Flat at rest. Depth from tonal layers (Canvas → Paper → Paper 2) and hairlines.

### Shadow Vocabulary
- **Float** (`0 12px 32px -12px rgb(16 40 34 / .22), 0 2px 6px rgb(16 40 34 / .06)`; dark `0 16px 40px -12px rgb(0 0 0 / .6)`): detail card, menus, popovers, dialogs, command palette, toast.
- **Focus** (`0 0 0 3px` primary at 28%): every focusable control.

### Named Rules
**The Earned Shadow Rule.** Only things that float over content get a shadow. No card shadows, no hover shadows, no gradients except the brand band.

## Shapes

Radius 6px on controls (buttons, inputs, icon buttons, menu items), 5px on badges, 8px on panels, tiles and drawer-internal blocks, 10–12px on floating cards and dialogs, full only for avatars and dots. Borders always 1px hairline; accents are fills or inner edges clipped by the container, never thick borders on rounded boxes.

## Components

### Buttons
- **Primary:** Surgical Green fill, white label 550, 32px tall, radius 6px. One per area (page head, card footer, dialog).
- **Secondary:** Paper with hairline; hover Paper 2 + strong hairline.
- **Ghost:** no border, Ink Muted; for cancel and tertiary actions.
- **Icon button:** 32px square, transparent, Ink Muted; hover Paper 2 + hairline. Always `ActionIconButton` with `aria-label` and tooltip.
- **Disabled:** 45% opacity with a title explaining why.

### Status & workflow badges
22px, radius 5px, tint + tone, shape mark before the label. Purchase Order states use a four-tick progress mark. Priority uses a four-bar signal mark (Critica in Error tone).

### KPI strip
Up to four tiles + one small widget (segmented bar or meter). Tile: label 12/550 muted, value 24/650, one line of context; optional 84×30 sparkline (2px line, 10% area, end dot, hover tooltip). Tiles that map to a view are buttons and open it. The strip is collapsible and remembered per user.

### Saved views
Tabs inside the panel header, 44px, label + count chip; active tab has a 2px primary underline; "+ Salva vista" at the end.

### Data table (`ServerDataGrid`)
Header 36px on Paper 2, label 12/550; each header has a sort button (arrow only when active) and a funnel button aligned right, visible on hover/focus or when a filter is active. Funnel opens a popover: ascending/descending, checkbox list with counts (or date buckets / "contains" field), Remove / Apply. Active filters appear as removable tokens above the table with "Azzera filtri". Optional per-column search row toggled by the search icon. Rows 40px, hover Paper 2, selected Sterile Field with a 3px primary inner edge. Footer: "n di N", totals where meaningful.

### Record window (signature, from 17/11/2026)
Chosen on the users page (preview `design-previews/ud-base.html`, variant D) and the standard for every page that opens a record; pages migrate one at a time, preview first. `ui/campo/RecordModal`: a wide window centred over the dimmed list. **Band header** (#17463c → #1f5a4d, radius 12px): avatar or type tile, title 20/650 in white, subtitle at 74% white, tags as translucent chips, then "3 di 12" with previous/next, actions as translucent outlined buttons (`bandButtonSx`), close × top right. **Body**: no tabs — everything for the record is visible at once as `RecordSection` panels (paper, hairline, radius 10px, title 14/650 with an optional hint and end action); a wide main column (the domain block: for users the permission matrix) and a 320px rail (person/summary, roles, recent activity, account actions). **Saving**: edits are local until the user saves; a dark sticky bar "N modifiche da salvare · Annulla · Salva le modifiche" appears at the bottom only when something is pending; leaving (close, Esc, click outside, previous/next) with pending edits asks for confirmation. **Permission matrix** (`features/users/PermMatrix`): one row per module, "Da dove" column, four level columns with a filled dot up to the level and a ringed dot on the choice; levels below the group's floor are disabled.

### Detail card (legacy)
Floating card over the list: dark Band header with ID, status badge, position "4 di 12", previous/next (J/K), "⋯" menu and close; title 18/650 in white; tabs as folder tabs — the active one takes the body colour. Body (Dettagli): **Proprietà** row collapsed by default (+/−, summary of two key values), expanded as a compact two-column label/value list where each value is a button that opens a menu or an inline input; changes save immediately, show a "… · salvato" toast with **Annulla** for 6s and are written to activity/audit. Then the domain block (next step + timeline for issues; workflow steps + amount for purchase orders), then supporting sections. Attività: filter (Tutto / Commenti / Modifiche), events and comment bubbles (customer comments tinted info), sticky composer with "Visibile al cliente nel Portale". Allegati / Documenti: drop zone, grouped file rows with type tile, internal/visible tag. Footer: secondary action left, primary step action right. "Modifica tutti i campi" in the ⋯ menu opens the full form.

### Inputs / Fields
Outlined, 34px, radius 6px, Hairline Strong; focus = primary border + focus ring; error = Error border + 12px message below. Mono for codes.

### Navigation
Sidebar on Frame: brand block (mark + ARCHIE + Biotron S.p.A.), grouped items (11px faint group labels), 32px items; active = Paper fill + primary hairline + primary icon; count chips right. Topbar on Frame: centred search field (Paper, hairline, Ctrl K hint), bell with dot, profile button with avatar.

### Feedback
Toast bottom-centre, ink background, with tick and optional Annulla. Multi-field state transitions use a short dialog (420px) asking only what that step needs.

## Do's and Don'ts

### Do:
- **Do** read colours through `useTheme()` / theme tokens; switch palette and mode via the theme registry.
- **Do** keep filters and sorting in the column headers and saved views in tabs.
- **Do** open a record in the record window (`RecordModal`) over the dimmed list; the floating card remains only on pages not yet migrated.
- **Do** save management fields in place with an undo toast and an audit entry.
- **Do** use Geist Mono and a copy affordance for anything a technician might paste elsewhere.
- **Do** check every screen at 1440px and 390px, light and dark.

### Don't:
- **Don't** add gradients, decorative shadows or coloured KPI "postcards".
- **Don't** give a module its own accent colour; identity colours (e.g. committente dots) are data, shown as small swatches.
- **Don't** shrink the theme globally to gain density; remove chrome instead.
- **Don't** put thick accent borders on rounded containers.
- **Don't** import the theme statically in components, or touch `pianoFerieShared.ts` colours.
- **Don't** change the Portal's look in phase 1: shared components stay backwards compatible.
