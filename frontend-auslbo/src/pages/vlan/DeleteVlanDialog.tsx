import * as React from 'react'
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'

import { useToast } from '@shared/ui/toast'
import { apiErrorToMessage } from '@shared/api/error'
import { deleteVlan, type VlanRow } from '../../api/vlanApi'

// ─── Delete confirm ───────────────────────────────────────────────────────────

export default function DeleteVlanDialog({
  vlan,
  onClose,
  onDeleted,
}: {
  vlan: VlanRow | null
  onClose: () => void
  onDeleted: () => void
}) {
  const toast = useToast()
  const [deleting, setDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!vlan) return
    setDeleting(true)
    try {
      await deleteVlan(vlan.id)
      toast.success('VLAN eliminata.')
      onDeleted()
    } catch (e) {
      toast.error(apiErrorToMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={!!vlan} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: 15 }}>Elimina VLAN</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14 }}>
          Sei sicuro di voler eliminare{' '}
          <strong>VLAN {vlan?.vlan_id} — {vlan?.name}</strong>?
          <br />
          L'operazione non può essere annullata.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={deleting} variant="outlined" size="small">
          Annulla
        </Button>
        <Button onClick={handleDelete} disabled={deleting} variant="contained" color="error" size="small">
          {deleting ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
          Elimina
        </Button>
      </DialogActions>
    </Dialog>
  )
}
