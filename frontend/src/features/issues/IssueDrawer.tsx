import {
  Avatar,
  Box,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SendIcon from '@mui/icons-material/Send'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

import { inventoryDrawerPath } from '../../utils/entityPaths'
import { ActionIconButton } from '../../ui/ActionIconButton'
import {
  STATUS_META,
  fmtIssueDate,
  fmtIssueDateTime,
  issueAuthorInitials,
  issueAuthorName,
  issueInventoryLabel,
  type IssueComment,
  type IssueRow,
} from './types'

type IssueDrawerProps = {
  open: boolean
  issue: IssueRow | null
  detailTab: number
  comments: IssueComment[]
  commentsLoading: boolean
  newComment: string
  sendingComment: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onDetailTabChange: (value: number) => void
  onNewCommentChange: (value: string) => void
  onSendComment: () => void
}

function UnlinkedInventoryWarningIcon() {
  return (
    <Tooltip title="Questa issue non è ancora collegata a un inventory.">
      <WarningAmberRoundedIcon sx={{ color: 'warning.main', fontSize: 18, flexShrink: 0 }} />
    </Tooltip>
  )
}

export default function IssueDrawer({
  open,
  issue,
  detailTab,
  comments,
  commentsLoading,
  newComment,
  sendingComment,
  onClose,
  onEdit,
  onDelete,
  onDetailTabChange,
  onNewCommentChange,
  onSendComment,
}: IssueDrawerProps) {
  const lastComment = comments.length > 0 ? comments[comments.length - 1] : null

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 384 } } }}
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
            <Stack direction="row" alignItems="center" spacing={0.75}>
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
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {issue ? (
                <Box
                  sx={{
                    bgcolor: 'rgba(20,255,180,0.18)',
                    color: '#a7f3d0',
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: '0.07em',
                    border: '1px solid rgba(167,243,208,0.3)',
                    borderRadius: '4px',
                    px: 1,
                    py: 0.25,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  ● {STATUS_META[issue.status]?.label ?? issue.status}
                </Box>
              ) : null}
              {issue ? (
                <Box
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.85)',
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: '0.07em',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    px: 1,
                    py: 0.25,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {issue.priority_label || issue.priority}
                </Box>
              ) : null}
            </Stack>
            <Stack direction="row" spacing={0.75}>
              <ActionIconButton
                label="Modifica"
                size="small"
                onClick={onEdit}
                disabled={!issue}
                sx={{
                  color: 'rgba(255,255,255,0.85)',
                  bgcolor: 'rgba(255,255,255,0.12)',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                }}
              >
                <EditIcon fontSize="small" />
              </ActionIconButton>
              <ActionIconButton
                label="Elimina"
                size="small"
                onClick={onDelete}
                disabled={!issue}
                sx={{
                  color: 'rgba(255,255,255,0.85)',
                  bgcolor: 'rgba(255,255,255,0.12)',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: 'rgba(239,68,68,0.28)', color: '#fca5a5' },
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </ActionIconButton>
              <ActionIconButton
                label="Chiudi"
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
              </ActionIconButton>
            </Stack>
          </Stack>

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, mb: 0.5 }}>
              <Typography
                sx={{
                  color: '#fff',
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.15,
                  minWidth: 0,
                }}
              >
                {issue?.title}
              </Typography>
              {issue && !issue.inventory ? <UnlinkedInventoryWarningIcon /> : null}
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.62)' }}>
              {issue?.customer_name}
              {issue?.site_name ? ` · ${issue.site_name}` : ''}
              {issue?.servicenow_id ? ` · ${issue.servicenow_id}` : ''}
            </Typography>
          </Box>
        </Box>

        {commentsLoading ? <LinearProgress sx={{ height: 2 }} /> : null}
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2.5, flexShrink: 0 }}>
          <Tabs value={detailTab} onChange={(_, value) => onDetailTabChange(value)}>
            <Tab label="Dettagli" sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
            <Tab label={`Commenti (${comments.length})`} sx={{ fontSize: 13, minWidth: 0, px: 1.5 }} />
          </Tabs>
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
            minHeight: 0,
          }}
        >
          {detailTab === 0 && issue ? (
            <>
              <Box
                sx={{
                  bgcolor: '#f8fafc',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 1,
                  p: 1.75,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: 'text.disabled',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mb: 1,
                  }}
                >
                  <NotesOutlinedIcon sx={{ fontSize: 14 }} /> Descrizione
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {issue.description || '—'}
                </Typography>
              </Box>

              <Box
                sx={{
                  bgcolor: '#f8fafc',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 1,
                  p: 1.75,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: 'text.disabled',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mb: 1,
                  }}
                >
                  <InfoOutlinedIcon sx={{ fontSize: 14 }} /> Informazioni
                </Typography>
                <Stack divider={<Divider sx={{ borderColor: 'grey.100' }} />}>
                  {[
                    { label: 'Categoria', value: issue.category_label },
                    { label: 'Assegnato a', value: issue.assigned_to_full_name },
                    { label: 'Caso ServiceNow', value: issue.servicenow_id },
                    { label: 'Data apertura', value: fmtIssueDate(issue.opened_at) || fmtIssueDate(issue.created_at.split('T')[0]) },
                    { label: 'Scadenza', value: fmtIssueDate(issue.due_date) },
                    { label: 'Chiusa il', value: fmtIssueDate(issue.closed_at) },
                    { label: 'Creata da', value: issue.created_by_full_name || issue.created_by_username },
                    { label: 'Creata il', value: fmtIssueDateTime(issue.created_at) },
                    { label: 'Aggiornata il', value: fmtIssueDateTime(issue.updated_at) },
                    { label: 'Giorni passati', value: `${issue.days_open} ${issue.days_open === 1 ? 'giorno' : 'giorni'}` },
                  ]
                    .filter((entry): entry is { label: string; value: string } => Boolean(entry.value))
                    .map(({ label, value }) => (
                      <Stack key={label} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
                        <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
                          {label}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            maxWidth: 220,
                            textAlign: 'right',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {value}
                        </Typography>
                      </Stack>
                    ))}

                  {issue.inventory ? (
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
                      <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
                        Inventory
                      </Typography>
                      <Typography
                        component={RouterLink}
                        to={inventoryDrawerPath(issue.inventory, { customer: issue.customer })}
                        variant="body2"
                        onClick={onClose}
                        sx={{
                          fontWeight: 600,
                          maxWidth: 220,
                          textAlign: 'right',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'primary.main',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {issueInventoryLabel(issue)}
                      </Typography>
                    </Stack>
                  ) : null}
                </Stack>
              </Box>

              {lastComment ? (
                <Box
                  sx={{
                    bgcolor: '#f8fafc',
                    border: '1px solid',
                    borderColor: 'grey.200',
                    borderRadius: 1,
                    p: 1.75,
                    cursor: 'pointer',
                    '&:hover': { borderColor: 'primary.light' },
                  }}
                  onClick={() => onDetailTabChange(1)}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: 'text.disabled',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      mb: 1,
                    }}
                  >
                    <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} /> Ultimo commento
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        bgcolor: 'primary.main',
                        flexShrink: 0,
                      }}
                    >
                      {issueAuthorInitials(lastComment)}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {issueAuthorName(lastComment)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          {fmtIssueDateTime(lastComment.created_at)}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          lineHeight: 1.6,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {lastComment.body}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              ) : null}
            </>
          ) : null}

          {detailTab === 1 ? (
            <Stack spacing={0} sx={{ flex: 1 }}>
              {commentsLoading ? (
                <Stack alignItems="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </Stack>
              ) : comments.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <ChatBubbleOutlineIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Nessun commento ancora. Sii il primo!
                  </Typography>
                </Box>
              ) : (
                comments.map((comment, index) => (
                  <Box key={comment.id}>
                    <Box sx={{ display: 'flex', gap: 1.5, py: 2 }}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          bgcolor: 'primary.main',
                          flexShrink: 0,
                        }}
                      >
                        {issueAuthorInitials(comment)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {issueAuthorName(comment)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {fmtIssueDateTime(comment.created_at)}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                          {comment.body}
                        </Typography>
                      </Box>
                    </Box>
                    {index < comments.length - 1 ? <Divider /> : null}
                  </Box>
                ))
              )}
            </Stack>
          ) : null}
        </Box>

        {detailTab === 1 ? (
          <Box
            sx={{
              px: 2.5,
              py: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                size="small"
                fullWidth
                multiline
                maxRows={4}
                placeholder="Scrivi un commento… (Ctrl+Enter per inviare)"
                value={newComment}
                onChange={(e) => onNewCommentChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSendComment()
                }}
                disabled={sendingComment}
              />
              <ActionIconButton
                label="Invia (Ctrl+Enter)"
                color="primary"
                onClick={onSendComment}
                disabled={!newComment.trim() || sendingComment}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': {
                    bgcolor: 'action.disabledBackground',
                    color: 'action.disabled',
                  },
                }}
              >
                {sendingComment ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : <SendIcon />}
              </ActionIconButton>
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Drawer>
  )
}
