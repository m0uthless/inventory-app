import * as React from 'react'
import { api } from '../api/client'

export type KpiSpec = {
  /** Key usata per identificare il conteggio nel risultato */
  key: string
  /** Path API, es. '/inventories/' */
  path: string
  /**
   * Nome del parametro di filtro sull'entità padre, es. 'site' o 'customer'.
   * Il valore sarà entityId. Ulteriori parametri fissi vanno in extraParams.
   */
  filterParam: string
  /** Parametri aggiuntivi costanti (non dipendenti da entityId) */
  extraParams?: Record<string, unknown>
}

type KpiCounts = Record<string, number | null>

export type KpiResult = KpiCounts & { reset: () => void }

/**
 * Hook generico per caricare conteggi KPI in parallelo nel drawer di un'entità.
 *
 * - Usa Promise.allSettled: se un endpoint fallisce (permessi mancanti ecc.)
 *   gli altri conteggi vengono comunque visualizzati.
 * - Resetta tutti i conteggi a null quando entityId cambia.
 * - Espone reset() per azzerare istantaneamente (es. alla chiusura del drawer).
 * - specs deve essere stabile (definita a livello di modulo o con useMemo).
 *
 * @example
 * const SPECS: KpiSpec[] = [
 *   { key: 'inv',     path: '/inventories/', filterParam: 'site' },
 *   { key: 'contact', path: '/contacts/',    filterParam: 'site' },
 * ]
 * const { inv, contact, reset } = useDrawerKpis(detail?.id ?? null, SPECS)
 */
export function useDrawerKpis(entityId: number | null, specs: KpiSpec[]): KpiResult {
  const keys = React.useMemo(() => specs.map((s) => s.key), [specs])

  const nullCounts = React.useMemo(
    () => Object.fromEntries(keys.map((k) => [k, null])) as KpiCounts,
    [keys],
  )

  const [counts, setCounts] = React.useState<KpiCounts>(nullCounts)

  const reset = React.useCallback(() => setCounts(nullCounts), [nullCounts])

  // Ref per leggere specs aggiornate senza ricreare l'effect
  const specsRef = React.useRef(specs)
  React.useEffect(() => { specsRef.current = specs }, [specs])

  React.useEffect(() => {
    if (!entityId) {
      setCounts(nullCounts)
      return
    }

    setCounts(nullCounts)
    let cancelled = false

    Promise.allSettled(
      specsRef.current.map((s) =>
        api.get(s.path, {
          params: { [s.filterParam]: entityId, page_size: 1, ...s.extraParams },
        }),
      ),
    ).then((results) => {
      if (cancelled) return
      const next: KpiCounts = {}
      results.forEach((result, i) => {
        next[specsRef.current[i].key] =
          result.status === 'fulfilled'
            ? Number(result.value.data?.count ?? 0)
            : null
      })
      setCounts(next)
    })

    return () => { cancelled = true }
  }, [entityId, nullCounts])

  return { ...counts, reset } as KpiResult
}
