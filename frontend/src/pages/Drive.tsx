import * as React from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'

import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import FolderIcon from '@mui/icons-material/Folder'
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ReorderIcon from '@mui/icons-material/Reorder'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'

import { Can } from '../auth/Can'
import { PERMS } from '../auth/perms'
import { api } from '../api/client'
import { apiErrorToMessage } from '../api/error'
import { useToast } from '../ui/toast'
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog'
import { ActionIconButton } from '../ui/ActionIconButton'

// ─── Types ────────────────────────────────────────────────────────────────────

type DriveFolder = {
  id: number
  name: string
  parent: number | null
  full_path: string
  children_count: number
  files_count: number
  customers: number[]
  created_by_name: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type DriveFile = {
  id: number
  name: string
  folder: number | null
  folder_name: string | null
  file: string
  mime_type: string
  size: number
  size_human: string
  extension: string
  is_previewable: boolean
  is_image: boolean
  is_pdf: boolean
  customers: number[]
  created_by_name: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type BreadcrumbItem = { id: number; name: string }
type CustomerMini = { id: number; display_name: string }

type DrawerItem = { kind: 'folder'; data: DriveFolder } | { kind: 'file'; data: DriveFile }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts?: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function FileTypeIcon({ mime, size = 20 }: { mime?: string; ext?: string; size?: number }) {
  const isImage = mime?.startsWith('image/')
  const isPdf = mime === 'application/pdf'

  if (isImage) return <ImageOutlinedIcon sx={{ fontSize: size, color: '#16a34a' }} />
  if (isPdf) return <PictureAsPdfOutlinedIcon sx={{ fontSize: size, color: '#dc2626' }} />
  return <InsertDriveFileOutlinedIcon sx={{ fontSize: size, color: '#2563eb' }} />
}

function fileIconBg(mime?: string) {
  if (mime?.startsWith('image/')) return { bg: '#f0fdf4', color: '#16a34a' }
  if (mime === 'application/pdf') return { bg: '#fff1f2', color: '#dc2626' }
  return { bg: '#eff6ff', color: '#2563eb' }
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

const MAX_UPLOAD_MB = 25
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
const BLOCKED_EXT = new Set([
  'exe',
  'bat',
  'cmd',
  'com',
  'msi',
  'sh',
  'bash',
  'ps1',
  'vbs',
  'js',
  'ts',
  'php',
  'py',
  'rb',
  'pl',
  'jar',
  'dll',
  'so',
])

function UploadZone({ onFiles }: { onFiles: (files: FileList) => void }) {
  const [over, setOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const toast = useToast()

  const validate = (files: FileList): FileList | null => {
    const errors: string[] = []
    Array.from(files).forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (BLOCKED_EXT.has(ext)) {
        errors.push(`"${f.name}" — tipo di file non consentito (.${ext})`)
      } else if (f.size > MAX_UPLOAD_BYTES) {
        const mb = (f.size / 1024 / 1024).toFixed(1)
        errors.push(`"${f.name}" — troppo grande (${mb} MB, max ${MAX_UPLOAD_MB} MB)`)
      }
    })
    if (errors.length) {
      errors.forEach((e) => toast.error(e))
      return null
    }
    return files
  }

  return (
    <Box
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (e.dataTransfer.files.length) {
          const valid = validate(e.dataTransfer.files)
          if (valid) onFiles(valid)
        }
      }}
      onClick={() => inputRef.current?.click()}
      sx={{
        border: '2px dashed',
        borderColor: over ? 'primary.main' : 'grey.200',
        borderRadius: 3,
        py: 2,
        px: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        background: over ? 'rgba(15,118,110,0.04)' : '#fafafa',
        transition: 'all 0.15s',
        cursor: 'pointer',
        mb: 2.5,
        '&:hover': { borderColor: 'primary.main', background: 'rgba(15,118,110,0.03)' },
      }}
    >
      <UploadFileOutlinedIcon sx={{ color: over ? 'primary.main' : 'grey.400', fontSize: 22 }} />
      <Box sx={{ flex: 1 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: over ? 'primary.main' : 'text.secondary' }}
        >
          Trascina file qui
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          oppure{' '}
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
            seleziona dal computer
          </Box>
          {' · '}max {MAX_UPLOAD_MB} MB · no file eseguibili
        </Typography>
      </Box>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) {
            const valid = validate(e.target.files)
            if (valid) onFiles(valid)
          }
          e.target.value = '' // reset so same file can be re-selected
        }}
      />
    </Box>
  )
}

// ─── Preview Drawer ───────────────────────────────────────────────────────────

function PreviewDrawer({
  item,
  onClose,
}: {
  item: DrawerItem | null
  onClose: () => void
}) {
  const toast = useToast()
  const [pdfOpen, setPdfOpen] = React.useState(false)
  const [customers, setCustomers] = React.useState<CustomerMini[]>([])
  const [assigned, setAssigned] = React.useState<CustomerMini[]>([])
  const [savingCustomers, setSavingCustomers] = React.useState(false)

  React.useEffect(() => {
    api
      .get('/customers/', { params: { page_size: 500, ordering: 'display_name' } })
      .then((r) => setCustomers(r.data?.results ?? r.data ?? []))
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    if (!item) return
    const ids: number[] = item.data.customers ?? []
    setAssigned(customers.filter((c) => ids.includes(c.id)))
  }, [item, customers])

  const saveCustomers = async (newAssigned: CustomerMini[]) => {
    if (!item) return
    setSavingCustomers(true)
    try {
      const url =
        item.kind === 'folder' ? `/drive-folders/${item.data.id}/` : `/drive-files/${item.data.id}/`
      await api.patch(url, { customers: newAssigned.map((c) => c.id) })
      item.data.customers = newAssigned.map((c) => c.id)
      toast.success('Clienti aggiornati ✅')
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setSavingCustomers(false)
    }
  }

  if (!item) return null
  const isFolder = item.kind === 'folder'
  const folder: DriveFolder | null = item.kind === 'folder' ? item.data : null
  const file: DriveFile | null = item.kind === 'file' ? item.data : null

  const handleDownload = () => {
    if (!file) return
    window.open(`/api/drive-files/${file.id}/download/`, '_blank')
  }

  const kindLabel = isFolder ? 'Cartella' : file?.is_pdf ? 'PDF' : 'File'
  const heroSubtitle = isFolder
    ? `${folder?.children_count ?? 0} cartelle · ${folder?.files_count ?? 0} file`
    : [file?.size_human ?? '—', file?.folder_name || 'Root'].filter(Boolean).join(' · ')

  const rows = isFolder
    ? [
        { label: 'Percorso', value: folder?.full_path || folder?.name || '—' },
        { label: 'Cartelle', value: folder?.children_count ?? 0 },
        { label: 'File', value: folder?.files_count ?? 0 },
        { label: 'Creato da', value: folder?.created_by_name || '—' },
        { label: 'Creato il', value: fmtDate(folder?.created_at) },
        { label: 'Modificato', value: fmtDate(folder?.updated_at) },
      ]
    : [
        { label: 'Dimensione', value: file?.size_human ?? '—' },
        { label: 'Tipo', value: file?.mime_type || file?.extension?.toUpperCase() || '—' },
        { label: 'Cartella', value: file?.folder_name || 'Root' },
        { label: 'Creato da', value: file?.created_by_name || '—' },
        { label: 'Creato il', value: fmtDate(file?.created_at) },
        { label: 'Modificato', value: fmtDate(file?.updated_at) },
      ]

  const sectionCardSx = {
    bgcolor: '#fff',
    border: '1px solid',
    borderColor: 'grey.200',
    borderRadius: 2,
    p: 1.75,
  } as const

  return (
    <>
      <Drawer
        anchor="right"
        open={!!item}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 460 } } }}
      >
        <Stack sx={{ height: '100%', overflow: 'hidden' }}>
          <Box
            sx={{
              background: 'linear-gradient(140deg, #0f766e 0%, #0d9488 55%, #0e7490 100%)',
              px: 2.5,
              pt: 2.25,
              pb: 2.25,
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -44,
                right: -44,
                width: 130,
                height: 130,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.06)',
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: -26,
                left: 52,
                width: 90,
                height: 90,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.04)',
                pointerEvents: 'none',
              }}
            />

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1.25, position: 'relative', zIndex: 2 }}
            >
              <Chip
                size="small"
                label={`● ${kindLabel}`}
                sx={{
                  bgcolor: 'rgba(20,255,180,0.18)',
                  color: '#a7f3d0',
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: '0.07em',
                  border: '1px solid rgba(167,243,208,0.3)',
                  height: 22,
                }}
              />
              <Tooltip title="Chiudi">
                <IconButton
                  aria-label="Chiudi"
                  size="small"
                  onClick={onClose}
                  sx={{
                    color: 'rgba(255,255,255,0.85)',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    borderRadius: 1.5,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography
                sx={{
                  color: '#fff',
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.1,
                  mb: 0.5,
                  pr: 2,
                  wordBreak: 'break-word',
                }}
              >
                {folder?.name ?? file?.name ?? ''}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
                {heroSubtitle}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: 2.5,
              py: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              bgcolor: '#f8fafc',
            }}
          >
            {file && file.is_image ? (
              <Box sx={{ ...sectionCardSx, overflow: 'hidden', p: 0 }}>
                <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: 'text.disabled',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Anteprima
                  </Typography>
                </Box>
                <Box
                  sx={{
                    borderTop: '1px solid',
                    borderColor: 'grey.100',
                    bgcolor: '#fff',
                    minHeight: 220,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1.5,
                  }}
                >
                  <Box
                    component="img"
                    src={`/api/drive-files/${file.id}/preview/`}
                    alt={file.name}
                    sx={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain' }}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </Box>
              </Box>
            ) : null}

            <Box sx={sectionCardSx}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: 'text.disabled',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  display: 'block',
                  mb: 1,
                }}
              >
                Informazioni
              </Typography>
              <Stack spacing={0}>
                {rows.map((r) => (
                  <Stack
                    key={r.label}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ py: 0.75, gap: 1 }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      {r.label}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        maxWidth: 240,
                        textAlign: 'right',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {String(r.value ?? '—')}
                    </Typography>
                  </Stack>
                ))}
                {!isFolder ? (
                  <>
                    {file?.is_pdf ? (
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ py: 0.75, gap: 1 }}
                      >
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          Anteprima
                        </Typography>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<OpenInNewIcon />}
                          onClick={() => setPdfOpen(true)}
                          sx={{ minWidth: 0, px: 0, textTransform: 'none', fontWeight: 700 }}
                        >
                          Apri PDF
                        </Button>
                      </Stack>
                    ) : null}
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ py: 0.75, gap: 1 }}
                    >
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        Download
                      </Typography>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<DownloadOutlinedIcon />}
                        onClick={handleDownload}
                        sx={{ minWidth: 0, px: 0, textTransform: 'none', fontWeight: 700 }}
                      >
                        Scarica file
                      </Button>
                    </Stack>
                  </>
                ) : null}
              </Stack>
            </Box>

            <Box sx={sectionCardSx}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: 'text.disabled',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  display: 'block',
                  mb: 1,
                }}
              >
                Clienti collegati
              </Typography>
              <Can perm={isFolder ? PERMS.drive.folder.change : PERMS.drive.file.change}>
                <Autocomplete
                  multiple
                  size="small"
                  options={customers}
                  value={assigned}
                  onChange={(_e, newVal) => {
                    setAssigned(newVal)
                    saveCustomers(newVal)
                  }}
                  getOptionLabel={(o) => o.display_name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  loading={savingCustomers}
                  renderTags={(val, getProps) =>
                    val.map((opt, i) => (
                      <Chip
                        label={opt.display_name}
                        size="small"
                        {...getProps({ index: i })}
                        key={opt.id}
                        sx={{ fontSize: 10.5, height: 22, '& .MuiChip-label': { px: 1 } }}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={assigned.length ? '' : 'Aggiungi cliente…'}
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': { borderRadius: 2 },
                        '& .MuiInputBase-input': { fontSize: 13 },
                      }}
                    />
                  )}
                  sx={{
                    width: '100%',
                    '& .MuiAutocomplete-inputRoot': { alignItems: 'flex-start' },
                    '& .MuiAutocomplete-tag': { maxWidth: '100%' },
                    '& .MuiAutocomplete-option': { fontSize: 13, minHeight: 34 },
                    '& .MuiChip-label': { fontSize: 11 },
                  }}
                  noOptionsText="Nessun cliente trovato"
                />
              </Can>
              <Can perm={isFolder ? PERMS.drive.folder.view : PERMS.drive.file.view}>
                {assigned.length === 0 && (
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    Nessun cliente collegato.
                  </Typography>
                )}
              </Can>
            </Box>
          </Box>
        </Stack>
      </Drawer>

      {file && file.is_pdf && (
        <Dialog
          open={pdfOpen}
          onClose={() => setPdfOpen(false)}
          maxWidth={false}
          PaperProps={{
            sx: {
              width: '90vw',
              height: '92vh',
              maxWidth: 'none',
              borderRadius: 3,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              px: 2.5,
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {file?.name ?? ''}
            </Typography>
            <ActionIconButton
              label="Apri in una nuova scheda"
              icon={<OpenInNewIcon fontSize="small" />}
              size="small"
              onClick={() => window.open(`/api/drive-files/${file.id}/preview/`, '_blank')}
              sx={{ color: 'primary.main' }}
            />
            <ActionIconButton
              label="Chiudi anteprima"
              icon={<CloseIcon fontSize="small" />}
              size="small"
              onClick={() => setPdfOpen(false)}
            />
          </Stack>
          <Box sx={{ flex: 1, minHeight: 0, bgcolor: '#525659' }}>
            <iframe
              src={`/api/drive-files/${file.id}/preview/`}
              title={file.name}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          </Box>
        </Dialog>
      )}
    </>
  )
}

// ─── Folder Card ──────────────────────────────────────────────────────────────

function FolderCard({
  folder,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onLinkCustomers,
}: {
  folder: DriveFolder
  onOpen: () => void
  onRename: () => void
  onMove: () => void
  onDelete: () => void
  onLinkCustomers: () => void
}) {
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null)

  return (
    <Box
      onClick={onOpen}
      sx={{
        bgcolor: '#fff',
        border: '1px solid',
        borderColor: 'grey.200',
        borderRadius: 2.5,
        p: 1.5,
        cursor: 'pointer',
        transition: 'all 0.13s',
        position: 'relative',
        '&:hover': {
          bgcolor: '#f0fdf9',
          borderColor: 'primary.light',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          '& .folder-menu-btn': { opacity: 1 },
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{ mb: 0.5 }}
      >
        <FolderIcon sx={{ fontSize: 28, color: '#f59e0b' }} />
        <IconButton
          className="folder-menu-btn"
          aria-label="Menu cartella"
          size="small"
          onClick={(e) => {
            e.stopPropagation()
            setMenuAnchor(e.currentTarget)
          }}
          sx={{
            opacity: 0,
            transition: 'opacity 0.15s',
            mt: -0.5,
            mr: -0.75,
            color: 'text.disabled',
            '&:hover': { color: 'text.primary' },
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          color: 'text.primary',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {folder.name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        {folder.files_count} file · {fmtDate(folder.updated_at)}
      </Typography>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onOpen()
          }}
          dense
        >
          <FolderIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Apri
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onRename()
          }}
          dense
        >
          <DriveFileRenameOutlineIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />{' '}
          Rinomina
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onMove()
          }}
          dense
        >
          <DriveFileMoveOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />{' '}
          Sposta in…
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onLinkCustomers()
          }}
          dense
        >
          <PersonAddOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Collega
          clienti
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onDelete()
          }}
          dense
          sx={{ color: 'error.main' }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Elimina
        </MenuItem>
      </Menu>
    </Box>
  )
}

// ─── File Card ────────────────────────────────────────────────────────────────

function FileCard({
  file,
  onSelect,
  selected,
  onRename,
  onMove,
  onDelete,
  onLinkCustomers,
}: {
  file: DriveFile
  onSelect: () => void
  selected: boolean
  onRename: () => void
  onMove: () => void
  onDelete: () => void
  onLinkCustomers: () => void
}) {
  const { bg } = fileIconBg(file.mime_type)
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null)
  const handleDownload = () => window.open(`/api/drive-files/${file.id}/download/`, '_blank')

  return (
    <Box
      sx={{
        bgcolor: selected ? 'rgba(15,118,110,0.07)' : '#fff',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'grey.200',
        borderRadius: 2.5,
        p: 1.5,
        cursor: 'pointer',
        transition: 'all 0.13s',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        position: 'relative',
        '&:hover': {
          bgcolor: selected ? 'rgba(15,118,110,0.09)' : '#f8fafc',
          borderColor: selected ? 'primary.main' : 'grey.300',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          '& .file-menu-btn': { opacity: 1 },
        },
      }}
    >
      <Box
        onClick={onSelect}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1, minWidth: 0 }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            bgcolor: bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FileTypeIcon mime={file.mime_type} size={18} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {file.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {file.size_human} · {fmtDate(file.updated_at)}
          </Typography>
        </Box>
      </Box>
      <IconButton
        className="file-menu-btn"
        aria-label="Menu file"
        size="small"
        onClick={(e) => {
          e.stopPropagation()
          setMenuAnchor(e.currentTarget)
        }}
        sx={{
          opacity: 0,
          transition: 'opacity 0.15s',
          flexShrink: 0,
          color: 'text.disabled',
          '&:hover': { color: 'text.primary' },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            handleDownload()
          }}
          dense
        >
          <DownloadOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Scarica
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onLinkCustomers()
          }}
          dense
        >
          <PersonAddOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Collega
          clienti
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onRename()
          }}
          dense
        >
          <DriveFileRenameOutlineIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />{' '}
          Rinomina
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onMove()
          }}
          dense
        >
          <DriveFileMoveOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />{' '}
          Sposta in…
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onDelete()
          }}
          dense
          sx={{ color: 'error.main' }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Elimina
        </MenuItem>
      </Menu>
    </Box>
  )
}

// ─── Folder List Row ──────────────────────────────────────────────────────────

function FolderListRow({
  folder,
  idx,
  total,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onLinkCustomers,
  isSelected,
  onToggleSelect,
}: {
  folder: DriveFolder
  idx: number
  total: number
  onOpen: () => void
  onRename: () => void
  onMove: () => void
  onDelete: () => void
  onLinkCustomers: () => void
  isSelected: boolean
  onToggleSelect: (e: React.MouseEvent) => void
}) {
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null)

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      onClick={onOpen}
      sx={{
        px: 2,
        py: 1,
        borderBottom: idx < total - 1 ? '1px solid' : 'none',
        borderColor: 'grey.100',
        bgcolor: idx % 2 === 1 ? 'rgba(15,118,110,0.015)' : '#fff',
        cursor: 'pointer',
        transition: 'background 0.1s',
        '&:hover': { bgcolor: 'rgba(15,118,110,0.04)', '& .folder-row-menu': { opacity: 1 } },
      }}
    >
      <Box onClick={onToggleSelect} sx={{ display: 'flex', alignItems: 'center', mr: -0.5 }}>
        {isSelected ? (
          <CheckBoxIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        ) : (
          <CheckBoxOutlineBlankIcon sx={{ fontSize: 18, color: 'grey.300' }} />
        )}
      </Box>
      <FolderIcon sx={{ fontSize: 20, color: '#f59e0b' }} />
      <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
        {folder.name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        {folder.files_count} file · {folder.children_count} cartelle
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled', width: 70, textAlign: 'right' }}>
        {fmtDate(folder.updated_at)}
      </Typography>
      <IconButton
        className="folder-row-menu"
        aria-label="Azioni cartella"
        size="small"
        onClick={(e) => {
          e.stopPropagation()
          setMenuAnchor(e.currentTarget)
        }}
        sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'text.disabled' }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onOpen()
          }}
          dense
        >
          <FolderIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Apri
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onRename()
          }}
          dense
        >
          <DriveFileRenameOutlineIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />{' '}
          Rinomina
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onMove()
          }}
          dense
        >
          <DriveFileMoveOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />{' '}
          Sposta in…
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onLinkCustomers()
          }}
          dense
        >
          <PersonAddOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Collega
          clienti
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onDelete()
          }}
          dense
          sx={{ color: 'error.main' }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Elimina
        </MenuItem>
      </Menu>
    </Stack>
  )
}

// ─── File List Row ────────────────────────────────────────────────────────────

function FileListRow({
  file,
  idx,
  globalIdx,
  totalItems,
  selected,
  onSelect,
  onRename,
  onMove,
  onDelete,
  onLinkCustomers,
  isChecked,
  onToggleCheck,
}: {
  file: DriveFile
  idx: number
  globalIdx: number
  totalItems: number
  selected: boolean
  onSelect: () => void
  onRename: () => void
  onMove: () => void
  onDelete: () => void
  onLinkCustomers: () => void
  isChecked: boolean
  onToggleCheck: (e: React.MouseEvent) => void
}) {
  const { bg } = fileIconBg(file.mime_type)
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null)
  const handleDownload = () => window.open(`/api/drive-files/${file.id}/download/`, '_blank')

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      onClick={onSelect}
      sx={{
        px: 2,
        py: 1,
        borderBottom: globalIdx < totalItems - 1 ? '1px solid' : 'none',
        borderColor: 'grey.100',
        bgcolor: selected
          ? 'rgba(15,118,110,0.06)'
          : idx % 2 === 1
            ? 'rgba(15,118,110,0.015)'
            : '#fff',
        cursor: 'pointer',
        transition: 'background 0.1s',
        '&:hover': { bgcolor: 'rgba(15,118,110,0.04)', '& .file-row-menu': { opacity: 1 } },
      }}
    >
      <Box onClick={onToggleCheck} sx={{ display: 'flex', alignItems: 'center', mr: -0.5 }}>
        {isChecked ? (
          <CheckBoxIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        ) : (
          <CheckBoxOutlineBlankIcon sx={{ fontSize: 18, color: 'grey.300' }} />
        )}
      </Box>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 1,
          bgcolor: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <FileTypeIcon mime={file.mime_type} size={15} />
      </Box>
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {file.name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled', width: 65, textAlign: 'right' }}>
        {file.size_human}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled', width: 80, textAlign: 'right' }}>
        {fmtDate(file.updated_at)}
      </Typography>
      <IconButton
        className="file-row-menu"
        aria-label="Azioni file"
        size="small"
        onClick={(e) => {
          e.stopPropagation()
          setMenuAnchor(e.currentTarget)
        }}
        sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'text.disabled' }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            handleDownload()
          }}
          dense
        >
          <DownloadOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Scarica
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onLinkCustomers()
          }}
          dense
        >
          <PersonAddOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> Collega
          clienti
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onRename()
          }}
          dense
        >
          <DriveFileRenameOutlineIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />{' '}
          Rinomina
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onMove()
          }}
          dense
        >
          <DriveFileMoveOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />{' '}
          Sposta in…
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onDelete()
          }}
          dense
          sx={{ color: 'error.main' }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Elimina
        </MenuItem>
      </Menu>
    </Stack>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// prettier-ignore
export default function Drive() {
  const toast = useToast()

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
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }
        return next
      })
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

  const loadFolder = React.useCallback(
    async (id: number | null, custFilter?: CustomerMini | null) => {
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
          setFolders(fRes.data?.results ?? fRes.data ?? [])
          setFiles(fileRes.data?.results ?? fileRes.data ?? [])
          setBreadcrumb([])
        } else {
          const res = await api.get(`/drive-folders/${id}/children/`, { params: custParam })
          setFolders(res.data.folders ?? [])
          setFiles(res.data.files ?? [])
          // Breadcrumb
          const bcRes = await api.get(`/drive-folders/${id}/breadcrumb/`)
          setBreadcrumb(bcRes.data ?? [])
        }
      } catch (e) {
        toast.error(apiErrorToMessage(e))
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  React.useEffect(() => {
    void loadFolder(folderId, customerFilter)
  }, [folderId, customerFilter, loadFolder])

  // ── Navigation ────────────────────────────────────────────────────────────

  const navigateTo = (id: number | null) => {
    setFolderId(id)
    setSelectedId(null)
    setDrawerItem(null)
    void loadFolder(id, customerFilter)
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
    else toast.success(`${total} file caricati ✅`)
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
      toast.success('Cartella creata ✅')
      setCreateFolderOpen(false)
      setCreateFolderName('')
      void loadFolder(folderId)
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
      toast.success('Rinominato ✅')
      setRenameItem(null)
      setDrawerItem(null)
      setSelectedId(null)
      void loadFolder(folderId)
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
      toast.success('Eliminato ✅')
      setDeleteItem(null)
      setDrawerItem(null)
      setSelectedId(null)
      void loadFolder(folderId)
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
      toast.success('Spostato ✅')
      setMoveItem(null)
      setDrawerItem(null)
      setSelectedId(null)
      void loadFolder(folderId)
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
      toast.success(`${selected.size} elementi eliminati ✅`)
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
        {/* OneDrive logo SVG inline */}
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
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' }, width: 210 }}
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
            bgcolor: '#fff',
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
                  color: viewMode === m ? '#fff' : 'grey.500',
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
            bgcolor: '#f0fdf9',
            border: '1px solid',
            borderColor: 'primary.light',
            borderRadius: 2.5,
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
                  bgcolor: 'rgba(15,118,110,0.15)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${uploadProgress.overallProgress}%`,
                    bgcolor: 'primary.main',
                    borderRadius: 3,
                    transition: 'width 0.2s ease',
                  }}
                />
              </Box>
              {/* Per-file progress */}
              {uploadProgress.total === 1 ? null : (
                <Box
                  sx={{
                    height: 3,
                    bgcolor: 'rgba(15,118,110,0.1)',
                    borderRadius: 3,
                    overflow: 'hidden',
                    mt: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: `${uploadProgress.fileProgress}%`,
                      bgcolor: 'rgba(15,118,110,0.5)',
                      borderRadius: 3,
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
            bgcolor: '#f0fdf9',
            border: '1px solid',
            borderColor: 'primary.light',
            borderRadius: 2.5,
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
                  borderRadius: 2.5,
                  p: 1.5,
                  cursor: 'pointer',
                  bgcolor: '#fff',
                  transition: 'all 0.13s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  '&:hover': { bgcolor: '#f8fafc', borderColor: 'grey.300' },
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
              borderRadius: 2.5,
              overflow: 'hidden',
              bgcolor: '#fff',
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
                  '&:hover': { bgcolor: 'rgba(15,118,110,0.04)' },
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    bgcolor: '#f1f5f9',
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
                borderRadius: 2.5,
                overflow: 'hidden',
                bgcolor: '#fff',
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
                  '&:hover': { bgcolor: 'rgba(15,118,110,0.04)' },
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    bgcolor: '#f1f5f9',
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
      <Dialog
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Nuova cartella</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            size="small"
            label="Nome cartella"
            value={createFolderName}
            onChange={(e) => setCreateFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doCreateFolder()
            }}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateFolderOpen(false)} disabled={createFolderBusy}>
            Annulla
          </Button>
          <Button
            variant="contained"
            onClick={doCreateFolder}
            disabled={createFolderBusy || !createFolderName.trim()}
          >
            {createFolderBusy ? 'Creazione…' : 'Crea'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Rename dialog ── */}
      <Dialog open={!!renameItem} onClose={() => setRenameItem(null)} fullWidth maxWidth="xs">
        <DialogTitle>Rinomina</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            size="small"
            label="Nuovo nome"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doRename()
            }}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameItem(null)} disabled={renameBusy}>
            Annulla
          </Button>
          <Button
            variant="contained"
            onClick={doRename}
            disabled={renameBusy || !renameName.trim()}
          >
            {renameBusy ? 'Salvataggio…' : 'Salva'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Move dialog ── */}
      <Dialog open={!!moveItem} onClose={() => setMoveItem(null)} fullWidth maxWidth="xs">
        <DialogTitle>Sposta in…</DialogTitle>
        <DialogContent>
          <Stack spacing={0.5} sx={{ mt: 1, maxHeight: 300, overflowY: 'auto' }}>
            <Box
              onClick={() => setMoveTarget(null)}
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                cursor: 'pointer',
                bgcolor: moveTarget === null ? 'rgba(15,118,110,0.08)' : 'transparent',
                border: '1px solid',
                borderColor: moveTarget === null ? 'primary.main' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <FolderIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Root
              </Typography>
            </Box>
            {moveFolders.map((f) => (
              <Box
                key={f.id}
                onClick={() => setMoveTarget(f.id)}
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  bgcolor: moveTarget === f.id ? 'rgba(15,118,110,0.08)' : 'transparent',
                  border: '1px solid',
                  borderColor: moveTarget === f.id ? 'primary.main' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  '&:hover': { bgcolor: 'rgba(15,118,110,0.04)' },
                }}
              >
                <FolderIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
                <Typography variant="body2">{f.full_path}</Typography>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMoveItem(null)} disabled={moveBusy}>
            Annulla
          </Button>
          <Button variant="contained" onClick={doMove} disabled={moveBusy}>
            {moveBusy ? 'Spostamento…' : 'Sposta'}
          </Button>
        </DialogActions>
      </Dialog>

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
