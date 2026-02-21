export type ToastLevel = "success" | "error" | "warning" | "info";

type ToastFn = (level: ToastLevel, message: string) => void;
type UnauthorizedFn = () => void;

let toastFn: ToastFn | null = null;
let unauthorizedFn: UnauthorizedFn | null = null;

export function setApiToast(fn: ToastFn | null) {
  toastFn = fn;
}

export function setUnauthorizedHandler(fn: UnauthorizedFn | null) {
  unauthorizedFn = fn;
}

export function apiToast(level: ToastLevel, message: string) {
  try {
    toastFn?.(level, message);
  } catch {
    // fallback: non bloccare mai le API per un toast
    console.warn("[toast]", level, message);
  }
}

export function handleUnauthorized() {
  try {
    unauthorizedFn?.();
  } catch {
    // fallback
    window.location.assign("/login");
  }
}
