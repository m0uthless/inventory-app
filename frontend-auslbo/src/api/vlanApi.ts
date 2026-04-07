import { apiGet, apiPost, apiPatch, apiDelete } from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VlanRow {
  id: number
  customer: number
  customer_name: string | null
  site: number
  site_name: string | null
  site_display_name: string | null
  vlan_id: number
  name: string
  network: string
  subnet: string
  gateway: string
  lan: string | null
  note: string | null
  total_hosts: number
  used_count: number
  free_count: number
  created_at: string
  updated_at: string
}

export type IpStatus = 'free' | 'used' | 'reserved'
export type IpKind = 'network' | 'broadcast' | 'gateway' | 'host'
export type UsedByType = 'inventory' | 'device' | 'request' | null

export interface IpPoolEntry {
  ip: string
  kind: IpKind
  status: IpStatus
  used_by: string | null
  used_by_type: UsedByType
  used_by_id: number | null
}

export interface VlanListResponse {
  count: number
  results: VlanRow[]
}

export interface VlanPayload {
  customer: number
  site: number
  vlan_id: number
  name: string
  network: string
  subnet: string
  gateway: string
  lan?: string | null
  note?: string | null
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchVlans(params?: Record<string, unknown>): Promise<VlanListResponse> {
  return apiGet<VlanListResponse>('/vlans/', { params: { page_size: 200, ...params } })
}

export async function fetchVlanIpPool(vlanId: number): Promise<IpPoolEntry[]> {
  return apiGet<IpPoolEntry[]>(`/vlans/${vlanId}/ip-pool/`)
}

export async function createVlan(payload: VlanPayload): Promise<VlanRow> {
  return apiPost<VlanRow>('/vlans/', payload)
}

export async function updateVlan(id: number, payload: Partial<VlanPayload>): Promise<VlanRow> {
  return apiPatch<VlanRow>(`/vlans/${id}/`, payload)
}

export async function deleteVlan(id: number): Promise<void> {
  return apiDelete<void>(`/vlans/${id}/`)
}
