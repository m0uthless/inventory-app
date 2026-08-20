import * as React from 'react'
import { alpha } from '@mui/material/styles'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'

import AddIcon from '@mui/icons-material/Add'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined'
import FolderIcon from '@mui/icons-material/Folder'
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined'
import ReorderIcon from '@mui/icons-material/Reorder'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'

import { Can } from '../auth/Can'
import { PERMS } from '../auth/perms'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import ConfirmDeleteDialog from '@shared/ui/ConfirmDeleteDialog'

import type { BreadcrumbItem, CustomerMini, DrawerItem, DriveFile, DriveFolder } from './drive/types'
import { UploadZone } from './drive/UploadZone'
import { PreviewDrawer } from './drive/PreviewDrawer'
import { FolderCard } from './drive/FolderCard'
import { FileCard } from './drive/FileCard'
import { FolderListRow } from './drive/FolderListRow'
import { FileListRow } from './drive/FileListRow'
import { CreateFolderDialog } from './drive/CreateFolderDialog'
import { RenameDialog } from './drive/RenameDialog'
import { MoveDialog } from './drive/MoveDialog'
import { useWidgetAccents } from '../theme/AppThemeProvider'

// ─── Main Page ────────────────────────────────────────────────────────────────

// prettier-ignore
export default function Drive() {
  const toast = useToast()
  const widgetAccents = useWidgetAccents()

  const [folderId, setFolderId] = React.useState<number | null>(null)
  const [breadcrumb, setBreadcrumb] = React.useState<BreadcrumbItem[]>([])
  const [folders, setFolders] = React.useState<DriveFolder[]>([])
  const [files, setFiles] = React.useState<DriveFile[]>([])
  const [loading, setLoading] = React.useState(false)

  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('list')
  const [drawerItem, setDrawerItem] = React.useState<DrawerItem | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  // Dialogs
  const [createFolderOpen, setCreateFolderOpen] = React.useState(false)
  const [createFolderName, setCreateFolderName] = React.useState('')
  const [createFolderBusy, setCreateFolderBusy] = React.useState(false)

  const [renameItem, setRenameItem] = React.useState<DrawerItem | null>(null)
  const [renameName, setRenameName] = React.useState('')
  const [renameBusy, setRenameBusy] = React.useState(false)

  const [deleteItem, setDeleteItem] = React.useState<DrawerItem | null>(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)

  const [moveItem, setMoveItem] = React.useState<DrawerItem | null>(null)
  const [moveFolders, setMoveFolders] = React.useState<DriveFolder[]>([])
  const [moveTarget, setMoveTarget] = React.useState<number | null>(null)
  const [moveBusy, setMoveBusy] = React.useState(false)

  const [uploadProgress, setUploadProgress] = React.useState<{
    active: boolean
    current: number // file index (1-based)
    total: number // total files
    fileName: string
    fileProgress: number // 0-100 for current file
    overallProgress: number // 0-100 overall
  } | null>(null)

  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  const toggleSelect = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }
  const clearSelection = () => setSelected(new Set())

  const selectedFolderIds = [...selected]
    .filter((k) => k.startsWith('folder-'))
    .map((k) => Number(k.replace('folder-', '')))
  const selectedFileIds = [...selected]
    .filter((k) => k.startsWith('file-'))
    .map((k) => Number(k.replace('file-', '')))
  const [customerFilter, setCustomerFilter] = React.useState<CustomerMini | null>(null)
  const [allCustomers, setAllCustomers] = React.useState<CustomerMini[]>([])

  // Load customers for filter autocomplete
  React.useEffect(() => {
    api
      .get('/customers/', { params: { page_size: 500, ordering: 'display_name' } })
      .then((r) => setAllCustomers(r.data?.results ?? r.data ?? []))
      .catch(() => {})
  }, [])

  // ── Load current folder contents ──────────────────────────────────────────

  // Fix P1 7.4: incrementale, permette a loadFolder di riconoscere ed
  // ignorare risposte "in ritardo" rispetto a una richiesta più recente
  // (es. navigazione rapida o cambio filtro cliente durante un fetch).
  const loadFolderRequestId = React.useRef(0)

  const loadFolder = React.useCallback(
    async (id: number | null, custFilter?: CustomerMini | null) => {
      const requestId = ++loadFolderRequestId.current
      setLoading(true)
      setFolders([])
      setFiles([])
      try {
        const cust = custFilter ?? undefined
        const custParam = cust ? { customer: cust.id } : {}

        if (id === null) {
          // Root: top-level folders + root files (filtered by customer if set)
          const [fRes, fileRes] = await Promise.all([
            api.get('/drive-folders/', { params: { root: 'true', page_size: 200, ...custParam } }),
            api.get('/drive-files/', { params: { root: 'true', page_size: 200, ...custParam } }),
          ])
          if (loadFolderRequestId.current !== requestId) return // risposta obsoleta, ignorata
          setFolders(fRes.data?.results ?? fRes.data ?? [])
          setFiles(fileRes.data?.results ?? fileRes.data ?? [])
          setBreadcrumb([])
        } else {
          const res = await api.get(`/drive-folders/${id}/children/`, { params: custParam })
          if (loadFolderRequestId.current !== requestId) return // risposta obsoleta, ignorata
          setFolders(res.data.folders ?? [])
          setFiles(res.data.files ?? [])
          // Breadcrumb
          const bcRes = await api.get(`/drive-folders/${id}/breadcrumb/`)
          if (loadFolderRequestId.current !== requestId) return // risposta obsoleta, ignorata
          setBreadcrumb(bcRes.data ?? [])
        }
      } catch (e) {
        if (loadFolderRequestId.current !== requestId) return // richiesta superata, non mostrare errore
        toast.error(apiErrorToMessage(e))
      } finally {
        if (loadFolderRequestId.current === requestId) setLoading(false)
      }
    },
    [toast],
  )

  React.useEffect(() => {
    void loadFolder(folderId, customerFilter)
  }, [folderId, customerFilter, loadFolder])

  // ── Navigation ────────────────────────────────────────────────────────────

  const navigateTo = (id: number | null) => {
    // Fix P1 7.2: prima chiamava anche loadFolder(id, ...) qui, mentre
    // l'useEffect sopra osserva folderId e richiama loadFolder a sua volta:
    // ogni cambio cartella produceva due richieste. Ora si limita ad
    // aggiornare lo stato; il caricamento resta responsabilità dell'effect.
    setFolderId(id)
    setSelectedId(null)
    setDrawerItem(null)
  }

  const selectItem = (key: string, item: DrawerItem) => {
    if (selectedId === key) {
      setDrawerItem(null)
      setSelectedId(null)
    } else {
      setSelectedId(key)
      setDrawerItem(item)
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleUpload = async (fileList: FileList) => {
    const files = Array.from(fileList)
    const total = files.length
    let failed = 0

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      setUploadProgress({
        active: true,
        current: i + 1,
        total,
        fileName: f.name,
        fileProgress: 0,
        overallProgress: Math.round((i / total) * 100),
      })

      const fd = new FormData()
      fd.append('file', f)
      fd.append('name', f.name)
      if (folderId !== null) fd.append('folder', String(folderId))

      try {
        await api.post('/drive-files/', fd, {
          onUploadProgress: (evt) => {
            const fileProgress = evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0
            const overallProgress = Math.round(((i + fileProgress / 100) / total) * 100)
            setUploadProgress((prev) =>
              prev
                ? {
                    ...prev,
                    fileProgress,
                    overallProgress,
                  }
                : null,
            )
          },
        })
      } catch {
        failed++
      }
    }

    setUploadProgress(null)
    if (failed) toast.error(`${failed} file non caricati.`)
    else toast.success(`${total} file caricati`)
    void loadFolder(folderId, customerFilter)
  }

  // ── Create folder ─────────────────────────────────────────────────────────

  const doCreateFolder = async () => {
    if (!createFolderName.trim()) return
    setCreateFolderBusy(true)
    try {
      await api.post('/drive-folders/', {
        name: createFolderName.trim(),
        parent: folderId ?? null,
      })
      toast.success('Cartella creata')
      setCreateFolderOpen(false)
      setCreateFolderName('')
      void loadFolder(folderId, customerFilter) // Fix P1 7.3: preserva il filtro cliente dopo la mutazione
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setCreateFolderBusy(false)
    }
  }

  // ── Rename ────────────────────────────────────────────────────────────────

  const openRename = (item: DrawerItem) => {
    setRenameItem(item)
    setRenameName(item.data.name)
  }

  const doRename = async () => {
    if (!renameItem || !renameName.trim()) return
    setRenameBusy(true)
    try {
      const url =
        renameItem.kind === 'folder'
          ? `/drive-folders/${renameItem.data.id}/`
          : `/drive-files/${renameItem.data.id}/`
      await api.patch(url, { name: renameName.trim() })
      toast.success('Rinominato')
      setRenameItem(null)
      setDrawerItem(null)
      setSelectedId(null)
      void loadFolder(folderId, customerFilter) // Fix P1 7.3: preserva il filtro cliente dopo la mutazione
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setRenameBusy(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const openDelete = (item: DrawerItem) => setDeleteItem(item)

  const doDelete = async () => {
    if (!deleteItem) return
    setDeleteBusy(true)
    try {
      const url =
        deleteItem.kind === 'folder'
          ? `/drive-folders/${deleteItem.data.id}/`
          : `/drive-files/${deleteItem.data.id}/`
      await api.delete(url)
      toast.success('Eliminato')
      setDeleteItem(null)
      setDrawerItem(null)
      setSelectedId(null)
      void loadFolder(folderId, customerFilter) // Fix P1 7.3: preserva il filtro cliente dopo la mutazione
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleteBusy(false)
    }
  }

  // ── Move ──────────────────────────────────────────────────────────────────

  const openMove = async (item: DrawerItem) => {
    setMoveItem(item)
    setMoveTarget(null)
    try {
      const res = await api.get('/drive-folders/', { params: { page_size: 200 } })
      const allFolders: DriveFolder[] = res.data?.results ?? res.data ?? []
      // Exclude the item itself if it's a folder
      const filtered =
        item.kind === 'folder' ? allFolders.filter((f) => f.id !== item.data.id) : allFolders
      setMoveFolders(filtered)
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    }
  }

  const doMove = async () => {
    if (!moveItem) return
    setMoveBusy(true)
    try {
      const url =
        moveItem.kind === 'folder'
          ? `/drive-folders/${moveItem.data.id}/move/`
          : `/drive-files/${moveItem.data.id}/move/`
      const body = moveItem.kind === 'folder' ? { parent: moveTarget } : { folder: moveTarget }
      await api.post(url, body)
      toast.success('Spostato')
      setMoveItem(null)
      setDrawerItem(null)
      setSelectedId(null)
      void loadFolder(folderId, customerFilter) // Fix P1 7.3: preserva il filtro cliente dopo la mutazione
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setMoveBusy(false)
    }
  }

  // ── Bulk delete ──────────────────────────────────────────────────────────────
  const doBulkDelete = async () => {
    const folderReqs = selectedFolderIds.map((id) => api.delete(`/drive-folders/${id}/`))
    const fileReqs = selectedFileIds.map((id) => api.delete(`/drive-files/${id}/`))
    try {
      await Promise.all([...folderReqs, ...fileReqs])
      toast.success(`${selected.size} elementi eliminati`)
    } catch {
      toast.error('Alcuni elementi non sono stati eliminati.')
    }
    clearSelection()
    void loadFolder(folderId, customerFilter)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Stack spacing={2}>
      {/* OneDrive disclaimer */}
      {/* Il tint del box (blu Microsoft chiaro) è pensato per accompagnare
          visivamente il logo OneDrive sotto — stessa eccezione strutturale
          del logo stesso, non segue il tema di ARCHIE. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1.5,
          py: 1,
          borderRadius: 1.5,
          bgcolor: '#e8f0fe',
          border: '1px solid #c2d4f8',
        }}
      >
        {/* OneDrive logo SVG inline — colori brand ufficiali Microsoft
            (#0078D4/#1490DF), eccezione strutturale al sistema di tema:
            un logo di terze parti non può seguire il tema di ARCHIE. */}
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.5 13.5H18.5C19.88 13.5 21 12.38 21 11C21 9.74 20.09 8.69 18.89 8.52C18.96 8.18 19 7.84 19 7.5C19 5.01 16.99 3 14.5 3C13.23 3 12.08 3.52 11.26 4.36C10.7 3.53 9.76 3 8.7 3C7.04 3 5.66 4.21 5.44 5.8C4.06 6.16 3 7.42 3 8.9C3 10.63 4.37 12 6.1 12H8.5V13.5Z" fill="#0078D4"/>
            <path d="M13.5 13.5H18.5C19.88 13.5 21 12.38 21 11C21 9.74 20.09 8.69 18.89 8.52C18.96 8.18 19 7.84 19 7.5C19 5.01 16.99 3 14.5 3C13.23 3 12.08 3.52 11.26 4.36L13.5 13.5Z" fill="#1490DF"/>
          </svg>
        </Box>
        <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: '#1a3a6e', lineHeight: 1.4 }}>
          Si ricorda che per condividere file di grosse dimensioni la piattaforma corretta è{' '}
          <Box component="span" sx={{ fontWeight: 700 }}>OneDrive</Box>.
        </Typography>
      </Box>

      {/* Topbar: breadcrumb + search + actions */}
      <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
        {/* Breadcrumb */}
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flex: 1, flexWrap: 'wrap' }}>
          <Typography
            variant="body2"
            onClick={() => navigateTo(null)}
            sx={{
              cursor: 'pointer',
              color: folderId === null ? 'text.primary' : 'text.disabled',
              fontWeight: folderId === null ? 600 : 400,
              '&:hover': { color: 'primary.main' },
            }}
          >
            Root
          </Typography>
          {breadcrumb.map((bc, i) => (
            <React.Fragment key={bc.id}>
              <Typography variant="body2" sx={{ color: 'grey.300' }}>
                /
              </Typography>
              <Typography
                variant="body2"
                onClick={() => navigateTo(bc.id)}
                sx={{
                  cursor: 'pointer',
                  color: i === breadcrumb.length - 1 ? 'text.primary' : 'text.disabled',
                  fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                  '&:hover': { color: 'primary.main' },
                }}
              >
                {bc.name}
              </Typography>
            </React.Fragment>
          ))}
        </Stack>

        {/* Customer filter */}
        <Autocomplete
          size="small"
          options={allCustomers}
          value={customerFilter}
          onChange={(_e, val) => {
            setCustomerFilter(val)
            setFolderId(null)
            setBreadcrumb([])
          }}
          getOptionLabel={(o) => o.display_name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Filtra per cliente…"
              size="small"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1, bgcolor: 'background.paper' }, width: 210 }}
            />
          )}
          noOptionsText="Nessun cliente"
          clearOnEscape
        />

        {/* View toggle */}
        <Stack
          direction="row"
          spacing={0.25}
          sx={{
            border: '1px solid',
            borderColor: 'grey.200',
            borderRadius: 1.5,
            p: 0.25,
            bgcolor: 'background.paper',
          }}
        >
          {(
            [
              ['grid', <GridViewOutlinedIcon fontSize="small" />],
              ['list', <ReorderIcon fontSize="small" />],
            ] as const
          ).map(([m, icon]) => (
            <Tooltip key={m} title={m === 'grid' ? 'Griglia' : 'Lista'}>
              <IconButton
                size="small"
                aria-label={m === 'grid' ? 'Griglia' : 'Lista'}
                onClick={() => setViewMode(m)}
                sx={{
                  borderRadius: 1.25,
                  bgcolor: viewMode === m ? 'primary.main' : 'transparent',
                  color: viewMode === m ? 'common.white' : 'grey.500',
                  '&:hover': { bgcolor: viewMode === m ? 'primary.dark' : 'grey.100' },
                }}
              >
                {icon}
              </IconButton>
            </Tooltip>
          ))}
        </Stack>

        {/* Create folder */}
        <Can perm={PERMS.drive.folder.add}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CreateNewFolderIcon />}
            onClick={() => {
              setCreateFolderName('')
              setCreateFolderOpen(true)
            }}
            sx={{
              borderColor: 'grey.300',
              color: 'text.secondary',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            Nuova cartella
          </Button>
        </Can>

        {/* Upload */}
        <Can perm={PERMS.drive.file.add}>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            component="label"
            disabled={!!uploadProgress}
          >
            {uploadProgress
              ? `Caricamento ${uploadProgress.current}/${uploadProgress.total}…`
              : 'Carica file'}
            <input
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) handleUpload(e.target.files)
              }}
            />
          </Button>
        </Can>
      </Stack>

      {/* Loading bar */}
      {loading && <LinearProgress sx={{ borderRadius: 1 }} />}

      {/* Upload progress */}
      {uploadProgress && (
        <Box
          sx={{
            bgcolor: widgetAccents.softTealBg,
            border: '1px solid',
            borderColor: 'primary.light',
            borderRadius: 1,
            px: 2,
            py: 1.5,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
            <UploadFileOutlinedIcon sx={{ color: 'primary.main', fontSize: 18, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 0.5 }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: 'primary.main',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '70%',
                  }}
                >
                  {uploadProgress.fileName}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
                  {uploadProgress.current}/{uploadProgress.total} file ·{' '}
                  {uploadProgress.overallProgress}%
                </Typography>
              </Stack>
              {/* Overall progress */}
              <Box
                sx={{
                  height: 6,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${uploadProgress.overallProgress}%`,
                    bgcolor: 'primary.main',
                    borderRadius: 1,
                    transition: 'width 0.2s ease',
                  }}
                />
              </Box>
              {/* Per-file progress */}
              {uploadProgress.total === 1 ? null : (
                <Box
                  sx={{
                    height: 3,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                    borderRadius: 1,
                    overflow: 'hidden',
                    mt: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: `${uploadProgress.fileProgress}%`,
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.5),
                      borderRadius: 1,
                      transition: 'width 0.15s ease',
                    }}
                  />
                </Box>
              )}
            </Box>
          </Stack>
        </Box>
      )}

      {/* Active filter chip */}
      {customerFilter && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Filtro attivo:
          </Typography>
          <Chip
            size="small"
            label={customerFilter.display_name}
            onDelete={() => {
              setCustomerFilter(null)
              setFolderId(null)
              setBreadcrumb([])
            }}
            color="primary"
            variant="outlined"
            sx={{ fontSize: 11 }}
          />
        </Stack>
      )}

      {/* Upload drop zone */}
      <Can perm={PERMS.drive.file.add}>
        <UploadZone onFiles={handleUpload} />
      </Can>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{
            px: 2,
            py: 1.25,
            bgcolor: widgetAccents.softTealBg,
            border: '1px solid',
            borderColor: 'primary.light',
            borderRadius: 1,
          }}
        >
          <CheckBoxIcon sx={{ color: 'primary.main', fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', flex: 1 }}>
            {selected.size} selezionati
          </Typography>
          <Can perm={PERMS.drive.folder.change}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DriveFileMoveOutlinedIcon />}
              onClick={() => {
                // move first selected item — bulk move opens move dialog for first item
                // Full bulk move would require a different dialog; for now open move for first
                const firstFolder = selectedFolderIds[0]
                const firstFile = selectedFileIds[0]
                if (firstFolder) {
                  const f = folders.find((x) => x.id === firstFolder)
                  if (f) openMove({ kind: 'folder', data: f })
                } else if (firstFile) {
                  const f = files.find((x) => x.id === firstFile)
                  if (f) openMove({ kind: 'file', data: f })
                }
              }}
              sx={{ borderColor: 'primary.light' }}
            >
              Sposta
            </Button>
          </Can>
          <Can perm={PERMS.drive.file.delete}>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={doBulkDelete}
            >
              Elimina ({selected.size})
            </Button>
          </Can>
          <Button
            size="small"
            variant="text"
            onClick={clearSelection}
            sx={{ color: 'text.disabled' }}
          >
            Annulla
          </Button>
        </Stack>
      )}

      {/* Unified folders + files */}
      {(folders.length > 0 || files.length > 0) &&
        (viewMode === 'grid' ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
              gap: 1.25,
            }}
          >
            {folderId !== null && (
              <Box
                onClick={() => {
                  const parent =
                    breadcrumb.length >= 2 ? breadcrumb[breadcrumb.length - 2].id : null
                  navigateTo(parent)
                }}
                sx={{
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 1,
                  p: 1.5,
                  cursor: 'pointer',
                  bgcolor: 'background.paper',
                  transition: 'all 0.13s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  '&:hover': { bgcolor: 'grey.50', borderColor: 'grey.300' },
                }}
              >
                <Typography sx={{ fontSize: 20, color: 'text.disabled', lineHeight: 1 }}>
                  ‹
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.disabled' }}>
                  ..
                </Typography>
              </Box>
            )}
            {folders.map((f) => (
              <FolderCard
                key={`folder-${f.id}`}
                folder={f}
                onOpen={() => navigateTo(f.id)}
                onRename={() => openRename({ kind: 'folder', data: f })}
                onMove={() => openMove({ kind: 'folder', data: f })}
                onDelete={() => openDelete({ kind: 'folder', data: f })}
                onLinkCustomers={() => selectItem(`folder-${f.id}`, { kind: 'folder', data: f })}
              />
            ))}
            {files.map((f) => (
              <FileCard
                key={`file-${f.id}`}
                file={f}
                selected={selectedId === `file-${f.id}`}
                onSelect={() => selectItem(`file-${f.id}`, { kind: 'file', data: f })}
                onRename={() => openRename({ kind: 'file', data: f })}
                onMove={() => openMove({ kind: 'file', data: f })}
                onDelete={() => openDelete({ kind: 'file', data: f })}
                onLinkCustomers={() => selectItem(`file-${f.id}`, { kind: 'file', data: f })}
              />
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'grey.200',
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: 'background.paper',
            }}
          >
            {/* ".." back row — shown only when not in root */}
            {folderId !== null && (
              <Stack
                direction="row"
                alignItems="center"
                spacing={1.5}
                onClick={() => {
                  const parent =
                    breadcrumb.length >= 2 ? breadcrumb[breadcrumb.length - 2].id : null
                  navigateTo(parent)
                }}
                sx={{
                  px: 2,
                  py: 1,
                  borderBottom: '1px solid',
                  borderColor: 'grey.100',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.04) },
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    bgcolor: (theme) => theme.palette.background.default,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography
                    sx={{ fontSize: 14, fontWeight: 700, color: 'text.disabled', lineHeight: 1 }}
                  >
                    ‹
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.disabled' }}>
                  ..
                </Typography>
              </Stack>
            )}
            {folders.map((f, i) => (
              <FolderListRow
                key={f.id}
                folder={f}
                idx={i}
                total={folders.length + files.length + (folderId !== null ? 1 : 0)}
                onOpen={() => navigateTo(f.id)}
                onRename={() => openRename({ kind: 'folder', data: f })}
                onMove={() => openMove({ kind: 'folder', data: f })}
                onDelete={() => openDelete({ kind: 'folder', data: f })}
                onLinkCustomers={() => selectItem(`folder-${f.id}`, { kind: 'folder', data: f })}
                isSelected={selected.has(`folder-${f.id}`)}
                onToggleSelect={(e) => toggleSelect(`folder-${f.id}`, e)}
              />
            ))}
            {files.map((f, i) => (
              <FileListRow
                key={f.id}
                file={f}
                idx={i}
                globalIdx={folders.length + i + (folderId !== null ? 1 : 0)}
                totalItems={folders.length + files.length + (folderId !== null ? 1 : 0)}
                selected={selectedId === `file-${f.id}`}
                onSelect={() => selectItem(`file-${f.id}`, { kind: 'file', data: f })}
                onRename={() => openRename({ kind: 'file', data: f })}
                onMove={() => openMove({ kind: 'file', data: f })}
                onDelete={() => openDelete({ kind: 'file', data: f })}
                onLinkCustomers={() => selectItem(`file-${f.id}`, { kind: 'file', data: f })}
                isChecked={selected.has(`file-${f.id}`)}
                onToggleCheck={(e) => toggleSelect(`file-${f.id}`, e)}
              />
            ))}
          </Box>
        ))}

      {/* Empty state — show ".." back row even when folder is empty */}
      {!loading && folders.length === 0 && files.length === 0 && (
        <Box>
          {folderId !== null && (
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'grey.200',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'background.paper',
                mb: 2,
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={1.5}
                onClick={() => {
                  const parent =
                    breadcrumb.length >= 2 ? breadcrumb[breadcrumb.length - 2].id : null
                  navigateTo(parent)
                }}
                sx={{
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.04) },
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    bgcolor: (theme) => theme.palette.background.default,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography
                    sx={{ fontSize: 14, fontWeight: 700, color: 'text.disabled', lineHeight: 1 }}
                  >
                    ‹
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.disabled' }}>
                  ..
                </Typography>
              </Stack>
            </Box>
          )}
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
            <FolderIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography variant="body2">Cartella vuota</Typography>
            <Typography variant="caption">Carica file o crea una nuova cartella.</Typography>
          </Box>
        </Box>
      )}

      {/* ── Preview Drawer ── */}
      <PreviewDrawer
        item={drawerItem}
        onClose={() => {
          setDrawerItem(null)
          setSelectedId(null)
        }}
      />

      {/* ── Create folder dialog ── */}
      <CreateFolderDialog
        open={createFolderOpen}
        name={createFolderName}
        busy={createFolderBusy}
        onNameChange={setCreateFolderName}
        onClose={() => setCreateFolderOpen(false)}
        onCreate={doCreateFolder}
      />

      {/* ── Rename dialog ── */}
      <RenameDialog
        item={renameItem}
        name={renameName}
        busy={renameBusy}
        onNameChange={setRenameName}
        onClose={() => setRenameItem(null)}
        onRename={doRename}
      />

      {/* ── Move dialog ── */}
      <MoveDialog
        item={moveItem}
        folders={moveFolders}
        target={moveTarget}
        busy={moveBusy}
        onSelectTarget={setMoveTarget}
        onClose={() => setMoveItem(null)}
        onMove={doMove}
      />

      {/* ── Delete confirm ── */}
      <ConfirmDeleteDialog
        open={!!deleteItem}
        busy={deleteBusy}
        title="Confermi eliminazione?"
        description={`"${deleteItem?.data.name}" verrà spostato nel cestino.`}
        onClose={() => setDeleteItem(null)}
        onConfirm={doDelete}
      />
    </Stack>
  )
}
