import * as React from "react";
import type { ButtonProps } from "@mui/material";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  busy?: boolean;
  confirmText?: string;
  confirmColor?: ButtonProps["color"];
  confirmStartIcon?: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmActionDialog(props: Props) {
  const {
    open,
    title,
    description,
    busy = false,
    confirmText = "Conferma",
    confirmColor = "primary",
    confirmStartIcon,
    onClose,
    onConfirm,
  } = props;

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="confirm-action-title"
    >
      <DialogTitle id="confirm-action-title">
        {title}
      </DialogTitle>
      {description ? (
        <DialogContent>
          <DialogContentText sx={{ whiteSpace: "pre-line" }}>{description}</DialogContentText>
        </DialogContent>
      ) : null}
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>
          Annulla
        </Button>
        <Button
          variant="contained"
          color={confirmColor}
          onClick={onConfirm}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} /> : confirmStartIcon}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
