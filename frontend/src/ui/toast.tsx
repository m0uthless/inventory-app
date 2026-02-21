import * as React from "react";
import { Alert, Snackbar } from "@mui/material";
import { setApiToast, type ToastLevel } from "../api/runtime";

type Severity = "success" | "info" | "warning" | "error";
type ToastState = { open: boolean; message: string; severity: Severity };

type ToastApi = {
  toast: (message: string, severity?: Severity) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = React.createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ToastState>({
    open: false,
    message: "",
    severity: "info",
  });

  const toast = React.useCallback((message: string, severity: Severity = "info") => {
    setState({ open: true, message, severity });
  }, []);

  const api = React.useMemo<ToastApi>(
    () => ({
      toast,
      success: (m) => toast(m, "success"),
      info: (m) => toast(m, "info"),
      warning: (m) => toast(m, "warning"),
      error: (m) => toast(m, "error"),
    }),
    [toast]
  );

  React.useEffect(() => {
    setApiToast((level: ToastLevel, message: string) => {
      // level è compatibile con Severity nel tuo caso
      toast(message, level as any);
    });

    return () => setApiToast(null);
  }, [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={4500}
        onClose={() => setState((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setState((s) => ({ ...s, open: false }))}
          severity={state.severity}
          variant="filled"
          sx={{ borderRadius: 2, alignItems: "center" }}
        >
          {state.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
