import { Chip } from "@mui/material";

export type AuditAction = "create" | "update" | "delete" | "restore" | string;

function actionToChip(action: AuditAction) {
  const a = (action || "").toLowerCase();
  switch (a) {
    case "create":
      return { label: "Creato", color: "success" as const };
    case "update":
      return { label: "Modificato", color: "info" as const };
    case "delete":
      return { label: "Eliminato", color: "error" as const };
    case "restore":
      return { label: "Ripristinato", color: "warning" as const };
    case "login":
      return { label: "Login", color: "primary" as const };
    case "login_failed":
      return { label: "Login fallito", color: "error" as const };
    case "logout":
      return { label: "Logout", color: "secondary" as const };
    default:
      return { label: action || "—", color: "default" as const };
  }
}

export default function AuditActionChip(props: { action: AuditAction; size?: "small" | "medium" }) {
  const { action, size = "small" } = props;
  const { label, color } = actionToChip(action);
  return <Chip size={size} label={label} color={color} variant={color === "default" ? "outlined" : "filled"} />;
}
