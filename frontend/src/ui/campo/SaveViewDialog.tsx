import * as React from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'

export function SaveViewDialog({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = React.useState('')
  React.useEffect(() => { if (open) setName('') }, [open])
  const ok = name.trim().length > 0
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Salva vista</DialogTitle>
      <DialogContent>
        <TextField autoFocus fullWidth size="small" label="Nome della vista" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (ok) { onSave(name.trim()); onClose() } } }}
          helperText="Salva scheda, filtri, ordinamento e ricerca attuali." sx={{ mt: 1 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annulla</Button>
        <Button variant="contained" disabled={!ok} onClick={() => { onSave(name.trim()); onClose() }}>Salva</Button>
      </DialogActions>
    </Dialog>
  )
}
