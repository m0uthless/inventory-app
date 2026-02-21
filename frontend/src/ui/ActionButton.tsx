import { Button, type ButtonProps } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

type ActionButtonProps = ButtonProps & {
  compact?: boolean;
  tone?: "primary" | "secondary";
  selectedLook?: boolean;
};

export default function ActionButton(props: ActionButtonProps) {
  const theme = useTheme();
  const { compact = true, tone = "primary", selectedLook = true, sx, ...rest } = props;

  const main = theme.palette[tone].main;

  const baseSx = selectedLook
    ? {
        backgroundColor: alpha(main, 0.14),
        color: main,
        border: `1px solid ${alpha(main, 0.25)}`,
        "&:hover": {
          backgroundColor: alpha(main, 0.22),
          borderColor: alpha(main, 0.35),
        },
      }
    : {};

  return (
    <Button
      size={compact ? "small" : "medium"}
      variant="text"
      sx={{
        textTransform: "none",
        fontWeight: 500, // <-- qui: 400/500/600 come preferisci
        borderRadius: 2,
        justifyContent: "flex-start",
        ...(compact ? { height: 34, px: 1.25 } : {}),
        ...baseSx,
        ...sx,
      }}
      {...rest}
    />
  );
}
