import * as React from 'react'
import type { KpiSpec } from '@shared/hooks/useDrawerKpis'
import { useDrawerKpis } from '@shared/hooks/useDrawerKpis'
import { useAuth } from '../auth/AuthProvider'
import { PERMS } from '../auth/perms'

// Stabile a livello di modulo — non viene ricreato ad ogni render
const CUSTOMER_KPI_SPECS: KpiSpec[] = [
  { key: 'sites',   path: '/sites/',        filterParam: 'customer' },
  { key: 'inv',     path: '/inventories/',   filterParam: 'customer' },
  { key: 'files',   path: '/drive-files/',   filterParam: 'customer' },
  { key: 'folders', path: '/drive-folders/', filterParam: 'customer' },
]
const DEVICES_SPEC: KpiSpec   = { key: 'devices',   path: '/devices/',   filterParam: 'customer' }
const CONTRACTS_SPEC: KpiSpec = { key: 'contracts', path: '/contracts/', filterParam: 'customer' }

/**
 * Conteggi KPI per il drawer cliente: siti, inventari, file+cartelle drive,
 * device e contratti (questi ultimi solo se l'utente ha il permesso di vista,
 * per non generare richieste 403 inutili).
 * Wrapper tipizzato su useDrawerKpis.
 */
export function useCustomerKpis(customerId: number | null) {
  const { hasPerm } = useAuth()
  const withDevices = hasPerm(PERMS.device.device.view)
  const withContracts = hasPerm(PERMS.contracts.contract.view)

  const specs = React.useMemo(
    () => [
      ...CUSTOMER_KPI_SPECS,
      ...(withDevices ? [DEVICES_SPEC] : []),
      ...(withContracts ? [CONTRACTS_SPEC] : []),
    ],
    [withDevices, withContracts],
  )

  const { sites, inv, files, folders, devices, contracts, reset } = useDrawerKpis(customerId, specs)

  const sitesCount = sites as number | null
  const invCount   = inv   as number | null
  const devicesCount   = (devices   ?? null) as number | null
  const contractsCount = (contracts ?? null) as number | null
  const driveCount =
    files != null && folders != null ? (files as number) + (folders as number) :
    files   != null ? (files   as number) :
    folders != null ? (folders as number) :
    null

  return { sitesCount, invCount, driveCount, devicesCount, contractsCount, reset }
}
