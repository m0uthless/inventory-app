import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'

// ─── Create folder dialog ───────────────────────────────────────────────────

export function CreateFolderDialog({
  open,
  name,
  busy,
  onNameChange,
  onClose,
  onCreate,
}: {
  open: boolean
  name: string
  busy: boolean
  onNameChange: (name: string) => void
  onClose: () => void
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Nuova cartella</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          size="small"
          label="Nome cartella"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCreate()
          }}
          fullWidth
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Annulla
        </Button>
        <Button variant="contained" onClick={onCreate} disabled={busy || !name.trim()}>
          {busy ? 'Creazione…' : 'Crea'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
