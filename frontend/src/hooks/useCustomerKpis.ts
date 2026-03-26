import type { KpiSpec } from './useDrawerKpis'
import { useDrawerKpis } from './useDrawerKpis'

// Stabile a livello di modulo — non viene ricreato ad ogni render
const CUSTOMER_KPI_SPECS: KpiSpec[] = [
  { key: 'sites',   path: '/sites/',        filterParam: 'customer' },
  { key: 'inv',     path: '/inventories/',   filterParam: 'customer' },
  { key: 'files',   path: '/drive-files/',   filterParam: 'customer' },
  { key: 'folders', path: '/drive-folders/', filterParam: 'customer' },
]

/**
 * Conteggi KPI per il drawer cliente: siti, inventari, file+cartelle drive.
 * Wrapper tipizzato su useDrawerKpis.
 */
export function useCustomerKpis(customerId: number | null) {
  const { sites, inv, files, folders, reset } = useDrawerKpis(customerId, CUSTOMER_KPI_SPECS)

  const sitesCount = sites as number | null
  const invCount   = inv   as number | null
  const driveCount =
    files != null && folders != null ? (files as number) + (folders as number) :
    files   != null ? (files   as number) :
    folders != null ? (folders as number) :
    null

  return { sitesCount, invCount, driveCount, reset }
}
