import * as React from 'react'
import { Autocomplete, Box, Button, IconButton, TextField, Tooltip, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'
import RowContextMenu, { type RowContextMenuItem } from '@shared/ui/RowContextMenu'
import { copyToClipboard } from '@shared/utils/clipboard'
import { CampoIcon, PageHead } from '../ui/campo'
import { archiveVars } from '../features/wiki/archive/archiveModel'
import { FileIcon, FolderIcon } from '../features/drive/DriveIcons'
import DriveDetail, { DriveFullPreview } from '../features/drive/DriveDetail'
import { extOf, kindOf, rel } from '../features/drive/driveModel'
import '../features/drive/drive.css'

import type { BreadcrumbItem, CustomerMini, DrawerItem, DriveFile, DriveFolder } from './drive/types'
import { CreateFolderDialog } from './drive/CreateFolderDialog'
import { RenameDialog } from './drive/RenameDialog'
import { MoveDialog } from './drive/MoveDialog'
import { fetchAll } from '../api/fetchAll'

type Upload = { current: number; total: number; fileName: string; overall: number }
const listOf = <T,>(data: unknown): T[] => (Array.isArray(data) ? data : ((data as { results?: T[] })?.results ?? [])) as T[]
const badgeOf = (f: DriveFolder) => ((f.access ?? []).some((r) => r.id === f.id) || (f.allowed_groups ?? []).length ? 'lock' : f.customers.length ? 'customer' : null)

/** Drive (restyle "Campo sterile", anteprima design-previews/d-base.html, variante A · Esplora file; pannello fisso a destra da drv-base, variante B). */
// prettier-ignore
export default function Drive() {
  const toast = useToast()
  const theme = useTheme()
  const { hasPerm } = useAuth()
  const [params, setParams] = useSearchParams()
  const canAddFolder = hasPerm(PERMS.drive.folder.add)
  const canUpload = hasPerm(PERMS.drive.file.add)
  const canChange = hasPerm(PERMS.drive.file.change) || hasPerm(PERMS.drive.folder.change)
  const canDelete = hasPerm(PERMS.drive.file.delete) || hasPerm(PERMS.drive.folder.delete)
  const canSeeAudit = hasPerm(PERMS.audit.view)

  const [folderId, setFolderId] = React.useState<number | null>(() => (Number(params.get('cartella')) > 0 ? Number(params.get('cartella')) : null))
  const [breadcrumb, setBreadcrumb] = React.useState<BreadcrumbItem[]>([])
  const [folders, setFolders] = React.useState<DriveFolder[]>([])
  const [files, setFiles] = React.useState<DriveFile[]>([])
  const [loading, setLoading] = React.useState(false)
  const [tree, setTree] = React.useState<DriveFolder[]>([])
  const [open, setOpen] = React.useState<Set<number>>(new Set())
  const [recent, setRecent] = React.useState<DriveFile[]>([])
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>(() => { try { return localStorage.getItem('drive_view') === 'grid' ? 'grid' : 'list' } catch { return 'list' } })
  const [q, setQ] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [customerFilter, setCustomerFilter] = React.useState<CustomerMini | null>(null)
  const [allCustomers, setAllCustomers] = React.useState<CustomerMini[]>([])
  const [detail, setDetail] = React.useState<DrawerItem | null>(null)
  // Pannello fisso a destra (variante B di drv-base): su schermo largo resta aperto anche vuoto e la × lo nasconde
  // (scelta ricordata); sotto i 1500 px si apre sopra l'elenco solo con un elemento scelto, su mobile a tutto schermo.
  const [pane, setPane] = React.useState(() => { try { return localStorage.getItem('drive_pane') !== '0' } catch { return true } })
  const [full, setFull] = React.useState<DriveFile | null>(null)
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const narrow = useMediaQuery('(max-width: 1500px)')
  const floating = isMobile || narrow
  const showPane = floating ? Boolean(detail) : pane
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [dragging, setDragging] = React.useState(false)
  const [upload, setUpload] = React.useState<Upload | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  // Dialoghi
  const [createFolderOpen, setCreateFolderOpen] = React.useState(false)
  const [createFolderName, setCreateFolderName] = React.useState('')
  const [createFolderBusy, setCreateFolderBusy] = React.useState(false)
  const [renameItem, setRenameItem] = React.useState<DrawerItem | null>(null)
  const [renameName, setRenameName] = React.useState('')
  const [renameBusy, setRenameBusy] = React.useState(false)
  const [deleteItem, setDeleteItem] = React.useState<DrawerItem | null>(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [moveItem, setMoveItem] = React.useState<DrawerItem | null>(null)
  const [moveTarget, setMoveTarget] = React.useState<number | null>(null)
  const [moveBusy, setMoveBusy] = React.useState(false)

  React.useEffect(() => { try { localStorage.setItem('drive_view', viewMode) } catch { /* solo in memoria */ } }, [viewMode])
  React.useEffect(() => { try { localStorage.setItem('drive_pane', pane ? '1' : '0') } catch { /* solo in memoria */ } }, [pane])
  React.useEffect(() => {
    if (!floating || !detail) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.MuiDialog-root, .MuiPopover-root')) setDetail(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [floating, detail])
  React.useEffect(() => { const t = setTimeout(() => setSearch(q.trim()), 300); return () => clearTimeout(t) }, [q])

  React.useEffect(() => {
    fetchAll<CustomerMini>('/customers/', { ordering: 'display_name' }).then(setAllCustomers).catch(() => {})
  }, [])

  // Albero completo delle cartelle accessibili (si aggiorna dopo ogni modifica).
  React.useEffect(() => {
    fetchAll<DriveFolder>('/drive-folders/', { ordering: 'name' }).then(setTree).catch(() => {})
  }, [reloadKey])

  // ── Contenuto: cartella corrente, oppure risultati di ricerca o filtro cliente ──
  const flat = Boolean(search || customerFilter)
  const loadRequestId = React.useRef(0)
  const load = React.useCallback(async (id: number | null, cust: CustomerMini | null, term: string) => {
    const requestId = ++loadRequestId.current
    setLoading(true)
    try {
      if (term || cust) {
        const p: Record<string, unknown> = {}
        if (term) p.search = term
        if (cust) p.customer = cust.id
        const [fo, fi] = await Promise.all([fetchAll<DriveFolder>('/drive-folders/', p), fetchAll<DriveFile>('/drive-files/', { ...p, ordering: '-updated_at' })])
        if (loadRequestId.current !== requestId) return // risposta superata da una più recente
        setFolders(fo); setFiles(fi); setBreadcrumb([])
      } else if (id === null) {
        const [fo, fi, rc] = await Promise.all([
          fetchAll<DriveFolder>('/drive-folders/', { root: 'true' }),
          fetchAll<DriveFile>('/drive-files/', { root: 'true' }),
          api.get('/drive-files/', { params: { ordering: '-updated_at', page_size: 6 } }),
        ])
        if (loadRequestId.current !== requestId) return
        setFolders(fo); setFiles(fi); setRecent(listOf<DriveFile>(rc.data)); setBreadcrumb([])
      } else {
        const res = await api.get(`/drive-folders/${id}/children/`)
        if (loadRequestId.current !== requestId) return
        setFolders(res.data.folders ?? []); setFiles(res.data.files ?? [])
        const bc = await api.get(`/drive-folders/${id}/breadcrumb/`)
        if (loadRequestId.current !== requestId) return
        const crumbs: BreadcrumbItem[] = bc.data ?? []
        setBreadcrumb(crumbs)
        setOpen((prev) => new Set([...prev, ...crumbs.map((c) => c.id)]))
      }
    } catch (e) {
      if (loadRequestId.current !== requestId) return
      toast.error(apiErrorToMessage(e))
    } finally {
      if (loadRequestId.current === requestId) setLoading(false)
    }
  }, [toast])

  React.useEffect(() => { void load(folderId, customerFilter, search) }, [folderId, customerFilter, search, reloadKey, load])
  const refresh = () => setReloadKey((k) => k + 1)

  // Link diretto a un file: /drive?file=<id> apre la sua cartella e il pannello.
  React.useEffect(() => {
    const fid = Number(params.get('file'))
    if (!fid) return
    api.get<DriveFile>(`/drive-files/${fid}/`).then((r) => { setFolderId(r.data.folder); setDetail({ kind: 'file', data: r.data }) }).catch((e) => toast.error(apiErrorToMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navigateTo = (id: number | null) => {
    setFolderId(id); setQ(''); setSearch(''); setCustomerFilter(null); setSelected(new Set()); setDetail(null)
    const next = new URLSearchParams(params); next.delete('file')
    if (id) next.set('cartella', String(id)); else next.delete('cartella')
    setParams(next, { replace: true })
  }
  const pickCustomer = (c: CustomerMini | null) => { setCustomerFilter(c); setSelected(new Set()); setDetail(null) }

  // ── Caricamento dei file ──
  const handleUpload = async (list: FileList | File[]) => {
    const items = Array.from(list)
    if (!items.length) return
    let failed = 0
    for (let i = 0; i < items.length; i++) {
      const f = items[i]
      setUpload({ current: i + 1, total: items.length, fileName: f.name, overall: Math.round((i / items.length) * 100) })
      const fd = new FormData()
      fd.append('file', f); fd.append('name', f.name)
      if (folderId !== null && !flat) fd.append('folder', String(folderId))
      try {
        await api.post('/drive-files/', fd, {
          onUploadProgress: (evt) => {
            const part = evt.total ? evt.loaded / evt.total : 0
            setUpload((prev) => (prev ? { ...prev, overall: Math.round(((i + part) / items.length) * 100) } : prev))
          },
        })
      } catch { failed++ }
    }
    setUpload(null)
    if (failed) toast.error(`${failed} file non caricati.`)
    else toast.success(`${items.length} file caricat${items.length === 1 ? 'o' : 'i'}`)
    refresh()
  }

  const doCreateFolder = async () => {
    if (!createFolderName.trim()) return
    setCreateFolderBusy(true)
    try {
      await api.post('/drive-folders/', { name: createFolderName.trim(), parent: flat ? null : folderId })
      toast.success('Cartella creata'); setCreateFolderOpen(false); setCreateFolderName(''); refresh()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setCreateFolderBusy(false) }
  }

  const doRename = async () => {
    if (!renameItem || !renameName.trim()) return
    setRenameBusy(true)
    try {
      const url = renameItem.kind === 'folder' ? `/drive-folders/${renameItem.data.id}/` : `/drive-files/${renameItem.data.id}/`
      const r = await api.patch(url, { name: renameName.trim() })
      toast.success('Rinominato'); setRenameItem(null)
      if (detail && detail.data.id === renameItem.data.id && detail.kind === renameItem.kind) setDetail({ kind: detail.kind, data: { ...detail.data, ...r.data } } as DrawerItem)
      refresh()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setRenameBusy(false) }
  }

  const doDelete = async () => {
    if (!deleteItem) return
    setDeleteBusy(true)
    try {
      await api.delete(deleteItem.kind === 'folder' ? `/drive-folders/${deleteItem.data.id}/` : `/drive-files/${deleteItem.data.id}/`)
      toast.success('Spostato nel cestino'); setDeleteItem(null); setDetail(null); refresh()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setDeleteBusy(false) }
  }

  const openMove = (item: DrawerItem) => { setMoveItem(item); setMoveTarget(null) }
  const doMove = async () => {
    if (!moveItem) return
    setMoveBusy(true)
    try {
      const url = moveItem.kind === 'folder' ? `/drive-folders/${moveItem.data.id}/move/` : `/drive-files/${moveItem.data.id}/move/`
      await api.post(url, moveItem.kind === 'folder' ? { parent: moveTarget } : { folder: moveTarget })
      toast.success('Spostato'); setMoveItem(null); setDetail(null); refresh()
    } catch (e) { toast.error(apiErrorToMessage(e)) } finally { setMoveBusy(false) }
  }

  const selectedFolderIds = [...selected].filter((k) => k.startsWith('folder-')).map((k) => Number(k.slice(7)))
  const selectedFileIds = [...selected].filter((k) => k.startsWith('file-')).map((k) => Number(k.slice(5)))
  const toggle = (key: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const doBulkDelete = async () => {
    try {
      await Promise.all([...selectedFolderIds.map((id) => api.delete(`/drive-folders/${id}/`)), ...selectedFileIds.map((id) => api.delete(`/drive-files/${id}/`))])
      toast.success(`${selected.size} elementi spostati nel cestino`)
    } catch { toast.error('Alcuni elementi non sono stati eliminati.') }
    setSelected(new Set()); refresh()
  }

  // ── Viste ──
  const kids = (parent: number | null) => tree.filter((f) => f.parent === parent)
  const treeNodes = (parent: number | null, depth: number): React.ReactNode => kids(parent).map((f) => {
    const has = kids(f.id).length > 0
    const isOpen = open.has(f.id)
    const locked = badgeOf(f) === 'lock'
    return (
      <li key={f.id}>
        <div className={`d-tn${f.id === folderId && !flat ? ' is-on' : ''}`} style={{ ['--d' as string]: depth }}>
          {has ? (
            <button type="button" className="d-tw" aria-expanded={isOpen} aria-label={`${isOpen ? 'Chiudi' : 'Apri'} ${f.name}`} onClick={() => setOpen((prev) => { const n = new Set(prev); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n })}>
              <CampoIcon name={isOpen ? 'chevD' : 'chevR'} size={13} />
            </button>
          ) : <span className="d-tw" />}
          <button type="button" className="dr-tl" aria-current={f.id === folderId && !flat ? 'page' : undefined} onClick={() => navigateTo(f.id)}>
            <FolderIcon size={16} /><span>{f.name}</span>{locked ? <span className="d-lock" title="Visibile solo ad alcuni gruppi"><CampoIcon name="lock" size={13} /></span> : null}<small>{f.files_count}</small>
          </button>
        </div>
        {has && isOpen ? <ul>{treeNodes(f.id, depth + 1)}</ul> : null}
      </li>
    )
  })

  const treeCustomers = React.useMemo(() => {
    const ids = new Set(tree.flatMap((f) => f.customers))
    return allCustomers.filter((c) => ids.has(c.id)).map((c) => ({ ...c, n: tree.filter((f) => f.customers.includes(c.id)).length }))
  }, [tree, allCustomers])

  const customerNames = (ids: number[]) => allCustomers.filter((c) => ids.includes(c.id))
  const custCell = (ids: number[]) => {
    const cs = customerNames(ids)
    return cs.length ? cs.slice(0, 2).map((c) => <span key={c.id} className="d-cust"><CampoIcon name="building" size={13} />{c.display_name}</span>) : <span className="none">—</span>
  }
  const openFile = (f: DriveFile) => setDetail({ kind: 'file', data: f })
  // Clic: mostra nel pannello. Doppio clic o Invio: nella cartella ci entri, il file si apre a tutto schermo.
  // Su mobile il tocco su una cartella ci entra subito, come prima.
  const clickFolder = (f: DriveFolder) => { if (isMobile) navigateTo(f.id); else setDetail({ kind: 'folder', data: f }) }
  const enterKey = (e: React.KeyboardEvent, go: () => void) => { if (e.key === 'Enter') { e.preventDefault(); go() } }
  const isOpen = (kind: 'file' | 'folder', id: number) => detail?.kind === kind && detail.data.id === id
  const crumbs = [{ id: null as number | null, name: 'Drive' }, ...breadcrumb.map((b) => ({ id: b.id as number | null, name: b.name }))]
  const showRecent = !flat && folderId === null && recent.length > 0
  const empty = !loading && !folders.length && !files.length

  const onDragOver = (e: React.DragEvent) => {
    if (!canUpload || !Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    if (!dragging) setDragging(true)
  }
  const onDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false) }
  const onDrop = (e: React.DragEvent) => {
    if (!canUpload) return
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files?.length) void handleUpload(e.dataTransfer.files)
  }
  const currentName = flat ? 'Drive' : crumbs[crumbs.length - 1].name

  // ── Tasto destro su cartelle e file ──
  const [ctx, setCtx] = React.useState<{ item: DrawerItem; x: number; y: number } | null>(null)
  const onCtx = (item: DrawerItem) => (e: React.MouseEvent) => { e.preventDefault(); setCtx({ item, x: e.clientX + 2, y: e.clientY - 6 }) }
  const ctxItems: RowContextMenuItem[] = (() => {
    if (!ctx) return []
    const it = ctx.item
    const key = `${it.kind}-${it.data.id}`
    const on = selected.has(key)
    const canSelect = it.kind === 'folder' ? canDelete : canDelete || canChange
    const ic = (name: Parameters<typeof CampoIcon>[0]['name']) => <CampoIcon name={name} size={16} />
    const head: RowContextMenuItem[] = it.kind === 'folder'
      ? [
          { key: 'enter', label: 'Apri la cartella', icon: ic('folder'), strong: true, onClick: () => navigateTo(it.data.id) },
          { key: 'detail', label: 'Dettagli', icon: ic('panel'), onClick: () => { setDetail(it); if (!floating) setPane(true) } },
        ]
      : [
          { key: 'full', label: 'Anteprima', icon: ic('eye'), strong: true, onClick: () => setFull(it.data as DriveFile) },
          { key: 'download', label: 'Scarica', icon: ic('download'), onClick: () => { window.open(`/api/drive-files/${it.data.id}/download/`, '_blank') } },
          { key: 'detail', label: 'Dettagli', icon: ic('panel'), onClick: () => { setDetail(it); if (!floating) setPane(true) } },
        ]
    return [
      ...head,
      { key: 'link', label: 'Copia link', icon: ic('copy'), onClick: async () => {
        await copyToClipboard(`${window.location.origin}/drive?${it.kind === 'file' ? `file=${it.data.id}` : `cartella=${it.data.id}`}`)
        toast.success('Link copiato: chi lo apre deve avere accesso alla cartella')
      } },
      { key: 'sel', label: on ? 'Togli dalla selezione' : selected.size ? 'Aggiungi alla selezione' : 'Seleziona', icon: ic('check'), hidden: !canSelect, dividerBefore: true, onClick: () => toggle(key) },
      { key: 'rename', label: 'Rinomina…', icon: ic('file'), hidden: !canChange, dividerBefore: true, onClick: () => { setRenameItem(it); setRenameName(it.data.name) } },
      { key: 'move', label: 'Sposta in…', icon: ic('folder'), hidden: !canChange, onClick: () => openMove(it) },
      { key: 'delete', label: 'Sposta nel cestino', icon: ic('trash'), hidden: !canDelete, dividerBefore: true, tone: 'danger', onClick: () => setDeleteItem(it) },
    ]
  })()
  const siblings = detail?.kind === 'file' ? files.filter((f) => f.folder === (detail.data as DriveFile).folder && f.id !== detail.data.id) : []

  return (
    <div className="dv" style={archiveVars(theme)}>
      <PageHead
        title="Drive"
        inline={<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: 'text.secondary' }}><CampoIcon name="cloud" size={15} />File oltre 25 MB: usa OneDrive</Box>}
        actions={
          <>
            {canAddFolder ? <Button variant="outlined" color="inherit" startIcon={<CampoIcon name="folder" size={16} />} onClick={() => { setCreateFolderName(''); setCreateFolderOpen(true) }}>Nuova cartella</Button> : null}
            {canUpload ? (
              <Button variant="contained" component="label" disabled={Boolean(upload)} startIcon={<CampoIcon name="upload" size={16} />}>
                {upload ? `Caricamento ${upload.current}/${upload.total}…` : 'Carica file'}
                <input type="file" multiple hidden onChange={(e) => { if (e.target.files?.length) void handleUpload(e.target.files); e.target.value = '' }} />
              </Button>
            ) : null}
          </>
        }
      />

      <section className={`d-a${dragging ? ' is-drop' : ''}${showPane ? ' has-pane' : ''}`} aria-label="Drive" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        <aside className="dr-side" aria-label="Cartelle e clienti">
          <label className="search"><CampoIcon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca in tutto il Drive" aria-label="Cerca nel Drive" /></label>
          <div className="dr-side-h">Cartelle</div>
          <ul className="d-tree">
            <li><div className={`d-tn${folderId === null && !flat ? ' is-on' : ''}`} style={{ ['--d' as string]: 0 }}><span className="d-tw" />
              <button type="button" className="dr-tl" onClick={() => navigateTo(null)}><CampoIcon name="cloud" size={16} /><span>Tutto il Drive</span></button></div></li>
            {treeNodes(null, 0)}
          </ul>
          <div className="dr-side-h">Clienti</div>
          <Autocomplete size="small" options={allCustomers} value={customerFilter} onChange={(_e, v) => pickCustomer(v)}
            getOptionLabel={(o) => o.display_name} isOptionEqualToValue={(a, b) => a.id === b.id} noOptionsText="Nessun cliente" clearOnEscape
            renderInput={(p) => <TextField {...p} placeholder="Filtra per cliente…" sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }} />} />
          <ul className="d-custs">
            {treeCustomers.map((c) => (
              <li key={c.id}><button type="button" aria-pressed={customerFilter?.id === c.id} onClick={() => pickCustomer(customerFilter?.id === c.id ? null : c)}>
                <CampoIcon name="building" size={15} /><span>{c.display_name}</span><small>{c.n}</small></button></li>
            ))}
          </ul>
        </aside>

        <div className="d-main">
          <div className="d-bar">
            <nav className="d-crumbs" aria-label="Percorso">
              {flat ? <button type="button" onClick={() => navigateTo(null)}><CampoIcon name="cloud" size={15} />Drive</button>
                : crumbs.map((c, i) => <React.Fragment key={c.id ?? 'root'}>{i ? <span>/</span> : null}<button type="button" aria-current={i === crumbs.length - 1 ? 'page' : undefined} onClick={() => navigateTo(c.id)}>{i === 0 ? <CampoIcon name="cloud" size={15} /> : null}{c.name}</button></React.Fragment>)}
            </nav>
            {customerFilter ? <span className="d-filter"><CampoIcon name="building" size={13} />{customerFilter.display_name}<button type="button" aria-label="Togli il filtro cliente" onClick={() => pickCustomer(null)}><CampoIcon name="x" size={12} /></button></span> : null}
            <span className="g-spacer" />
            {!showPane && !floating ? <button type="button" className="link-btn" onClick={() => setPane(true)}>Mostra i dettagli</button> : null}
            <div className="seg" role="group" aria-label="Vista">
              <button type="button" aria-pressed={viewMode === 'list'} title="Elenco" aria-label="Elenco" onClick={() => setViewMode('list')}><CampoIcon name="menu" size={15} /></button>
              <button type="button" aria-pressed={viewMode === 'grid'} title="Griglia" aria-label="Griglia" onClick={() => setViewMode('grid')}><CampoIcon name="dashboard" size={15} /></button>
            </div>
          </div>

          {upload ? (
            <div className="d-progress" role="status">
              <span>Caricamento di <b>{upload.fileName}</b> · {upload.current} di {upload.total} · {upload.overall}%</span>
              <span className="d-progress-bar"><i style={{ width: `${upload.overall}%` }} /></span>
            </div>
          ) : null}

          {selected.size ? (
            <div className="d-bulk" role="toolbar" aria-label="Elementi selezionati">
              <b>{selected.size} selezionat{selected.size === 1 ? 'o' : 'i'}</b>
              {canChange && selected.size === 1 ? (
                <Button size="small" variant="outlined" color="inherit" startIcon={<CampoIcon name="folder" size={14} />} onClick={() => {
                  const fo = folders.find((x) => x.id === selectedFolderIds[0]); const fi = files.find((x) => x.id === selectedFileIds[0])
                  if (fo) openMove({ kind: 'folder', data: fo }); else if (fi) openMove({ kind: 'file', data: fi })
                }}>Sposta</Button>
              ) : null}
              {canDelete ? <Button size="small" variant="outlined" color="inherit" startIcon={<CampoIcon name="trash" size={14} />} onClick={() => void doBulkDelete()}>Sposta nel cestino</Button> : null}
              <button type="button" className="link-btn" onClick={() => setSelected(new Set())}>Annulla selezione</button>
            </div>
          ) : null}

          {showRecent ? (
            <div className="d-recent">
              <div className="dr-side-h">Recenti</div>
              <ul>
                {recent.map((f) => (
                  <li key={f.id}><button type="button" onClick={() => openFile(f)} onContextMenu={onCtx({ kind: 'file', data: f })}>
                    <FileIcon kind={kindOf(f.name, f.mime_type)} ext={extOf(f.name)} size={38} />
                    <span className="d-n"><b>{f.name}</b><small>{f.folder_name ?? 'Drive'} · {rel(f.updated_at)}</small></span>
                  </button></li>
                ))}
              </ul>
            </div>
          ) : null}

          {flat && !loading ? <div className="d-count">{folders.length + files.length} risultati{search ? ` per «${search}»` : ''}{customerFilter ? ` · cliente ${customerFilter.display_name}` : ''}</div> : null}

          {empty ? (
            <div className="d-empty"><CampoIcon name="upload" size={20} /><div><b>{flat ? 'Nessun risultato' : 'Cartella vuota'}</b><p>{flat ? 'Prova con un altro nome o togli il filtro.' : canUpload ? 'Trascina qui i file o usa «Carica file».' : 'Non ci sono ancora file.'}</p></div></div>
          ) : viewMode === 'grid' ? (
            <ul className="d-grid">
              {folders.map((f) => (
                <li key={`folder-${f.id}`}><button type="button" className={`d-gi${isOpen('folder', f.id) ? ' is-open' : ''}`} aria-label={`Cartella ${f.name}`} onClick={() => clickFolder(f)} onDoubleClick={() => navigateTo(f.id)} onKeyDown={(e) => enterKey(e, () => navigateTo(f.id))} onContextMenu={onCtx({ kind: 'folder', data: f })}>
                  <span className="d-gthumb"><FolderIcon size={56} badge={badgeOf(f)} /></span><b>{f.name}</b><small>{f.files_count} file</small></button></li>
              ))}
              {files.map((f) => (
                <li key={`file-${f.id}`}><button type="button" className={`d-gi${isOpen('file', f.id) ? ' is-open' : ''}`} onClick={() => openFile(f)} onDoubleClick={() => setFull(f)} onKeyDown={(e) => enterKey(e, () => setFull(f))} onContextMenu={onCtx({ kind: 'file', data: f })}>
                  <span className="d-gthumb">{f.is_image ? <img src={`/api/drive-files/${f.id}/preview/`} alt="" loading="lazy" /> : <FileIcon kind={kindOf(f.name, f.mime_type)} ext={extOf(f.name)} size={64} />}</span>
                  <b>{f.name}</b><small>{f.size_human} · {rel(f.updated_at)}</small></button></li>
              ))}
            </ul>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="d-tbl">
                <thead><tr><th className="d-c-sel" /><th>Nome</th><th>Cliente</th><th className="num">Dimensione</th><th>Modificato</th><th /></tr></thead>
                <tbody>
                  {folders.map((f) => (
                    <tr key={`folder-${f.id}`} className={`is-folder${selected.has(`folder-${f.id}`) ? ' is-sel' : ''}${isOpen('folder', f.id) ? ' is-open' : ''}`} tabIndex={0}
                      onClick={() => clickFolder(f)} onDoubleClick={() => navigateTo(f.id)} onKeyDown={(e) => enterKey(e, () => navigateTo(f.id))} onContextMenu={onCtx({ kind: 'folder', data: f })}>
                      <td className="d-c-sel" onClick={(e) => e.stopPropagation()}>{canDelete ? <input type="checkbox" aria-label={`Seleziona cartella ${f.name}`} checked={selected.has(`folder-${f.id}`)} onChange={() => toggle(`folder-${f.id}`)} /> : null}</td>
                      <td className="d-c-name"><span className="d-nm"><FolderIcon size={22} badge={badgeOf(f)} /><span className="d-n"><b>{f.name}</b>{flat ? <small>{f.full_path}</small> : null}</span></span></td>
                      <td>{custCell(f.customers)}</td>
                      <td className="num">{f.files_count} file</td>
                      <td className="d-c-upd">{rel(f.updated_at)}</td>
                      <td className="d-c-act" onClick={(e) => e.stopPropagation()}>
                        {isMobile ? <Tooltip title="Dettagli della cartella"><IconButton size="small" aria-label={`Dettagli di ${f.name}`} onClick={() => setDetail({ kind: 'folder', data: f })}><CampoIcon name="more" size={16} /></IconButton></Tooltip> : null}
                      </td>
                    </tr>
                  ))}
                  {files.map((f) => (
                    <tr key={`file-${f.id}`} className={`${selected.has(`file-${f.id}`) ? 'is-sel' : ''}${isOpen('file', f.id) ? ' is-open' : ''}`} tabIndex={0}
                      onClick={() => openFile(f)} onDoubleClick={() => setFull(f)} onKeyDown={(e) => enterKey(e, () => setFull(f))} onContextMenu={onCtx({ kind: 'file', data: f })}>
                      <td className="d-c-sel" onClick={(e) => e.stopPropagation()}>{canDelete || canChange ? <input type="checkbox" aria-label={`Seleziona file ${f.name}`} checked={selected.has(`file-${f.id}`)} onChange={() => toggle(`file-${f.id}`)} /> : null}</td>
                      <td className="d-c-name"><span className="d-nm"><FileIcon kind={kindOf(f.name, f.mime_type)} ext={extOf(f.name)} size={28} /><span className="d-n"><b>{f.name}</b>{flat ? <small>{f.folder_name ?? 'Drive'}</small> : null}</span></span></td>
                      <td>{custCell(f.customers)}</td>
                      <td className="num">{f.size_human}</td>
                      <td className="d-c-upd">{rel(f.updated_at)}<small>{f.updated_by_name ?? f.created_by_name ?? ''}</small></td>
                      <td className="d-c-act" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Scarica"><IconButton size="small" aria-label={`Scarica ${f.name}`} onClick={() => window.open(`/api/drive-files/${f.id}/download/`, '_blank')}><CampoIcon name="download" size={16} /></IconButton></Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="d-drop" aria-hidden={!dragging}><CampoIcon name="upload" size={30} /><b>Rilascia per caricare in {currentName}</b><small>max 25 MB per file · niente eseguibili</small></div>
        </div>
        {showPane ? (
        <DriveDetail
          item={detail}
          customers={allCustomers}
          siblings={siblings}
          canChange={canChange}
          canDelete={canDelete}
          canSeeAudit={canSeeAudit}
          onClose={() => (floating ? setDetail(null) : setPane(false))}
          onFull={setFull}
          onOpenFolder={(id) => navigateTo(id)}
          onOpenFile={openFile}
          onRename={(it) => { setRenameItem(it); setRenameName(it.data.name) }}
          onMove={openMove}
          onDelete={(it) => setDeleteItem(it)}
          onChanged={(it) => {
            setDetail(it)
            if (it.kind === 'file') setFiles((prev) => prev.map((x) => (x.id === it.data.id ? (it.data as DriveFile) : x)))
            else { setFolders((prev) => prev.map((x) => (x.id === it.data.id ? (it.data as DriveFolder) : x))); setTree((prev) => prev.map((x) => (x.id === it.data.id ? (it.data as DriveFolder) : x))) }
          }}
        />
        ) : null}
      </section>


      <RowContextMenu open={Boolean(ctx)} anchorPosition={ctx ? { top: ctx.y, left: ctx.x } : undefined} onClose={() => setCtx(null)} items={ctxItems} />
      <DriveFullPreview file={full} onClose={() => setFull(null)} />
      <CreateFolderDialog open={createFolderOpen} name={createFolderName} busy={createFolderBusy} onNameChange={setCreateFolderName} onClose={() => setCreateFolderOpen(false)} onCreate={doCreateFolder} />
      <RenameDialog item={renameItem} name={renameName} busy={renameBusy} onNameChange={setRenameName} onClose={() => setRenameItem(null)} onRename={doRename} />
      <MoveDialog item={moveItem} folders={tree.filter((f) => !(moveItem?.kind === 'folder' && f.id === moveItem.data.id))} target={moveTarget} busy={moveBusy} onSelectTarget={setMoveTarget} onClose={() => setMoveItem(null)} onMove={doMove} />
      <ConfirmDeleteDialog open={!!deleteItem} busy={deleteBusy} title="Spostare nel cestino?" description={`«${deleteItem?.data.name}» verrà spostato nel cestino e potrà essere ripristinato.`} onClose={() => setDeleteItem(null)} onConfirm={doDelete} />
    </div>
  )
}
