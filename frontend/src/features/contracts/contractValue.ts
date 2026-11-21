import { ITALIAN_REGIONS, regionOfProvinceSigla, type RegionId } from '../../data/italianRegions'
import { fmtNumber } from '@shared/utils/number'

/** Riga di `GET /api/contracts/value-by-customer/`. */
export type CustomerValueRow = { customer_id: number; customer_name: string; province: string | null; value: string; contracts: number }
export type CustomerValue = { id: number; name: string; province: string | null; region: RegionId | null; value: number; contracts: number }
export type RegionValue = { region: RegionId | null; name: string; value: number; customers: number }

const REGION_NAME = Object.fromEntries(ITALIAN_REGIONS.map((r) => [r.id, r.name])) as Record<RegionId, string>
export const regionName = (r: RegionId | null) => (r ? REGION_NAME[r] : 'Senza regione')

export function toCustomerValues(rows: CustomerValueRow[]): CustomerValue[] {
  return rows.map((r) => ({
    id: r.customer_id, name: r.customer_name, province: r.province, region: regionOfProvinceSigla(r.province),
    value: Number(r.value) || 0, contracts: r.contracts,
  })).sort((a, b) => b.value - a.value)
}

/** Totali per regione (dalla provincia del cliente), dal valore più alto; «Senza regione» sempre in fondo. */
export function byRegion(list: CustomerValue[]): RegionValue[] {
  const m = new Map<RegionId | null, RegionValue>()
  for (const c of list) {
    const g = m.get(c.region) ?? { region: c.region, name: regionName(c.region), value: 0, customers: 0 }
    g.value += c.value; g.customers += 1
    m.set(c.region, g)
  }
  return [...m.values()].sort((a, b) => (a.region === null ? 1 : b.region === null ? -1 : b.value - a.value))
}

export const sumValue = (list: { value: number }[]) => list.reduce((s, x) => s + x.value, 0)
export const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)
/** Euro senza decimali, per classifiche e indicatori. */
export const eur0 = (n: number) => fmtNumber(n, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
