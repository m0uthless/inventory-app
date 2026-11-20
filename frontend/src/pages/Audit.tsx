/**
 * Audit — /audit
 *
 * Registro di modifiche e accessi (restyle "Campo sterile", anteprima
 * design-previews/au-base.html, variante A · Registro con le colonne Data e Ora).
 */
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, ButtonBase, Stack } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'

import { api } from '@shared/api/client'
import { buildDrfListParams } from '@shared/api/drf'
import { apiErrorToMessage } from '@shared/api/error'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlNumberParam, useUrlStringParam } from '@shared/hooks/useUrlParam'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import type { ColumnFilterConfig } from '@shared/ui/ServerDataGrid'
import { useToast } from '@shared/ui/toast'
import { useExportCsv } from '@shared/ui/useExportCsv'

import { useAuth } from '../auth/AuthProvider'
import { CampoIcon, FilterOptionList, PageHead, TableBar, ViewTabs, headerFilterGridSx, type ActiveFilter } from '../ui/campo'
import AuditKpis from '../features/audit/AuditKpis'
import { useAuditStats } from '../features/audit/useAuditStats'
import AuditDetailCard from '../features/audit/AuditDetailCard'
import { ActorCell, AuditActionBadge, ChangeSummary, ObjectCell } from '../features/audit/auditUi'
import {
  ACTION_META, ENTITY, PERIODS, VIEWS, actorLabel, changeEntries, dateCell, entityKey, entityLabel, fieldLabel, fmtValue, objectTitle, periodStart, timeCell, whenLabel,
  type AuditAction, type AuditEvent, type AuditView, type Period,
} from '../features/audit/auditModel'

type AuditActor = { id: number; label: string; first_name?: string; last_name?: string; username?: string }
type AuditEntity = { app_label: string; model: string }

const actorShort = (a: AuditActor) => [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.username || a.label

const columns: GridColDef<AuditEvent>[] = [
  { field: 'created_at', headerName: 'Data', width: 112, renderCell: (p) => <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{dateCell(p.row.created_at)}</Box> },
  { field: 'time', headerName: 'Ora', width: 64, sortable: false, renderCell: (p) => <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{timeCell(p.row.created_at)}</Box> },
  { field: 'actor', headerName: 'Utente', width: 190, sortable: false, renderCell: (p) => <ActorCell ev={p.row} /> },
  { field: 'action', headerName: 'Azione', width: 138, renderCell: (p) => <AuditActionBadge action={p.row.action} /> },
  { field: 'object', headerName: 'Oggetto', flex: 1, minWidth: 240, sortable: false, renderCell: (p) => <ObjectCell ev={p.row} /> },
  { field: 'changes', headerName: 'Cosa è cambiato', flex: 0.8, minWidth: 200, sortable: false, renderCell: (p) => <ChangeSummary ev={p.row} /> },
]

const auditCard: MobileCardRenderFn<AuditEvent> = ({ row, onOpen }) => (
  <Box onClick={() => onOpen(row.id)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.25, cursor: 'pointer', display: 'grid', gap: 0.75 }}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}><ObjectCell ev={row} /></Box>
      <AuditActionBadge action={row.action} />
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12, color: 'text.secondary' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}><ActorCell ev={row} /></Box>
      <span>{whenLabel(row.created_at)}</span>
    </Box>
    {changeEntries(row.changes).length ? <ChangeSummary ev={row} /> : null}
  </Box>
)

export default function Audit() {
  const toast = useToast()
  const navigate = useNavigate()
  const { me } = useAuth()
  const grid = useServerGrid({ defaultOrdering: '-created_at', allowedOrderingFields: ['created_at', 'action'], defaultPageSize: 25 })
  const opts = React.useMemo(() => ({ patch: { page: 1 }, keepOpen: true }), [])

  const [vista, setVista] = useUrlStringParam('vista')
  const [periodo, setPeriodo] = useUrlStringParam('periodo')
  const [actor, setActor] = useUrlNumberParam('actor')
  const [sistema, setSistema] = useUrlStringParam('sistema')
  const [action, setAction] = useUrlStringParam('action')
  const [tipo, setTipo] = useUrlStringParam('tipo')
  const [objectId, setObjectId] = useUrlStringParam('object_id')
  const view: AuditView = (VIEWS.find((v) => v.key === vista)?.key ?? 'all')
  // Arrivando da un link con un utente o un oggetto (Profilo, "Solo questo oggetto") il periodo parte da "Sempre".
  const period: Period = (PERIODS.find((p) => p.key === periodo)?.key ?? (actor !== '' || objectId ? 'all' : '7'))
  const [appLabel, model] = tipo.includes('.') ? tipo.split('.') : ['', '']

  // ── Opzioni dei filtri ──
  const [actors, setActors] = React.useState<AuditActor[]>([])
  const [entities, setEntities] = React.useState<AuditEntity[]>([])
  React.useEffect(() => {
    api.get<AuditActor[]>('/audit-events/actors/').then((r) => setActors(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    api.get<AuditEntity[]>('/audit-events/entities/').then((r) => setEntities(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [])
  React.useEffect(() => {
    if (actor === '' || actors.some((a) => a.id === actor)) return
    api.get<AuditActor[]>('/audit-events/actors/', { params: { id: actor } }).then((r) => { if (r.data?.length) setActors((p) => [...r.data, ...p]) }).catch(() => {})
  }, [actor, actors])

  // ── Parametri ──
  const scopeParams = React.useMemo(() => {
    const after = periodStart(period)
    return {
      ...(after ? { created_after: after } : {}),
      ...(actor !== '' ? { actor } : {}),
      ...(sistema ? { actor_null: 'true' } : {}),
      ...(action ? { action } : {}),
      ...(appLabel ? { app_label: appLabel, model } : {}),
      ...(objectId ? { object_id: objectId } : {}),
    }
  }, [period, actor, sistema, action, appLabel, model, objectId])
  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search, ordering: grid.ordering, page0: grid.paginationModel.page, pageSize: grid.paginationModel.pageSize,
    extra: { ...VIEWS.find((v) => v.key === view)!.params, ...scopeParams },
  }), [grid.search, grid.ordering, grid.paginationModel.page, grid.paginationModel.pageSize, view, scopeParams])
  const { rows, rowCount, loading } = useDrfList<AuditEvent>('/audit-events/', listParams, (e: unknown) => toast.error(apiErrorToMessage(e)))
  const stats = useAuditStats()

  // Conteggi delle viste (stessi filtri e periodo).
  const [counts, setCounts] = React.useState<Partial<Record<AuditView, number>>>({})
  React.useEffect(() => {
    let alive = true
    Promise.all(VIEWS.map((v) => api.get<{ count?: number }>('/audit-events/', { params: { ...v.params, ...scopeParams, ...(grid.search ? { search: grid.search } : {}), page_size: 1 } })
      .then((r) => [v.key, r.data?.count ?? 0] as const).catch(() => [v.key, undefined] as const)))
      .then((all) => { if (alive) setCounts(Object.fromEntries(all.filter(([, n]) => n != null))) })
    return () => { alive = false }
  }, [scopeParams, grid.search])

  // ── Dettaglio ──
  const [detail, setDetail] = React.useState<AuditEvent | null>(null)
  // Clic sulla riga: la seleziona; doppio clic o Invio: apre la finestra.
  const [focusId, setFocusId] = React.useState<number | null>(null)
  const selectedId = grid.openId ?? null
  React.useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    const row = rows.find((r) => r.id === selectedId)
    if (row) { setDetail(row); return }
    let alive = true
    api.get<AuditEvent>(`/audit-events/${selectedId}/`).then((r) => { if (alive) setDetail(r.data) }).catch((e) => { if (alive) toast.error(apiErrorToMessage(e)) })
    return () => { alive = false }
  }, [selectedId, rows, toast])
  const open = (id: number) => { setFocusId(id); grid.setOpenId(id) }
  const close = () => grid.setOpenId(null)
  const idx = selectedId != null ? rows.findIndex((r) => r.id === selectedId) : -1

  // ── Filtri ──
  const setView = (v: AuditView) => setVista(v === 'all' ? '' : v, opts)
  const clearAll = () => setActor('', { ...opts, patch: { page: 1, sistema: '', action: '', tipo: '', object_id: '' } })
  const actorName = (id: number) => { const a = actors.find((x) => x.id === id); return a ? actorShort(a) : `#${id}` }
  const activeFilters: ActiveFilter[] = [
    ...(actor !== '' ? [{ key: 'actor', label: 'Utente', values: actorName(actor) }] : []),
    ...(sistema ? [{ key: 'sistema', label: 'Utente', values: 'Sistema' }] : []),
    ...(action ? [{ key: 'action', label: 'Azione', values: ACTION_META[action as AuditAction]?.label ?? action }] : []),
    ...(tipo && !objectId ? [{ key: 'tipo', label: 'Tipo', values: ENTITY[tipo]?.label ?? tipo }] : []),
    ...(objectId ? [{ key: 'object', label: 'Oggetto', values: detail && String(detail.object_id) === objectId ? objectTitle(detail) : `${ENTITY[tipo]?.label ?? tipo} #${objectId}` }] : []),
  ]
  const removeFilter = (k: string) => {
    if (k === 'actor') setActor('', opts)
    else if (k === 'sistema') setSistema('', opts)
    else if (k === 'action') setAction('', opts)
    else if (k === 'tipo') setTipo('', opts)
    else if (k === 'object') setObjectId('', { ...opts, patch: { page: 1, tipo: '' } })
  }
  const userValue = sistema ? 'sys' : actor === '' ? '' : String(actor)
  const filterConfig: Record<string, ColumnFilterConfig> = {
    actor: {
      value: userValue, label: 'Filtra utente',
      onSet: () => {}, onReset: () => setActor('', { ...opts, patch: { page: 1, sistema: '' } }),
      children: <FilterOptionList label="Utente" single searchable selected={userValue ? [userValue] : []}
        options={[{ value: 'sys', label: 'Sistema (operazioni automatiche)' }, ...actors.map((a) => ({ value: String(a.id), label: actorShort(a) }))]}
        onChange={(v) => { const x = v[0]; if (!x) setActor('', { ...opts, patch: { page: 1, sistema: '' } }); else if (x === 'sys') setSistema('1', { ...opts, patch: { page: 1, actor: '' } }); else setActor(Number(x), { ...opts, patch: { page: 1, sistema: '' } }) }} />,
    },
    action: {
      value: action, label: 'Filtra azione', onSet: (v) => setAction(String(v), opts), onReset: () => setAction('', opts),
      children: <FilterOptionList label="Azione" single selected={action ? [action] : []} options={Object.entries(ACTION_META).map(([k, m]) => ({ value: k, label: m.label }))} onChange={(v) => setAction(v[0] ?? '', opts)} />,
    },
    object: {
      value: tipo, label: 'Filtra tipo', onSet: (v) => setTipo(String(v), opts), onReset: () => setTipo('', { ...opts, patch: { page: 1, object_id: '' } }),
      children: <FilterOptionList label="Tipo" single searchable selected={tipo ? [tipo] : []}
        options={entities.map((x) => { const k = entityKey(x.app_label, x.model); return { value: k, label: ENTITY[k]?.label ?? `${x.app_label}.${x.model}` } }).sort((a, b) => a.label.localeCompare(b.label))}
        onChange={(v) => setTipo(v[0] ?? '', { ...opts, patch: { page: 1, object_id: '' } })} />,
    },
  }
  const filterObject = (ev: AuditEvent) => {
    setTipo(entityKey(ev.content_type_app, ev.content_type_model), { ...opts, patch: { page: 1, object_id: ev.object_id ?? '', vista: '', periodo: 'all', actor: '', sistema: '', action: '' } })
  }

  // ── Esportazione ──
  const { exporting, exportCsv } = useExportCsv()
  const exportVisible = () => {
    const { page: _p, page_size: _ps, ...params } = listParams as Record<string, unknown>
    void _p; void _ps
    void exportCsv<AuditEvent>({
      url: '/audit-events/', params, filename: 'audit',
      columns: [
        { label: 'Data', getValue: (r) => dateCell(r.created_at) },
        { label: 'Ora', getValue: (r) => timeCell(r.created_at) },
        { label: 'Utente', getValue: (r) => actorLabel(r).name },
        { label: 'Azione', getValue: (r) => ACTION_META[r.action]?.label ?? r.action },
        { label: 'Tipo', getValue: (r) => entityLabel(r) },
        { label: 'Oggetto', getValue: (r) => objectTitle(r) },
        { label: 'Modifiche', getValue: (r) => changeEntries(r.changes).map((c) => `${fieldLabel(c.field)}: ${fmtValue(c.from) ?? ''} → ${fmtValue(c.to) ?? ''}`).join('; ') },
        { label: 'IP', getValue: (r) => r.ip_address ?? '' },
      ],
    })
  }

  const emptyState = React.useMemo(() => ({
    title: 'Nessun evento',
    subtitle: view === 'failed' ? 'Nessun accesso fallito in questo periodo.' : 'Nessun evento con questi filtri in questo periodo.',
  }), [view])

  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead title="Audit" meta="registro di modifiche e accessi" />
      <AuditKpis stats={stats} view={view} onView={setView} onActor={(id) => setActor(id, { ...opts, patch: { page: 1, sistema: '', vista: 'changes', periodo: '7' } })} />
      {/* Il periodo su telefono: le stesse scelte sopra la tabella. */}
      <Box role="group" aria-label="Periodo" sx={{ display: { xs: 'flex', md: 'none' }, gap: 0.5, mb: 1.25, flexWrap: 'wrap' }}>
        {PERIODS.map((p) => (
          <ButtonBase key={p.key} aria-pressed={period === p.key} onClick={() => setPeriodo(p.key, opts)} sx={{
            height: 30, px: 1.5, borderRadius: '15px', border: '1px solid', borderColor: period === p.key ? 'archie.fieldLine' : 'divider', fontSize: 12.5, fontWeight: 550,
            color: period === p.key ? 'primary.main' : 'text.secondary', bgcolor: period === p.key ? 'archie.field' : 'background.paper',
          }}><CampoIcon name="clock" size={13} />&nbsp;{p.label}</ButtonBase>
        ))}
      </Box>
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs value={view} onChange={(k) => setView(k as AuditView)}
          tabs={VIEWS.map((v) => ({ key: v.key, label: v.label, count: counts[v.key] ?? null, tone: v.alert ? 'alert' : 'default' }))}
          end={
            <Box role="group" aria-label="Periodo" sx={{ display: { xs: 'none', md: 'inline-flex' }, gap: '2px', p: '3px', border: '1px solid', borderColor: 'divider', borderRadius: '8px', mr: 0.5 }}>
              {PERIODS.map((p) => (
                <ButtonBase key={p.key} aria-pressed={period === p.key} onClick={() => setPeriodo(p.key, opts)} sx={{
                  height: 26, px: 1.25, borderRadius: '5px', fontSize: 12, fontWeight: 550, color: period === p.key ? 'primary.main' : 'text.secondary', bgcolor: period === p.key ? 'archie.field' : 'transparent',
                  '&:hover': { color: 'text.primary' }, '&.Mui-focusVisible': { boxShadow: (t) => t.palette.archie.focusRing },
                }}>{p.label}</ButtonBase>
              ))}
            </Box>
          } />
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          flush
          mobileCard={auditCard}
          header={
            <TableBar filters={activeFilters} onRemoveFilter={removeFilter} onClearFilters={clearAll} q={grid.q} onQChange={grid.setQ}
              searchPlaceholder="Cerca oggetto, ID, percorso…" onExport={exportVisible} exporting={exporting} />
          }
          toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca nel registro…' }}
          grid={{
            pageKey: 'audit',
            autoHeight: true,
            username: me?.username,
            filterConfig,
            emptyState,
            rows,
            columns,
            loading,
            rowCount,
            rowHeight: 52,
            paginationModel: grid.paginationModel,
            onPaginationModelChange: grid.onPaginationModelChange,
            sortModel: grid.sortModel,
            onSortModelChange: grid.onSortModelChange,
            onRowClick: setFocusId,
            onRowOpen: open,
            getRowClassName: (row) => ((selectedId ?? focusId) === row.id ? 'Mui-selected' : undefined),
            sx: { ...headerFilterGridSx, cursor: 'pointer' },
          }}
        />
      </Box>
      {/* Con ‹ › la finestra resta quella di prima finché arriva il nuovo evento. */}
      {selectedId && detail ? (
        <AuditDetailCard
          ev={detail}
          position={idx >= 0 ? `${idx + 1} di ${rows.length}` : undefined}
          onPrev={idx > 0 ? () => open(rows[idx - 1].id) : undefined}
          onNext={idx >= 0 && idx < rows.length - 1 ? () => open(rows[idx + 1].id) : undefined}
          onClose={close}
          onSelect={(id) => grid.setOpenId(id)}
          onFilterObject={filterObject}
          onFailedView={() => setVista('failed', { ...opts, patch: { page: 1, periodo: '30', actor: '', sistema: '', action: '', tipo: '', object_id: '' } })}
          onNavigate={(path) => navigate(path)}
        />
      ) : null}
    </Stack>
  )
}
