import {
  Avatar, Box, CircularProgress, Divider, IconButton,
  Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SendIcon from '@mui/icons-material/Send'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import { inventoryDrawerPath } from '../../utils/entityPaths'
import { ActionIconButton } from '@shared/ui/ActionIconButton'
import { DrawerShell, HERO_ICON_BTN_SX, HERO_ICON_BTN_DELETE_SX } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList } from '@shared/ui/DrawerParts'
import {
  STATUS_META, fmtIssueDate, fmtIssueDateTime,
  issueAuthorInitials, issueAuthorName, issueInventoryLabel,
  type IssueComment, type IssueRow,
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

export default function IssueDrawer({
  open, issue, detailTab, comments, commentsLoading,
  newComment, sendingComment, onClose, onEdit, onDelete,
  onDetailTabChange, onNewCommentChange, onSendComment,
}: IssueDrawerProps) {

  // Status slot personalizzato: ArrowBack + badge status + badge priorità
  const statusSlot = (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Tooltip title="Chiudi">
        <IconButton aria-label="Chiudi" size="small" onClick={onClose} sx={HERO_ICON_BTN_SX}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {issue ? (
        <>
          <Box sx={{ bgcolor: 'rgba(20,255,180,0.18)', color: '#a7f3d0', fontWeight: 700, fontSize: 10, letterSpacing: '0.07em', border: '1px solid rgba(167,243,208,0.3)', borderRadius: '4px', px: 1, py: 0.25, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            ● {STATUS_META[issue.status]?.label ?? issue.status}
          </Box>
          <Box sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 10, letterSpacing: '0.07em', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', px: 1, py: 0.25, display: 'inline-flex', alignItems: 'center' }}>
            {issue.priority_label || issue.priority}
          </Box>
        </>
      ) : null}
    </Stack>
  )

  const actions = (
    <>
      <ActionIconButton label="Modifica" icon={<EditIcon fontSize="small" />}
        size="small" onClick={onEdit} disabled={!issue} sx={HERO_ICON_BTN_SX} />
      <ActionIconButton label="Elimina" icon={<DeleteOutlineIcon fontSize="small" />}
        size="small" onClick={onDelete} disabled={!issue} sx={HERO_ICON_BTN_DELETE_SX} />
    </>
  )

  const subtitle = issue
    ? [issue.customer_name, issue.site_name, issue.servicenow_id].filter(Boolean).join(' · ')
    : undefined

  const commentFooter = detailTab === 1 ? (
    <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0, bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <TextField
          size="small" fullWidth multiline maxRows={4}
          placeholder="Scrivi un commento… (Ctrl+Enter per inviare)"
          value={newComment}
          onChange={(e) => onNewCommentChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSendComment() }}
          disabled={sendingComment}
        />
        <ActionIconButton
          label="Invia (Ctrl+Enter)" color="primary"
          onClick={onSendComment} disabled={!newComment.trim() || sendingComment}
          sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 1.5, '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' } }}
        >
          {sendingComment ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : <SendIcon />}
        </ActionIconButton>
      </Stack>
    </Box>
  ) : null

  return (
    <DrawerShell
      open={open} onClose={onClose} width={420} gradient="teal"
      statusSlot={statusSlot} actions={actions}
      title={issue?.title ?? ''}
      subtitle={subtitle}
      loading={commentsLoading}
      tabs={['Dettagli', `Commenti (${comments.length})`]}
      tabValue={detailTab} onTabChange={onDetailTabChange}
      bodySx={{ minHeight: 0 }}
      bodyFooter={commentFooter}
    >
      {detailTab === 0 && issue ? (
        <>
          <DrawerSection icon={<NotesOutlinedIcon sx={{ fontSize: 14 }} />} title="Descrizione">
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {issue.description || '—'}
            </Typography>
          </DrawerSection>

          <DrawerSection icon={<InfoOutlinedIcon sx={{ fontSize: 14 }} />} title="Informazioni">
            <Stack divider={<Divider sx={{ borderColor: 'grey.100' }} />}>
              <DrawerFieldList rows={[
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
              ]} />
              {issue.inventory ? (
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>Inventory</Typography>
                  <Typography component={RouterLink} to={inventoryDrawerPath(issue.inventory, { customer: issue.customer })}
                    variant="body2" onClick={onClose}
                    sx={{ fontWeight: 600, maxWidth: 220, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                    {issueInventoryLabel(issue)}
                  </Typography>
                </Stack>
              ) : null}
            </Stack>
          </DrawerSection>

          {comments.length > 0 ? (
            <DrawerSection icon={<ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />} title="Ultimo commento"
              sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.light' } }}>
              <Box onClick={() => onDetailTabChange(1)}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Avatar sx={{ width: 28, height: 28, fontSize: '0.68rem', fontWeight: 700, bgcolor: 'primary.main', flexShrink: 0 }}>
                    {issueAuthorInitials(comments[comments.length - 1])}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{issueAuthorName(comments[comments.length - 1])}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>{fmtIssueDateTime(comments[comments.length - 1].created_at)}</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {comments[comments.length - 1].body}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </DrawerSection>
          ) : null}
        </>
      ) : null}

      {detailTab === 1 ? (
        <Stack spacing={0} sx={{ flex: 1 }}>
          {commentsLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={24} /></Stack>
          ) : comments.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Nessun commento ancora. Sii il primo!</Typography>
            </Box>
          ) : (
            comments.map((comment, index) => (
              <Box key={comment.id}>
                <Box sx={{ display: 'flex', gap: 1.5, py: 2 }}>
                  <Avatar sx={{ width: 32, height: 32, fontSize: '0.72rem', fontWeight: 700, bgcolor: 'primary.main', flexShrink: 0 }}>
                    {issueAuthorInitials(comment)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{issueAuthorName(comment)}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtIssueDateTime(comment.created_at)}</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{comment.body}</Typography>
                  </Box>
                </Box>
                {index < comments.length - 1 ? <Divider /> : null}
              </Box>
            ))
          )}
        </Stack>
      ) : null}
    </DrawerShell>
  )
}
