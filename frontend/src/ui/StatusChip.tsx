import { Chip, type ChipProps } from "@mui/material";

// Palette coerente con Customers (status_id -> colori)
const STATUS_STYLE_BY_ID: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#E0F2FE", fg: "#0369A1" }, // azzurro
  2: { bg: "#DCFCE7", fg: "#166534" }, // verde
  3: { bg: "#FEF9C3", fg: "#854D0E" }, // giallo
  4: { bg: "#FEE2E2", fg: "#991B1B" }, // rosso
  5: { bg: "#EDE9FE", fg: "#5B21B6" }, // viola
  6: { bg: "#FFEDD5", fg: "#9A3412" }, // arancione
};

function statusChipSx(statusId?: number | null) {
  const s = statusId ? STATUS_STYLE_BY_ID[statusId] : null;
  return {
    fontWeight: 400,
    ...(s
      ? {
          bgcolor: s.bg,
          color: s.fg,
          border: "1px solid transparent",
        }
      : {
          bgcolor: "rgba(0,0,0,0.04)",
          color: "rgba(0,0,0,0.7)",
          border: "1px solid rgba(0,0,0,0.10)",
        }),
  } as const;
}

export type StatusChipProps = Omit<ChipProps, "label"> & {
  statusId?: number | null;
  label?: string | null;
};

export default function StatusChip(props: StatusChipProps) {
  const { statusId, label, sx, size = "small", variant = "filled", ...rest } = props;
  const sxArr = Array.isArray(sx) ? sx : sx ? [sx] : [];

  return (
    <Chip
      size={size}
      variant={variant}
      label={label || "—"}
      sx={[statusChipSx(statusId), ...sxArr]}
      {...rest}
    />
  );
}
