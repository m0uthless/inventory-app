import {
  Avatar, Box, Button, CircularProgress, Divider, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import SendIcon from '@mui/icons-material/Send'
import { ActionIconButton } from '@shared/ui/ActionIconButton'
import { DrawerShell } from '@shared/ui/DrawerShell'
import { DrawerSection, DrawerFieldList } from '@shared/ui/DrawerParts'
import {
  PRIORITY_META, STATUS_META, fmtTaskDate, fmtTaskDateTime, formatBytes, personInitials,
  type AreaTaskComment, type AreaTaskRow,
} from './types'

export type AreaTaskDrawerProps = {
  open: boolean
  task: AreaTaskRow | null
  tab: number
  comments: AreaTaskComment[]
  commentsLoading: boolean
  newComment: string
  sendingComment: boolean
  canLinkFiles: boolean
  unlinkingId: number | null
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onTabChange: (value: number) => void
  onNewCommentChange: (value: string) => void
  onSendComment: () => void
  onLinkFiles: () => void
  onUnlinkFile: (fileId: number) => void
}

export default function AreaTaskDrawer({
  open, task, tab, comments, commentsLoading, newComment, sendingComment, canLinkFiles, unlinkingId,
  onClose, onEdit, onDelete, onTabChange, onNewCommentChange, onSendComment, onLinkFiles, onUnlinkFile,
}: AreaTaskDrawerProps) {
  const files = task?.drive_files_detail ?? []
  const canEdit = Boolean(task?.can_edit)

  const commentFooter = tab === 1 && canEdit ? (
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
      statusLabel={task ? `● ${STATUS_META[task.status]?.label ?? task.status}` : undefined}
      statusLabelSecondary={task ? (PRIORITY_META[task.priority]?.label ?? task.priority) : undefined}
      canChange={canEdit} canDelete={canEdit}
      onEdit={onEdit} onDelete={onDelete}
      title={task?.title ?? ''}
      subtitle={task?.area_label}
      loading={commentsLoading}
      tabs={['Dettagli', `Commenti (${comments.length})`, `Allegati (${files.length})`]}
      tabValue={tab} onTabChange={onTabChange}
      bodySx={{ minHeight: 0 }}
      bodyFooter={commentFooter}
    >
      {tab === 0 && task ? (
        <>
          <DrawerSection icon={<NotesOutlinedIcon sx={{ fontSize: 14 }} />} title="Descrizione">
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {task.description || '—'}
            </Typography>
          </DrawerSection>

          <DrawerSection icon={<InfoOutlinedIcon sx={{ fontSize: 14 }} />} title="Informazioni">
            <Stack divider={<Divider sx={{ borderColor: 'grey.100' }} />}>
              <DrawerFieldList rows={[
                { label: 'Area', value: task.area_label },
                { label: 'Assegnato a', value: task.assigned_to_name },
                { label: 'Scadenza', value: fmtTaskDate(task.due_date) },
                { label: 'Completato il', value: fmtTaskDateTime(task.completed_at) },
                { label: 'Creato da', value: task.created_by_name },
                { label: 'Creato il', value: fmtTaskDateTime(task.created_at) },
                { label: 'Aggiornato il', value: fmtTaskDateTime(task.updated_at) },
              ]} />
            </Stack>
          </DrawerSection>
        </>
      ) : null}

      {tab === 1 ? (
        <Stack spacing={0} sx={{ flex: 1 }}>
          {commentsLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={24} /></Stack>
          ) : comments.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Nessun commento ancora.</Typography>
            </Box>
          ) : (
            comments.map((comment, index) => (
              <Box key={comment.id}>
                <Box sx={{ display: 'flex', gap: 1.5, py: 2 }}>
                  <Avatar sx={{ width: 32, height: 32, fontSize: '0.72rem', fontWeight: 700, bgcolor: 'primary.main', flexShrink: 0 }}>
                    {personInitials(comment.author_name)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{comment.author_name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtTaskDateTime(comment.created_at)}</Typography>
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

      {tab === 2 ? (
        <Stack spacing={1.5} sx={{ flex: 1 }}>
          {canEdit && canLinkFiles ? (
            <Button variant="outlined" size="small" startIcon={<AttachFileIcon />} onClick={onLinkFiles} sx={{ alignSelf: 'flex-start' }}>
              Collega file da Drive
            </Button>
          ) : null}
          {files.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <AttachFileIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Nessun allegato collegato.</Typography>
            </Box>
          ) : (
            files.map((file) => (
              <Stack key={file.id} direction="row" alignItems="center" spacing={1} sx={{ px: 1, py: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <InsertDriveFileOutlinedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                <Box
                  role="link" tabIndex={0}
                  onClick={() => window.open(`/api/drive-files/${file.id}/download/`, '_blank')}
                  onKeyDown={(e) => { if (e.key === 'Enter') window.open(`/api/drive-files/${file.id}/download/`, '_blank') }}
                  sx={{ flex: 1, minWidth: 0, cursor: 'pointer', '&:hover .file-name': { textDecoration: 'underline' } }}
                >
                  <Typography className="file-name" variant="body2" sx={{ fontWeight: 600 }} noWrap>{file.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatBytes(file.size)}</Typography>
                </Box>
                {canEdit ? (
                  <Tooltip title="Scollega">
                    <span>
                      <IconButton
                        size="small" aria-label={`Scollega ${file.name}`}
                        disabled={unlinkingId === file.id}
                        onClick={() => onUnlinkFile(file.id)}
                      >
                        {unlinkingId === file.id ? <CircularProgress size={16} /> : <LinkOffIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : null}
              </Stack>
            ))
          )}
        </Stack>
      ) : null}
    </DrawerShell>
  )
}
