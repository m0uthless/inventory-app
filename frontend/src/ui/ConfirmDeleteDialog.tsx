import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
} from "@mui/material";

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  busy?: boolean;
  confirmText?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteDialog(props: Props) {
  const {
    open,
    title = "Confermi eliminazione?",
    description = "L’elemento verrà spostato nel cestino e potrà essere ripristinato.",
    busy = false,
    confirmText = "Elimina",
    onClose,
    onConfirm,
  } = props;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
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
  );
}
