import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

import { apiToast, handleUnauthorized } from './runtime'

// NOTE: nginx proxy /api -> backend
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
})

function extractErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: unknown } }
  const data = e?.response?.data
  if (!data) return 'Errore.'
  if (typeof data === 'string') return data // es. HTML CSRF
  if (
    typeof data === 'object' &&
    data !== null &&
    'detail' in data &&
    typeof (data as { detail?: unknown }).detail === 'string'
  ) {
    return (data as { detail: string }).detail
  }
  return 'Errore.'
}

let handling401 = false
let last403ToastAt = 0
const TOAST_403_COOLDOWN_MS = 2500

function shouldToast403(): boolean {
  const now = Date.now()
  if (now - last403ToastAt < TOAST_403_COOLDOWN_MS) return false
  last403ToastAt = now
  return true
}

api.interceptors.response.use(
  (res) => {
    return res
  },
  (err) => {
    const status = (err as { response?: { status?: number } })?.response?.status
    const url = String((err as { config?: { url?: unknown } })?.config?.url || '')

    const isAuthEndpoint =
      url.includes('/auth/login/') ||
      url.includes('/auth/logout/') ||
      url.includes('/auth/csrf/') ||
      url.includes('/me/')

    if (status === 401 && !isAuthEndpoint) {
      if (!handling401) {
        handling401 = true
        apiToast('warning', 'Sessione scaduta. Effettua di nuovo il login.')
        handleUnauthorized()
        setTimeout(() => (handling401 = false), 500)
      }
    }

    // 403: permessi mancanti (o CSRF fail)
    // Nota UX: alcune chiamate "best effort" possono tornare 403 (es. permessi opzionali) e generare spam di toast.
    // Throttliamo il toast per evitare rumore.
    if (status === 403 && !isAuthEndpoint) {
      const msg = extractErrorMessage(err)
      if (shouldToast403()) {
        if (msg.toLowerCase().includes('csrf')) {
          apiToast('error', 'CSRF non valido. Ricarica la pagina e riprova.')
        } else {
          apiToast('error', 'Non autorizzato.')
        }
      }
    }

    return Promise.reject(err)
  },
)

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<T> = await api.get(url, config)
  return res.data
}

export async function apiPost<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res: AxiosResponse<T> = await api.post(url, data, config)
  return res.data
}

export async function apiPut<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res: AxiosResponse<T> = await api.put(url, data, config)
  return res.data
}

export async function apiPatch<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res: AxiosResponse<T> = await api.patch(url, data, config)
  return res.data
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<T> = await api.delete(url, config)
  return res.data
}
