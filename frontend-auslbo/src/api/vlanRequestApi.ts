import { apiGet, apiPost } from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RispacsLite {
  id: number
  name: string
  ip: string | null
  aetitle: string | null
}

export interface RispacsConfigItem {
  rispacs_id: number
  etichetta: RequestModalita
}

export type RequestStato = 'pending' | 'approved' | 'rejected'
export type RequestModalita = 'pacs' | 'pacs_emergenza' | 'worklist' | 'altro'

export const MODALITA_OPTIONS: { value: RequestModalita; label: string }[] = [
  { value: 'pacs',           label: 'PACS' },
  { value: 'pacs_emergenza', label: 'PACS Emergenza' },
  { value: 'worklist',       label: 'Worklist' },
  { value: 'altro',          label: 'Altro' },
]

export interface VlanIpRequest {
  id: number
  customer: number
  vlan: number
  vlan_name: string | null
  vlan_network: string | null
  vlan_gateway: string | null
  vlan_subnet: string | null
  ip: string
  aetitle: string | null
  modalita: RequestModalita
  modalita_label: string
  rispacs: number[]
  rispacs_detail: RispacsLite[]
  rispacs_config: RispacsConfigItem[] | null
  site: number | null
  site_name: string | null
  reparto: string | null
  device_type: number | null
  device_type_name: string | null
  manufacturer: number | null
  manufacturer_name: string | null
  stato: RequestStato
  stato_label: string
  note: string | null
  richiedente: number | null
  richiedente_username: string | null
  richiedente_full_name: string | null
  approvato_da: number | null
  approvato_da_username: string | null
  approvato_da_full_name: string | null
  approvato_at: string | null
  created_at: string
  updated_at: string
}

export interface VlanIpRequestPayload {
  customer: number
  vlan: number
  ip: string
  aetitle?: string | null
  modalita: RequestModalita
  rispacs?: number[]
  rispacs_config?: RispacsConfigItem[]
  site?: number | null
  reparto?: string | null
  device_type?: number | null
  manufacturer?: number | null
  note?: string | null
}

export interface VlanIpRequestListResponse {
  count: number
  results: VlanIpRequest[]
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchVlanIpRequests(
  params?: Record<string, unknown>,
): Promise<VlanIpRequestListResponse> {
  return apiGet<VlanIpRequestListResponse>('/vlan-ip-requests/', {
    params: { page_size: 100, ...params },
  })
}

export async function createVlanIpRequest(
  payload: VlanIpRequestPayload,
): Promise<VlanIpRequest> {
  return apiPost<VlanIpRequest>('/vlan-ip-requests/', payload)
}

export async function approveVlanIpRequest(id: number): Promise<VlanIpRequest> {
  return apiPost<VlanIpRequest>(`/vlan-ip-requests/${id}/approve/`)
}

export async function rejectVlanIpRequest(id: number, motivo?: string): Promise<VlanIpRequest> {
  return apiPost<VlanIpRequest>(`/vlan-ip-requests/${id}/reject/`, motivo ? { motivo } : undefined)
}

export async function fetchCustomerRispacs(params?: Record<string, unknown>): Promise<RispacsLite[]> {
  const res = await apiGet<{ results: RispacsLite[] } | RispacsLite[]>(
    '/customer-rispacs/',
    { params: { page_size: 200, ...params } },
  )
  return Array.isArray(res) ? res : res.results
}
