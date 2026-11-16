import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, IconButton, Stack, Tooltip, Typography, useTheme } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import { api } from '@shared/api/client'
import { buildDrfListParams } from '@shared/api/drf'
import { itemActionPath, itemPath } from '@shared/api/apiPaths'
import { apiErrorToMessage } from '@shared/api/error'
import { useDrfList } from '@shared/hooks/useDrfList'
import { useServerGrid } from '@shared/hooks/useServerGrid'
import { useUrlStringParam } from '@shared/hooks/useUrlParam'
import EntityListCard from '@shared/ui/EntityListCard'
import type { MobileCardRenderFn } from '@shared/ui/MobileCardList'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import { useToast } from '@shared/ui/toast'
import { isRecord } from '@shared/utils/guards'
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined'
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { CampoIcon, PageHead, TableBar, ViewTabs, type DetailMenuItem } from '../ui/campo'
import { formatOpenedAt, initialsOf, taskPrefillFromCase, typeColor, type CaseTypeOption, type ServiceNowCaseRow } from '../features/servicenow/snModel'
import TodayPanel from '../features/servicenow/TodayPanel'
import CaseDetailCard from '../features/servicenow/CaseDetailCard'
import CaseDialog, { type ServiceNowCaseForm } from '../features/servicenow/CaseDialog'
import PhilipsAssignmentCopyDialog, { buildPhilipsAssignmentCopyText } from '../features/servicenow/PhilipsAssignmentCopyDialog'
import ImportHistoricalDialog from '../features/servicenow/ImportHistoricalDialog'
import { todayISO } from '../features/servicenow/absenceShared'

const PATH = '/servicenow-cases/' as const
type View = 'all' | 'today' | 'mine' | 'unassigned'
const VIEWS: { key: View; label: string; alert?: boolean }[] = [
  { key: 'all', label: 'Tutti' }, { key: 'today', label: 'Oggi' }, { key: 'mine', label: 'Miei' }, { key: 'unassigned', label: 'Da assegnare', alert: true },
]
const MONO = { fontFamily: '"Geist Mono", ui-monospace, monospace' } as const
const cell = { display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 } as const

/** Casi ServiceNow (anteprima sn-base, variante A): riquadro "Oggi" e tabella con le colonne di sempre. Registrazione, non gestione. */
export default function ServiceNowCases() {
  const { me, hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const loc = useLocation()
  const dark = useTheme().palette.mode === 'dark'
  const canChange = hasPerm(PERMS.servicenow.case.change)
  const canDelete = hasPerm(PERMS.servicenow.case.delete)
  const canCreate = hasPerm(PERMS.servicenow.case.add)
  const canIssue = hasPerm(PERMS.issues.issue.add)

  const grid = useServerGrid({ defaultOrdering: '-created_at', allowedOrderingFields: ['number', 'account', 'category', 'case_type__name', 'opened_date', 'assigned_to__last_name', 'created_at', 'updated_at', 'deleted_at'] })
  const [vista, setVista] = useUrlStringParam('vista')
  const view: View = VIEWS.find((v) => v.key === vista)?.key ?? 'all'
  const viewParams = React.useCallback((v: View): Record<string, string | number> => (
    v === 'today' ? { opened_date: todayISO() } : v === 'mine' ? (me ? { assigned_to: me.id } : {}) : v === 'unassigned' ? { unassigned: 'true' } : {}
  ), [me])
  const [tick, setTick] = React.useState(0)
  const bump = () => setTick((x) => x + 1)

  const listParams = React.useMemo(() => buildDrfListParams({
    search: grid.search, ordering: grid.ordering, page0: grid.paginationModel.page, pageSize: grid.paginationModel.pageSize,
    includeDeleted: grid.includeDeleted, onlyDeleted: grid.onlyDeleted, extra: viewParams(view),
  }), [grid.search, grid.ordering, grid.paginationModel, grid.includeDeleted, grid.onlyDeleted, view, viewParams])
  const { rows, rowCount, loading, reload } = useDrfList<ServiceNowCaseRow>(PATH, listParams, (e) => toast.error(apiErrorToMessage(e)))
  const reloadAll = React.useCallback(() => { reload(); bump() }, [reload])

  // Conteggi delle viste.
  const [counts, setCounts] = React.useState<Partial<Record<View, number>>>({})
  React.useEffect(() => {
    let alive = true
    Promise.all(VIEWS.map((v) => api.get<{ count?: number }>(PATH, { params: { ...viewParams(v.key), page_size: 1 } }).then((r) => [v.key, r.data.count ?? 0] as const).catch(() => [v.key, 0] as const)))
      .then((l) => { if (alive) setCounts(Object.fromEntries(l)) })
    return () => { alive = false }
  }, [viewParams, tick])

  // Type: il colore segue l'ordine configurato nella categoria.
  const [types, setTypes] = React.useState<CaseTypeOption[]>([])
  React.useEffect(() => { api.get<CaseTypeOption[]>('/servicenow-case-types/').then((r) => setTypes(r.data)).catch(() => {}) }, [])
  const typeTag = (row: ServiceNowCaseRow) => {
    if (!row.case_type_label) return null
    const names = types.filter((t) => t.category === row.category).map((t) => t.name)
    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, height: 20, pl: 0.75, pr: 0.9, borderRadius: '5px', fontSize: 11.5, fontWeight: 650, bgcolor: 'archie.neutralBg', whiteSpace: 'nowrap' }}>
        <Box component="i" sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: typeColor(names, row.case_type_label, dark) }} />{row.case_type_label}
      </Box>
    )
  }

  // ── Notifica Philips (testo da copiare) ──
  const [philipsMode, setPhilipsMode] = React.useState<'teams' | 'modal'>('teams')
  React.useEffect(() => { api.get<{ philips_notify_mode: 'teams' | 'modal' }>(`${PATH}notification-settings/`).then((r) => setPhilipsMode(r.data.philips_notify_mode)).catch(() => {}) }, [])
  const [copyText, setCopyText] = React.useState<string | null>(null)
  const philipsText = (r: ServiceNowCaseRow) => buildPhilipsAssignmentCopyText({ assignedToLabel: r.assigned_to_full_name || r.assigned_to_username, number: r.number, account: r.account, shortDescription: r.short_description, caseTypeLabel: r.case_type_label })

  // ── Dettaglio ──
  const [detail, setDetail] = React.useState<ServiceNowCaseRow | null>(null)
  const [busy, setBusy] = React.useState(false)
  const openId = grid.openId
  React.useEffect(() => {
    if (!openId) { setDetail(null); return }
    let alive = true
    const fromList = rows.find((r) => r.id === openId)
    if (fromList) setDetail(fromList)
    api.get<ServiceNowCaseRow>(itemPath(PATH, openId), { params: { include_deleted: 1 } }).then((r) => { if (alive) setDetail(r.data) }).catch((e) => { if (alive) toast.error(apiErrorToMessage(e)) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, tick])
  const idx = detail ? rows.findIndex((r) => r.id === detail.id) : -1

  // ── Nuovo / modifica ──
  const [formOpen, setFormOpen] = React.useState(false)
  const [formTarget, setFormTarget] = React.useState<ServiceNowCaseRow | null>(null)
  const [saving, setSaving] = React.useState(false)
  const openForm = React.useCallback((r: ServiceNowCaseRow | null) => { setFormTarget(r); setFormOpen(true) }, [])
  React.useEffect(() => {
    const st = loc.state as unknown
    if (isRecord(st) && st['openCreate'] === true) { navigate(loc.pathname + loc.search, { replace: true, state: {} }); openForm(null) }
  }, [loc, navigate, openForm])
  const save = async (form: ServiceNowCaseForm, file: File | null) => {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('number', form.number); fd.append('account', form.account); fd.append('category', form.category)
      if (form.case_type !== '') fd.append('case_type', String(form.case_type))
      if (form.opened_date) fd.append('opened_date', form.opened_date)
      if (form.opened_time) fd.append('opened_time', form.opened_time)
      fd.append('short_description', form.short_description)
      if (form.assigned_to !== null) fd.append('assigned_to', String(form.assigned_to))
      fd.append('external_url', form.external_url)
      if (file) fd.append('screenshot', file)
      const cfg = { headers: { 'Content-Type': 'multipart/form-data' } }
      if (formTarget) {
        await api.patch(itemPath(PATH, formTarget.id), fd, cfg)
        toast.success('Caso aggiornato.')
      } else {
        const { data } = await api.post<ServiceNowCaseRow>(PATH, fd, cfg)
        toast.success('Caso registrato.')
        grid.setOpenId(data.id)
        if (data.category === 'philips' && philipsMode === 'modal') setCopyText(philipsText(data))
      }
      setFormOpen(false)
      reloadAll()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setSaving(false) }
  }

  // ── Elimina / ripristina ──
  const [toDelete, setToDelete] = React.useState<ServiceNowCaseRow | null>(null)
  const doDelete = async () => {
    if (!toDelete) return
    setBusy(true)
    try { await api.delete(itemPath(PATH, toDelete.id)); toast.success('Caso spostato nel cestino.'); setToDelete(null); reloadAll() } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }
  const restore = async (r: ServiceNowCaseRow) => {
    setBusy(true)
    try { await api.post(itemActionPath(PATH, r.id, 'restore')); toast.success('Caso ripristinato.'); reloadAll() } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setBusy(false) }
  }

  // ── Crea issue / task dal caso ──
  const createIssue = (r: ServiceNowCaseRow) => navigate('/issues', { state: { openCreate: true, createFromServiceNowCase: { number: r.number, account: r.account, shortDescription: r.short_description } } })
  const createTask = (r: ServiceNowCaseRow) => navigate('/tasks', { state: { createTaskPrefill: taskPrefillFromCase(r) } })

  const [ctx, setCtx] = React.useState<{ row: ServiceNowCaseRow; x: number; y: number } | null>(null)
  const ctxItems: RowContextMenuItem[] = !ctx ? [] : ctx.row.deleted_at ? [
    { key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => { grid.setOpenId(ctx.row.id); setCtx(null) } },
    { key: 'restore', label: 'Ripristina', icon: <RestoreFromTrashIcon fontSize="small" />, hidden: !canChange, onClick: () => { void restore(ctx.row); setCtx(null) } },
  ] : [
    { key: 'open', label: 'Apri', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => { grid.setOpenId(ctx.row.id); setCtx(null) } },
    { key: 'issue', label: 'Crea issue', icon: <BugReportOutlinedIcon fontSize="small" />, hidden: !canIssue, onClick: () => { setCtx(null); createIssue(ctx.row) } },
    { key: 'task', label: 'Crea task', icon: <TaskAltOutlinedIcon fontSize="small" />, onClick: () => { setCtx(null); createTask(ctx.row) } },
    { key: 'msg', label: 'Messaggio', icon: <ChatBubbleOutlineIcon fontSize="small" />, hidden: ctx.row.category !== 'philips', onClick: () => { setCopyText(philipsText(ctx.row)); setCtx(null) } },
    { key: 'edit', label: 'Modifica', icon: <EditOutlinedIcon fontSize="small" />, hidden: !canChange, onClick: () => { openForm(ctx.row); setCtx(null) } },
    { key: 'delete', label: 'Elimina', icon: <DeleteOutlineIcon fontSize="small" />, hidden: !canDelete, tone: 'danger' as const, onClick: () => { setToDelete(ctx.row); setCtx(null) } },
  ]
  const detailMenu = (r: ServiceNowCaseRow): DetailMenuItem[] => [
    ...(canIssue ? [{ label: 'Crea issue', onClick: () => createIssue(r) }] : []),
    { label: 'Crea task', onClick: () => createTask(r) },
    ...(r.category === 'philips' ? [{ label: 'Messaggio per il tecnico', onClick: () => setCopyText(philipsText(r)) }] : []),
  ]

  // ── Colonne (le stesse di prima) ──
  const columns: GridColDef<ServiceNowCaseRow>[] = [
    { field: 'number', headerName: 'Numero', width: 120, renderCell: (p) => <Box sx={{ ...cell, ...MONO, fontSize: 12.5, fontWeight: 500 }}>{p.row.number}</Box> },
    { field: 'account', headerName: 'Account', flex: 1, minWidth: 180, renderCell: (p) => <Box sx={cell}><Typography noWrap sx={{ fontSize: 13, fontWeight: 550 }}>{p.row.account}</Typography></Box> },
    { field: 'category', headerName: 'Categoria', width: 100, renderCell: (p) => <Box sx={{ ...cell, fontSize: 13, color: 'text.secondary' }}>{p.row.category_label}</Box> },
    { field: 'case_type__name', headerName: 'Type', width: 110, renderCell: (p) => <Box sx={cell}>{typeTag(p.row)}</Box> },
    { field: 'opened_date', headerName: 'Aperto il', width: 150, renderCell: (p) => <Box sx={{ ...cell, fontSize: 12.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{formatOpenedAt(p.row) ?? '—'}</Box> },
    { field: 'external_url', headerName: 'Link', width: 60, sortable: false, renderCell: (p) => p.row.external_url ? (
      <Box sx={cell}><Tooltip title="Apri in ServiceNow"><IconButton size="small" component="a" href={p.row.external_url} target="_blank" rel="noopener noreferrer" onClick={(e: React.MouseEvent) => e.stopPropagation()} aria-label="Apri in ServiceNow" sx={{ width: 26, height: 26 }}><CampoIcon name="arrowR" size={13} /></IconButton></Tooltip></Box>
    ) : null },
    { field: 'assigned_to__last_name', headerName: 'Assegnato a', width: 160, renderCell: (p) => (
      <Box sx={{ ...cell, gap: 1 }}>
        {p.row.assigned_to_full_name ? (<>
          <Box component="span" aria-hidden sx={{ display: 'inline-grid', placeItems: 'center', flex: 'none', width: 22, height: 22, borderRadius: '50%', fontSize: 9, fontWeight: 700, lineHeight: 1, bgcolor: (t) => t.palette.archie.tints.mint.bg, color: (t) => t.palette.archie.tints.mint.ink }}>{initialsOf(p.row.assigned_to_full_name)}</Box>
          <Typography noWrap sx={{ fontSize: 13 }}>{p.row.assigned_to_full_name}</Typography>
        </>) : <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'warning.main' }}>Da assegnare</Typography>}
      </Box>
    ) },
    { field: 'short_description', headerName: 'Descrizione', flex: 1.4, minWidth: 200, sortable: false, renderCell: (p) => <Box sx={cell}><Typography noWrap sx={{ fontSize: 12.5, color: 'text.secondary' }}>{p.row.short_description || '—'}</Typography></Box> },
  ]

  const mobileCard: MobileCardRenderFn<ServiceNowCaseRow> = ({ row, onOpen }) => (
    <Box onClick={() => onOpen(row.id)} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 1.25, display: 'grid', gap: 0.5, cursor: 'pointer' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box component="span" sx={{ ...MONO, fontSize: 12.5 }}>{row.number}</Box>{typeTag(row)}
        <Typography sx={{ ml: 'auto', fontSize: 11.5, color: 'text.secondary' }}>{formatOpenedAt(row) ?? ''}</Typography>
      </Box>
      <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{row.account}</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{row.short_description || '—'}</Typography>
      <Typography sx={{ fontSize: 12, color: row.assigned_to_full_name ? 'text.primary' : 'warning.main', fontWeight: row.assigned_to_full_name ? 400 : 600 }}>{row.assigned_to_full_name || 'Da assegnare'}</Typography>
    </Box>
  )

  const [importOpen, setImportOpen] = React.useState(false)
  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <PageHead title="ServiceNow" actions={<>
        {canCreate ? <Tooltip title="Importa lo storico da CSV"><IconButton aria-label="Importa lo storico da CSV" onClick={() => setImportOpen(true)} sx={{ width: 36, height: 36 }}><CampoIcon name="upload" /></IconButton></Tooltip> : null}
        {canCreate ? <Button variant="contained" startIcon={<CampoIcon name="plus" size={15} />} onClick={() => openForm(null)}>Nuovo caso</Button> : null}
      </>} />
      <TodayPanel refreshKey={tick} canManage={canChange} onUnassigned={() => setVista('unassigned', { patch: { page: 1 }, keepOpen: true })} />
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <ViewTabs value={view} onChange={(k) => setVista(k === 'all' ? '' : k, { patch: { page: 1 }, keepOpen: true })}
          tabs={VIEWS.map((v) => ({ key: v.key, label: v.label, count: counts[v.key] ?? null, tone: v.alert ? 'alert' : 'default' }))} />
        <EntityListCard
          sx={{ border: 0, borderRadius: 0 }}
          flush
          mobileCard={mobileCard}
          header={<TableBar filters={[]} onRemoveFilter={() => {}} onClearFilters={() => {}} q={grid.q} onQChange={grid.setQ} searchPlaceholder="Cerca numero, account, descrizione…" />}
          toolbar={{ compact: true, q: grid.q, onQChange: grid.setQ, searchLabel: 'Cerca casi…' }}
          grid={{
            pageKey: 'servicenow-cases',
            autoHeight: true,
            username: me?.username,
            emptyState: grid.search.trim() ? { title: 'Nessun risultato', subtitle: 'Prova con un altro numero o account.' } : { title: view === 'all' ? 'Nessun caso' : 'Nessun caso in questa vista', subtitle: view === 'all' ? 'Registra un caso incollando lo screenshot.' : '' },
            rows,
            columns,
            loading,
            rowCount,
            rowHeight: 48,
            paginationModel: grid.paginationModel,
            onPaginationModelChange: grid.onPaginationModelChange,
            sortModel: grid.sortModel,
            onSortModelChange: grid.onSortModelChange,
            onRowClick: (id) => grid.setOpenId(id),
            onRowContextMenu: (row, e) => setCtx({ row, x: e.clientX + 2, y: e.clientY - 6 }),
            getRowClassName: (row) => (detail?.id === row.id ? 'Mui-selected' : undefined),
            sx: { cursor: 'pointer' },
          }}
        />
      </Box>

      {detail && openId === detail.id ? (
        <CaseDetailCard c={detail} busy={busy} canChange={canChange} canDelete={canDelete} menu={detailMenu(detail)}
          position={idx >= 0 ? `${idx + 1} di ${rows.length}` : undefined}
          onPrev={idx > 0 ? () => grid.setOpenId(rows[idx - 1].id) : undefined}
          onNext={idx >= 0 && idx < rows.length - 1 ? () => grid.setOpenId(rows[idx + 1].id) : undefined}
          onClose={() => grid.setOpenId(null)} onEdit={() => openForm(detail)} onDelete={() => setToDelete(detail)} onRestore={() => void restore(detail)} />
      ) : null}
      <CaseDialog open={formOpen} onClose={() => setFormOpen(false)} onSave={save} initial={formTarget} saving={saving} />
      <ConfirmDeleteDialog open={toDelete !== null} busy={busy} title={toDelete ? `Eliminare il caso ${toDelete.number}?` : ''} description="Finisce nel Cestino e si può ripristinare." onClose={() => setToDelete(null)} onConfirm={() => void doDelete()} />
      <PhilipsAssignmentCopyDialog open={copyText !== null} onClose={() => setCopyText(null)} text={copyText ?? ''} />
      <ImportHistoricalDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={reloadAll} />
      <RowContextMenu open={Boolean(ctx)} anchorPosition={ctx ? { top: ctx.y, left: ctx.x } : undefined} onClose={() => setCtx(null)} items={ctxItems} />
    </Stack>
  )
}
