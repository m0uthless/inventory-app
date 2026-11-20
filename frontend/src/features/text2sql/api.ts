import { api } from '@shared/api/client'

export type T2sStatus = 'queued' | 'running' | 'done' | 'error'
export type T2sKind = 'read' | 'write' | 'impossible' | ''
export type T2sFeedback = 'ok' | 'ko' | ''

export type T2sRequest = {
  id: number
  question: string
  status: T2sStatus
  sql: string
  kind: T2sKind
  warnings: string[]
  seconds: number | null
  error: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  feedback: T2sFeedback
  corrected_sql: string
  feedback_note: string
  feedback_at: string | null
}

export type T2sReviewRow = T2sRequest & { user_full_name: string; example_markdown: string; reviewed_at: string | null }
export type T2sFeedbackPayload = { feedback: 'ok' | 'ko'; corrected_sql: string; feedback_note: string }

const rowsOf = <T,>(data: unknown): T[] => (Array.isArray(data) ? data : ((data as { results?: T[] })?.results ?? [])) as T[]

export const isWaiting = (r: Pick<T2sRequest, 'status'>) => r.status === 'queued' || r.status === 'running'

export const t2sApi = {
  list: async () => rowsOf<T2sRequest>((await api.get('/text2sql/', { params: { page_size: 50 } })).data),
  get: async (id: number) => (await api.get<T2sRequest>(`/text2sql/${id}/`)).data,
  /** La risposta è stata aperta: la sua notifica diventa letta. */
  seen: async (id: number) => { await api.post(`/text2sql/${id}/seen/`) },
  create: async (question: string) => (await api.post<T2sRequest>('/text2sql/', { question })).data,
  remove: async (id: number) => { await api.delete(`/text2sql/${id}/`) },
  feedback: async (id: number, p: T2sFeedbackPayload) => (await api.patch<T2sRequest>(`/text2sql/${id}/feedback/`, p)).data,
  review: async (feedback: '' | 'ok' | 'ko') => rowsOf<T2sReviewRow>((await api.get('/text2sql/review/', { params: { page_size: 100, ...(feedback ? { feedback } : {}) } })).data),
  reviewed: async (id: number, reviewed: boolean) => (await api.post<T2sReviewRow>(`/text2sql/${id}/reviewed/`, { reviewed })).data,
}

export const STATUS_LABEL: Record<T2sStatus, string> = { queued: 'In coda', running: 'In elaborazione…', done: 'Pronta', error: 'Non riuscita' }
export const KIND_LABEL: Record<Exclude<T2sKind, ''>, string> = { read: 'Lettura', write: 'Scrittura', impossible: 'Impossibile' }
