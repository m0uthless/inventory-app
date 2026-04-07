import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
} from '@mui/material'

import * as React from 'react'

type Props = {
  open: boolean
  title?: string
  description?: string
  busy?: boolean
  confirmText?: string
  onClose: () => void
  onConfirm: () => void
}

export default function ConfirmDeleteDialog(props: Props) {
  const {
    open,
    title = 'Confermi eliminazione?',
    description = 'L’elemento verrà spostato nel cestino e potrà essere ripristinato.',
    busy = false,
    confirmText = 'Elimina',
    onClose,
    onConfirm,
  } = props

  const handleClose = React.useCallback(() => {
    if (busy) return
    onClose()
  }, [busy, onClose])

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="confirm-delete-title"
      disableEscapeKeyDown={busy}
    >
      <DialogTitle id="confirm-delete-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ whiteSpace: 'pre-line' }}>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy} autoFocus>
          Annulla
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} /> : undefined}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
