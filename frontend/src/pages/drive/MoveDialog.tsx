import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'

import type { DrawerItem, DriveFolder } from './types'

// ─── Move dialog ─────────────────────────────────────────────────────────────

export function MoveDialog({
  item,
  folders,
  target,
  busy,
  onSelectTarget,
  onClose,
  onMove,
}: {
  item: DrawerItem | null
  folders: DriveFolder[]
  target: number | null
  busy: boolean
  onSelectTarget: (id: number | null) => void
  onClose: () => void
  onMove: () => void
}) {
  return (
    <Dialog open={!!item} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Sposta in…</DialogTitle>
      <DialogContent>
        <Stack spacing={0.5} sx={{ mt: 1, maxHeight: 300, overflowY: 'auto' }}>
          <Box
            onClick={() => onSelectTarget(null)}
            sx={{
              px: 1.5,
              py: 1,
              borderRadius: 1.5,
              cursor: 'pointer',
              bgcolor: target === null ? 'rgba(15,118,110,0.08)' : 'transparent',
              border: '1px solid',
              borderColor: target === null ? 'primary.main' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <FolderIcon sx={{ fontSize: 18, color: 'warning.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Root
            </Typography>
          </Box>
          {folders.map((f) => (
            <Box
              key={f.id}
              onClick={() => onSelectTarget(f.id)}
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                cursor: 'pointer',
                bgcolor: target === f.id ? 'rgba(15,118,110,0.08)' : 'transparent',
                border: '1px solid',
                borderColor: target === f.id ? 'primary.main' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                '&:hover': { bgcolor: 'rgba(15,118,110,0.04)' },
              }}
            >
              <FolderIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography variant="body2">{f.full_path}</Typography>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Annulla
        </Button>
        <Button variant="contained" onClick={onMove} disabled={busy}>
          {busy ? 'Spostamento…' : 'Sposta'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
