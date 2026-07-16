/**
 * WikiRevisionsTab — tab "Cronologia" della pagina Wiki (lista revisioni + dialog di preview).
 * Estratto da WikiPage.tsx per ridurne la dimensione (era >1900 righe in un solo file).
 */
import {
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import HistoryIcon from '@mui/icons-material/History'
import RestoreIcon from '@mui/icons-material/Restore'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'

import { Can } from '../../auth/Can'
import { PERMS } from '../../auth/perms'

export type WikiRevision = {
  id: number
  revision_number: number
  title: string
  summary?: string | null
  content_markdown: string
  saved_by_username?: string | null
  saved_at: string
}

// Stile per il rendering del contenuto renderizzato (usato anche dal tab "Contenuto" in WikiPage.tsx)
export const PROSE_SX = {
  '& h1': { fontSize: 24, fontWeight: 800, mt: 2, mb: 1, letterSpacing: '-0.02em' },
  '& h2': { fontSize: 20, fontWeight: 700, mt: 1.75, mb: 0.75 },
  '& h3': { fontSize: 16, fontWeight: 700, mt: 1.5, mb: 0.5 },
  '& p': { my: 1, lineHeight: 1.75, fontSize: 14, color: 'text.secondary' },
  '& ul, & ol': { pl: 3, my: 1 },
  '& li': { my: 0.5, fontSize: 14, color: 'text.secondary' },
  '& code': {
    fontFamily: 'monospace',
    fontSize: 12.5,
    bgcolor: 'grey.100',
    borderRadius: 1,
    px: 0.75,
    py: 0.25,
  },
  '& pre': {
    fontFamily: 'monospace',
    fontSize: 12.5,
    bgcolor: '#1a2421',
    color: '#a7f3d0',
    p: 2,
    borderRadius: 1,
    overflow: 'auto',
    my: 1.5,
  },
  '& pre code': { bgcolor: 'transparent', color: 'inherit', p: 0 },
  '& blockquote': {
    borderLeft: '3px solid',
    borderColor: 'primary.main',
    pl: 2,
    ml: 0,
    my: 1,
    '& p': { color: 'text.secondary', fontStyle: 'italic' },
  },
  '& table': { width: '100%', borderCollapse: 'collapse', my: 1.5 },
  '& th, & td': { border: '1px solid', borderColor: 'divider', p: 1, fontSize: 13 },
  '& th': { bgcolor: 'grey.50', fontWeight: 700 },
  '& hr': { border: 'none', borderTop: '1px solid', borderColor: 'divider', my: 2 },
  '& a': { color: 'primary.main' },
  '& img': { maxWidth: '100%', borderRadius: 1, my: 1 },
  '& mark': { bgcolor: '#fef9c3', borderRadius: '2px', px: 0.5 },
}

export default function WikiRevisionsTab({
  revisions,
  restoring,
  onPreview,
  onRestore,
  previewRev,
  previewRevHtml,
  previewRevLoading,
  onClosePreview,
}: {
  revisions: WikiRevision[]
  restoring: number | null
  onPreview: (rev: WikiRevision) => void
  onRestore: (rev: WikiRevision) => void
  previewRev: WikiRevision | null
  previewRevHtml: string
  previewRevLoading: boolean
  onClosePreview: () => void
}) {
  return (
    <>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              {revisions.length === 0
                ? 'Nessuna revisione salvata'
                : `${revisions.length} revision${revisions.length === 1 ? 'e' : 'i'} — ogni salvataggio crea uno snapshot automatico`}
            </Typography>
          </Box>
        </Stack>

        {revisions.length === 0 ? (
          <Card variant="outlined" sx={{ borderRadius: 1, p: 4, textAlign: 'center' }}>
            <HistoryIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.disabled" fontSize={13}>
              Le revisioni vengono create automaticamente ad ogni salvataggio della pagina.
            </Typography>
          </Card>
        ) : (
          <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Stack divider={<Divider />}>
              {revisions.map((rev) => (
                <Stack
                  key={rev.id}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{ px: 2, py: 1.5, '&:hover': { bgcolor: 'grey.50' } }}
                >
                  {/* Badge revisione */}
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: 'grey.100',
                      border: '1.5px solid',
                      borderColor: 'grey.200',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Typography variant="caption" fontWeight={800} color="text.secondary" fontSize={11}>
                      #{rev.revision_number}
                    </Typography>
                  </Box>

                  {/* Info */}
                  <Box flex={1} minWidth={0}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {rev.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(rev.saved_at).toLocaleString('it-IT', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {rev.saved_by_username && ` · ${rev.saved_by_username}`}
                    </Typography>
                  </Box>

                  {/* Azioni */}
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Anteprima contenuto">
                      <IconButton
                        aria-label="Anteprima contenuto"
                        size="small"
                        onClick={() => onPreview(rev)}
                      >
                        <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Can perm={PERMS.wiki.page.change}>
                      <Tooltip title={`Ripristina a questa revisione (#${rev.revision_number})`}>
                        <span>
                          <IconButton
                            aria-label={`Ripristina a questa revisione (#${rev.revision_number})`}
                            size="small"
                            color="primary"
                            disabled={restoring === rev.id}
                            onClick={() => onRestore(rev)}
                          >
                            {restoring === rev.id ? (
                              <CircularProgress size={14} />
                            ) : (
                              <RestoreIcon sx={{ fontSize: 16 }} />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Can>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Card>
        )}
      </Stack>

      {/* ── Preview revisione ── */}
      <Dialog open={!!previewRev} onClose={onClosePreview} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Revisione #{previewRev?.revision_number} — {previewRev?.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {previewRev &&
                  new Date(previewRev.saved_at).toLocaleString('it-IT', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                {previewRev?.saved_by_username && ` · salvata da ${previewRev.saved_by_username}`}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onClosePreview} aria-label="Chiudi anteprima">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {previewRev &&
            (previewRevLoading ? (
              <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
                <CircularProgress size={28} />
              </Stack>
            ) : (
              <Box dangerouslySetInnerHTML={{ __html: previewRevHtml }} sx={PROSE_SX} />
            ))}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={onClosePreview}>Chiudi</Button>
          <Can perm={PERMS.wiki.page.change}>
            <Button
              variant="contained"
              startIcon={restoring ? <CircularProgress size={14} color="inherit" /> : <RestoreIcon />}
              disabled={!!restoring}
              onClick={() => previewRev && onRestore(previewRev)}
            >
              Ripristina questa revisione
            </Button>
          </Can>
        </DialogActions>
      </Dialog>
    </>
  )
}
