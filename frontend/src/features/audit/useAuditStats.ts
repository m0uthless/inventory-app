import * as React from 'react'
import { api } from '@shared/api/client'
import type { AuditStats } from './auditModel'

export function useAuditStats(reloadKey?: unknown) {
  const [stats, setStats] = React.useState<AuditStats | null>(null)
  React.useEffect(() => {
    let alive = true
    api.get<AuditStats>('/audit-events/stats/').then((r) => { if (alive) setStats(r.data) }).catch(() => { if (alive) setStats(null) })
    return () => { alive = false }
  }, [reloadKey])
  return stats
}
