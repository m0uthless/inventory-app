import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'

import type { DrawerItem } from './types'

// ─── Rename dialog ───────────────────────────────────────────────────────────

export function RenameDialog({
  item,
  name,
  busy,
  onNameChange,
  onClose,
  onRename,
}: {
  item: DrawerItem | null
  name: string
  busy: boolean
  onNameChange: (name: string) => void
  onClose: () => void
  onRename: () => void
}) {
  return (
    <Dialog open={!!item} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Rinomina</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          size="small"
          label="Nuovo nome"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRename()
          }}
          fullWidth
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Annulla
        </Button>
        <Button variant="contained" onClick={onRename} disabled={busy || !name.trim()}>
          {busy ? 'Salvataggio…' : 'Salva'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
