import * as React from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

import { Can } from '../../auth/Can'
import { PERMS } from '../../auth/perms'
import { api } from '@shared/api/client'
import { apiErrorToMessage } from '@shared/api/error'
import { useToast } from '@shared/ui/toast'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { ActionIconButton } from '@shared/ui/ActionIconButton'

import type { DrawerItem, DriveFolder, DriveFile, CustomerMini } from './types'
import { fmtDate } from './style'

// ─── Preview Drawer ───────────────────────────────────────────────────────────

export function PreviewDrawer({
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
    borderRadius: 1,
    p: 1.75,
  } as const

  return (
    <>
      <DrawerShell
        open={!!item}
        onClose={onClose}
        gradient="teal"
        statusLabel={`● ${kindLabel}`}
        title={folder?.name ?? file?.name ?? ''}
        subtitle={heroSubtitle}
      >
        <>
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
                        '& .MuiOutlinedInput-root': { borderRadius: 1 },
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
        </>
      </DrawerShell>

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
              borderRadius: 1,
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
