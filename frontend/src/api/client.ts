import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { apiToast, handleUnauthorized } from "./runtime";

export const api = axios.create({
  baseURL: "/api", // passa dal proxy nginx (/api -> backend)
  // Alcune richieste possono essere lente (import, batch, export):
  // allineo il timeout al proxy nginx (130s) / gunicorn (120s).
  timeout: 130000,

  // Session auth (cookie)
  withCredentials: true,

  // Django CSRF defaults
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
});

function extractErrorMessage(err: any): string {
  const data = err?.response?.data;
  if (!data) return "Errore.";
  if (typeof data === "string") return data; // es. HTML CSRF
  if (typeof data?.detail === "string") return data.detail;
  return "Errore.";
}

let handling401 = false;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const url = String(err?.config?.url || "");

    const isAuthEndpoint =
      url.includes("/auth/login/") ||
      url.includes("/auth/logout/") ||
      url.includes("/auth/csrf/") ||
      url.includes("/me/");

    // 401: session scaduta / non loggato
    if (status === 401 && !isAuthEndpoint) {
      if (!handling401) {
        handling401 = true;
        apiToast("warning", "Sessione scaduta. Effettua di nuovo il login.");
        handleUnauthorized();
        // nota: se fai redirect, questo diventa irrilevante; lo resetto comunque.
        setTimeout(() => (handling401 = false), 500);
      }
    }

    // 403: permessi mancanti (o CSRF fail)
    if (status === 403 && !isAuthEndpoint) {
      const msg = extractErrorMessage(err);
      // messaggio più “umano”
      if (msg.toLowerCase().includes("csrf")) {
        apiToast("error", "CSRF non valido. Ricarica la pagina e riprova.");
      } else {
        apiToast("error", "Non autorizzato.");
      }
    }

    return Promise.reject(err);
  }
);

// Helpers tipizzati (evita ripetizione di .data in giro)
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<T> = await api.get(url, config);
  return res.data;
}

export async function apiPost<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<T> = await api.post(url, data, config);
  return res.data;
}

export async function apiPut<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<T> = await api.put(url, data, config);
  return res.data;
}

export async function apiPatch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<T> = await api.patch(url, data, config);
  return res.data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<T> = await api.delete(url, config);
  return res.data;
}
