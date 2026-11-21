/* Report PDF stampabile di un piano di manutenzione (spostato da pages/MaintenancePlans.tsx, invariato). */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { scheduleText } from './mtModel'
import type { Theme } from '@mui/material/styles'
import { escapeHtml } from '@shared/utils/html'
import type { PlanRow } from '../../pages/maintenanceTypes'
import { fetchAll } from '../../api/fetchAll'

export async function generatePlanPdf(plan: PlanRow, theme: Theme, onPopupBlocked: () => void) {
  // 1. Rapportini del piano
  let events: any[] = []
  try {
    events = await fetchAll('/maintenance-events/', { plan: plan.id, ordering: '-performed_at' })
  } catch { /* non bloccante */ }

  // 2. Inventory filtrati per i tipi previsti dal piano (campo `type` del filterset)
  let inventories: any[] = []
  try {
    const typeIds: number[] = plan.inventory_types ?? []
    if (typeIds.length > 0) {
      // Una chiamata per tipo (il filterset accetta un solo `type` per chiamata)
      const results = await Promise.all(
        typeIds.map(tid =>
          fetchAll('/inventories/', { customer: plan.customer, type: tid, ordering: 'knumber' })
        )
      )
      inventories = results.flat()
    }
  } catch { /* non bloccante */ }

  const RESULT_IT: Record<string, string> = { ok: 'OK', ko: 'KO', partial: 'Parziale', not_planned: 'Non previsto' }
  type ResultKey = 'ok' | 'ko' | 'partial' | 'not_planned'
  const RESULT_STYLE: Record<ResultKey, string> = {
    ok:          `background:${theme.palette.success.light};color:${theme.palette.success.dark}`,
    ko:          `background:${theme.palette.error.light};color:${theme.palette.error.dark}`,
    partial:     `background:${theme.palette.warning.light};color:${theme.palette.warning.dark}`,
    not_planned: 'background:#f3f4f6;color:#6b7280',
  }

  // Mappa inventory_id → rapportino più recente
  const eventByInv: Record<number, any> = {}
  for (const ev of events) {
    if (!eventByInv[ev.inventory] || ev.performed_at > eventByInv[ev.inventory].performed_at)
      eventByInv[ev.inventory] = ev
  }

  // Ordina per KNumber (numerico poi alfa)
  const sortedInv = [...inventories].sort((a, b) => {
    const ka = a.knumber ?? a.hostname ?? ''
    const kb = b.knumber ?? b.hostname ?? ''
    const na = parseInt(ka.replace(/\D/g, ''), 10)
    const nb = parseInt(kb.replace(/\D/g, ''), 10)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return ka.localeCompare(kb)
  })

  const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return d ? `${d}/${m}/${y}` : iso }

  const invRows = sortedInv.map((inv: any) => {
    const ev       = eventByInv[inv.id]
    const result   = ev?.result as ResultKey | undefined
    const styleCss = result ? (RESULT_STYLE[result] ?? RESULT_STYLE.not_planned) : ''
    const badge    = result
      ? `<span style="${styleCss};padding:2px 7px;border-radius:3px;font-size:9.5px;font-weight:700">${escapeHtml(RESULT_IT[result] ?? result)}</span>`
      : `<span style="background:#fff3e0;color:#b45309;padding:2px 7px;border-radius:3px;font-size:9.5px;font-weight:700">—</span>`
    const siteName = inv.site_name ?? inv.site_display_name ?? '—'
    // 0.9.1 (WP-04, archie-maintenancexss, SEC-008): knumber/name/
    // siteName/type_label/tech_name/notes sono tutti campi testo libero
    // (inventario, sito, tecnico, note evento) — vanno sempre escapati
    // prima di finire in questo template scritto via document.write.
    return `<tr>
      <td class="mono">${escapeHtml(inv.knumber) || '—'}</td>
      <td>${escapeHtml(inv.name) || '—'}</td>
      <td class="muted">${escapeHtml(siteName)}</td>
      <td class="muted">${escapeHtml(inv.type_label) || '—'}</td>
      <td class="center">${ev ? escapeHtml(fmtDate(ev.performed_at)) : '—'}</td>
      <td class="muted">${escapeHtml(ev?.tech_name) || '—'}</td>
      <td class="center">${badge}</td>
      <td class="muted small">${escapeHtml(ev?.notes)}</td>
    </tr>`
  }).join('')

  const coveredCount   = plan.covered_count  ?? inventories.length
  const completedCount = plan.completed_count ?? 0
  const missing        = Math.max(0, coveredCount - completedCount)
  const pct            = coveredCount > 0 ? Math.round(completedCount / coveredCount * 100) : 0
  const isCompleted    = coveredCount > 0 && completedCount >= coveredCount
  const barColor       = pct === 100 ? theme.palette.success.main : pct >= 50 ? theme.palette.warning.main : theme.palette.error.main

  // In italiano come nella pagina («Ogni 12 mesi», «Ogni anno il 15 marzo»).
  const scheduleLabel = scheduleText(plan as Parameters<typeof scheduleText>[0])

  const now = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })

  // NOTA (color refactor 0.9.x): il template sotto genera un documento HTML
  // stampabile a sé stante (finestra separata, solo per window.print()), non
  // una view live dell'app — per questo i grigi/neutrali restano hardcoded
  // (coerenza della stampa a prescindere dal tema attivo dell'utente), mentre
  // i colori di brand/stato che DEVONO seguire il tema attivo (primary,
  // success/warning, divider, text) restano interpolati da `theme.palette.*`
  // come già erano. Eccezione deliberata, non dimenticanza — vedi anche
  // RESULT_STYLE sopra, che già segue questa stessa convenzione.
  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"/>
<title>Report — ${escapeHtml(plan.title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1e293b;background:#fff}
.page{padding:22px 26px 18px}

/* ── Header ── */
.hdr{background:#fff;color:${theme.palette.text.primary};
     padding:4px 0 14px;border-bottom:2px solid ${theme.palette.primary.main};margin-bottom:14px;
     display:flex;justify-content:space-between;align-items:flex-start}
.hdr-left h1{font-size:18px;font-weight:700;letter-spacing:-.02em;margin-bottom:2px}
.hdr-left .sub{font-size:10px;color:${theme.palette.text.secondary};margin-bottom:6px}
.hdr-left .tags{display:flex;flex-wrap:wrap;gap:5px}
.tag{background:#e2f0eb;color:#17463c;padding:2px 8px;
     border-radius:4px;font-size:9.5px;font-weight:600}
.hdr-right{text-align:right;font-size:9px;color:${theme.palette.text.secondary};line-height:1.7;white-space:nowrap;padding-left:16px}
.hdr-right b{display:block;font-size:12px;font-weight:700;color:${theme.palette.primary.main};letter-spacing:.02em}
.status-ok  {background:${theme.palette.success.light};color:${theme.palette.success.dark};padding:2px 10px;border-radius:4px;font-size:10px;font-weight:700}
.status-wip {background:${theme.palette.warning.light};color:${theme.palette.warning.dark};padding:2px 10px;border-radius:4px;font-size:10px;font-weight:700}

/* ── KPI strip ── */
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.kpi{background:#f8fafc;border:1px solid ${theme.palette.divider};border-radius:6px;padding:9px 12px}
.kpi-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:3px}
.kpi-val{font-size:20px;font-weight:800;line-height:1;color:${theme.palette.text.primary}}
.kpi-sub{font-size:9px;color:#94a3b8;margin-top:2px}

/* ── Progress ── */
.prog{background:#f8fafc;border:1px solid ${theme.palette.divider};border-radius:6px;
      padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:14px}
.prog-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${theme.palette.text.secondary};white-space:nowrap}
.prog-bar-bg{flex:1;height:8px;background:${theme.palette.divider};border-radius:4px;overflow:hidden}
.prog-bar-fill{height:100%;border-radius:4px}
.prog-pct{font-size:13px;font-weight:800;white-space:nowrap}

/* ── Notes ── */
.notes{background:#f0fdf4;border-left:3px solid ${theme.palette.primary.main};padding:7px 12px;
       border-radius:0 5px 5px 0;margin-bottom:12px;font-size:10px;color:#374151;white-space:pre-wrap}

/* ── Section title ── */
.sec{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
     color:${theme.palette.text.secondary};margin-bottom:6px;display:flex;align-items:center;gap:6px}
.sec::before{content:'';display:inline-block;width:3px;height:12px;
             background:${theme.palette.primary.main};border-radius:2px;flex-shrink:0}

/* ── Table ── */
table{width:100%;border-collapse:collapse}
thead th{background:#f5f8f7;color:${theme.palette.text.secondary};border-bottom:1px solid ${theme.palette.divider};padding:6px 8px;
         font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left}
thead th:first-child{border-radius:5px 0 0 0}
thead th:last-child {border-radius:0 5px 0 0}
tbody tr:nth-child(even) td{background:#f8fafc}
td{padding:5px 8px;border-bottom:1px solid ${theme.palette.background.default};vertical-align:middle;font-size:10.5px}
td.mono{font-family:ui-monospace,monospace;font-weight:600;font-size:10px}
td.muted{color:#6b7280}
td.center{text-align:center}
td.small{font-size:9.5px}

/* ── Footer ── */
.footer{margin-top:14px;padding-top:10px;border-top:1px solid ${theme.palette.divider};
        display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}

@media print{
  body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
  .page{padding:14px 18px 12px}
  @page{size:A4 portrait;margin:8mm 7mm}
}
</style></head>
<body><div class="page">

<div class="hdr">
  <div class="hdr-left">
    <div class="sub">${escapeHtml(plan.customer_code) || ''} &nbsp;·&nbsp; ${escapeHtml(plan.customer_name) || ''}</div>
    <h1>${escapeHtml(plan.title)}</h1>
    <div class="tags" style="margin-top:8px">
      <span class="${isCompleted ? 'status-ok' : 'status-wip'}">${isCompleted ? '✓ Completato' : '◑ In corso'}</span>
      <span class="tag">${escapeHtml(scheduleLabel)}</span>
      <span class="tag">Scad. ${escapeHtml(plan.next_due_date) || '—'}</span>
      ${plan.last_done_date ? `<span class="tag">Ultima eseg. ${escapeHtml(plan.last_done_date)}</span>` : ''}
      <span class="tag">${escapeHtml((plan.inventory_type_labels ?? []).join(', ')) || '—'}</span>
    </div>
  </div>
  <div class="hdr-right"><b>ARCHIE</b>Report piano #${plan.id}<br/>${now}</div>
</div>

<div class="kpi-row">
  <div class="kpi">
    <div class="kpi-lbl">Inventory coperti</div>
    <div class="kpi-val">${coveredCount}</div>
    <div class="kpi-sub">nel piano</div>
  </div>
  <div class="kpi">
    <div class="kpi-lbl">Eseguiti</div>
    <div class="kpi-val" style="color:${theme.palette.success.main}">${completedCount}</div>
    <div class="kpi-sub">ciclo corrente</div>
  </div>
  <div class="kpi">
    <div class="kpi-lbl">Mancanti</div>
    <div class="kpi-val" style="color:${missing > 0 ? theme.palette.error.main : theme.palette.success.main}">${missing}</div>
    <div class="kpi-sub">da completare</div>
  </div>
  <div class="kpi">
    <div class="kpi-lbl">Copertura</div>
    <div class="kpi-val" style="color:${barColor}">${pct}%</div>
    <div class="kpi-sub">del ciclo</div>
  </div>
</div>

<div class="prog">
  <span class="prog-label">Avanzamento</span>
  <div class="prog-bar-bg">
    <div class="prog-bar-fill" style="width:${pct}%;background:${barColor}"></div>
  </div>
  <span class="prog-pct" style="color:${barColor}">${completedCount} / ${coveredCount}</span>
</div>

${plan.notes ? `<div class="notes">${escapeHtml(plan.notes)}</div>` : ''}

<div class="sec">Inventory — ${sortedInv.length} dispositivi ordinati per KNumber</div>
${sortedInv.length === 0
  ? '<p style="color:#94a3b8;font-style:italic;font-size:10px;margin-bottom:10px">Nessun inventory trovato per i tipi previsti da questo piano.</p>'
  : `<table>
      <thead><tr>
        <th>KNumber</th><th>Nome</th><th>Sito</th><th>Tipo</th>
        <th style="text-align:center">Data</th><th>Tecnico</th>
        <th style="text-align:center">Risultato</th><th>Note</th>
      </tr></thead>
      <tbody>${invRows}</tbody>
    </table>`
}

<div class="footer">
  <span>Piano #${plan.id} &nbsp;·&nbsp; ${escapeHtml(plan.customer_name) || ''} &nbsp;·&nbsp; ${escapeHtml(scheduleLabel)}</span>
  <span>inventory-app &nbsp;·&nbsp; ${now}</span>
</div>

</div>
<script>window.onload=()=>{ setTimeout(()=>window.print(), 350) }</script>
</body></html>`

  const w = window.open('', '_blank', 'width=820,height=1000')
  if (w) { w.document.write(html); w.document.close() }
  else onPopupBlocked()
}
