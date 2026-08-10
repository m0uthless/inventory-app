import * as React from 'react'
import type { GroupByMode } from '../../pages/siteRepository/types'

export type SiteRepoV2Handle = {
  collapseAll: () => void
  expandAll: () => void
}

type SiteRepoV2ContextValue = {
  searchQuery: string
  setSearchQuery: (q: string) => void
  handle: SiteRepoV2Handle | null
  registerHandle: (h: SiteRepoV2Handle) => void
  unregisterHandle: () => void
  totalCustomers: number
  totalCities: number
  setTotals: (customers: number, cities: number) => void
  groupBy: GroupByMode
  setGroupBy: (g: GroupByMode) => void
}

export const SiteRepoV2Context = React.createContext<SiteRepoV2ContextValue>({
  searchQuery: '',
  setSearchQuery: () => {},
  handle: null,
  registerHandle: () => {},
  unregisterHandle: () => {},
  totalCustomers: 0,
  totalCities: 0,
  setTotals: () => {},
  groupBy: 'province',
  setGroupBy: () => {},
})

export function SiteRepoV2Provider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [handle, setHandle] = React.useState<SiteRepoV2Handle | null>(null)
  const [totalCustomers, setTotalCustomers] = React.useState(0)
  const [totalCities, setTotalCities] = React.useState(0)
  // Reset ad ogni sessione (niente persistenza): il default è sempre "provincia".
  const [groupBy, setGroupBy] = React.useState<GroupByMode>('province')

  const registerHandle = React.useCallback((h: SiteRepoV2Handle) => setHandle(h), [])
  const unregisterHandle = React.useCallback(() => setHandle(null), [])
  const setTotals = React.useCallback((c: number, ci: number) => {
    setTotalCustomers(c)
    setTotalCities(ci)
  }, [])

  return (
    <SiteRepoV2Context.Provider value={{
      searchQuery, setSearchQuery,
      handle, registerHandle, unregisterHandle,
      totalCustomers, totalCities, setTotals,
      groupBy, setGroupBy,
    }}>
      {children}
    </SiteRepoV2Context.Provider>
  )
}

export function useSiteRepoV2() {
  return React.useContext(SiteRepoV2Context)
}
