/**
 * WikiAttachmentsTab — tab "Allegati" della pagina Wiki.
 * Estratto da WikiPage.tsx per ridurne la dimensione (era >1900 righe in un solo file).
 */
import type { ChangeEvent, RefObject } from 'react'
import { Box, Button, Card, CircularProgress, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import UploadFileIcon from '@mui/icons-material/UploadFile'

import { Can } from '../../auth/Can'
import { PERMS } from '../../auth/perms'

export type WikiAttachment = {
  id: number
  filename: string
  mime_type?: string | null
  size_bytes?: number | null
  notes?: string | null
  file_url?: string | null
  preview_url?: string | null
  download_url?: string | null
  created_at?: string | null
}

function fmtSize(bytes?: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function isImageMime(mime?: string | null): boolean {
  return !!mime && mime.startsWith('image/')
}

export default function WikiAttachmentsTab({
  attachments,
  attachUploading,
  attachInputRef,
  onUpload,
  onDelete,
}: {
  attachments: WikiAttachment[]
  attachUploading: boolean
  attachInputRef: RefObject<HTMLInputElement | null>
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void
  onDelete: (id: number) => void
}) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle2" color="text.secondary">
          {attachments.length === 0
            ? 'Nessun allegato'
            : `${attachments.length} allegat${attachments.length === 1 ? 'o' : 'i'}`}
        </Typography>
        <Can perm={PERMS.wiki.page.change}>
          <>
            <input ref={attachInputRef} type="file" style={{ display: 'none' }} onChange={onUpload} />
            <Button
              size="small"
              variant="outlined"
              startIcon={attachUploading ? <CircularProgress size={14} /> : <UploadFileIcon />}
              onClick={() => attachInputRef.current?.click()}
              disabled={attachUploading}
            >
              Carica file
            </Button>
          </>
        </Can>
      </Stack>

      {/* Image gallery */}
      {attachments.some((a) => isImageMime(a.mime_type)) && (
        <Box>
          <Typography
            variant="caption"
            color="text.disabled"
            fontWeight={600}
            sx={{
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontSize: 10,
              mb: 1,
              display: 'block',
            }}
          >
            Immagini
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1.5}>
            {attachments
              .filter((a) => isImageMime(a.mime_type))
              .map((a) => (
                <Box
                  key={a.id}
                  sx={{
                    width: 120,
                    height: 90,
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'grey.200',
                    position: 'relative',
                    '&:hover .img-actions': { opacity: 1 },
                  }}
                >
                  <img
                    src={a.preview_url ?? a.file_url ?? ''}
                    alt={a.filename}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <Stack
                    className="img-actions"
                    direction="row"
                    justifyContent="center"
                    alignItems="center"
                    gap={0.5}
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(0,0,0,0.45)',
                      opacity: 0,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <Can perm={PERMS.wiki.page.change}>
                      <Tooltip title="Elimina">
                        <IconButton
                          aria-label="Elimina"
                          size="small"
                          sx={{ color: '#fff' }}
                          onClick={() => onDelete(a.id)}
                        >
                          <DeleteForeverIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Can>
                  </Stack>
                </Box>
              ))}
          </Stack>
        </Box>
      )}

      {/* File list */}
      {attachments.filter((a) => !isImageMime(a.mime_type)).length > 0 && (
        <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Stack divider={<Divider />}>
            {attachments
              .filter((a) => !isImageMime(a.mime_type))
              .map((a) => (
                <Stack key={a.id} direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.5 }}>
                  <AttachFileIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                  <Box flex={1} minWidth={0}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {(() => {
                        const attachmentHref = a.preview_url ?? a.download_url ?? a.file_url ?? undefined
                        return attachmentHref ? (
                          <a
                            href={attachmentHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            {a.filename}
                          </a>
                        ) : (
                          a.filename
                        )
                      })()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {a.mime_type ?? '—'}
                      {a.size_bytes ? ` · ${fmtSize(a.size_bytes)}` : ''}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.disabled">
                    {fmtDate(a.created_at)}
                  </Typography>
                  <Can perm={PERMS.wiki.page.change}>
                    <Tooltip title="Elimina allegato">
                      <IconButton
                        aria-label="Elimina allegato"
                        size="small"
                        color="error"
                        onClick={() => onDelete(a.id)}
                      >
                        <DeleteForeverIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Can>
                </Stack>
              ))}
          </Stack>
        </Card>
      )}

      {attachments.length === 0 && (
        <Card variant="outlined" sx={{ borderRadius: 1, p: 4, textAlign: 'center' }}>
          <AttachFileIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.disabled" fontSize={13}>
            Nessun allegato. Carica file tramite il pulsante sopra, oppure inserisci immagini direttamente
            dall'editor.
          </Typography>
        </Card>
      )}
    </Stack>
  )
}
