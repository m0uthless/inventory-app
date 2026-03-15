/**
 * useGridEmptyState
 *
 * Genera automaticamente il messaggio di empty state per i DataGrid
 * distinguendo tre scenari:
 *   1. Filtro/ricerca attivi e nessun risultato → suggerisce di resettare
 *   2. Vista "cestino" vuota → messaggio specifico
 *   3. Lista completamente vuota → invita a creare il primo elemento
 *
 * Uso:
 *   const emptyState = useGridEmptyState({
 *     hasActiveFilters: !!grid.q || !!statusFilter,
 *     view: grid.view,
 *     entityLabel: 'clienti',
 *     onReset: grid.reset,
 *   })
 */

import * as React from 'react'
import type { GridEmptyState } from '../ui/ServerDataGrid'
import { Button } from '@mui/material'

type Options = {
  /** true se c'è almeno un filtro attivo (ricerca, dropdown, ecc.) */
  hasActiveFilters: boolean
  /** vista corrente del grid */
  view?: 'active' | 'all' | 'deleted'
  /** nome dell'entità al plurale, es. "clienti", "siti", "contatti" */
  entityLabel: string
  /** callback per resettare tutti i filtri */
  onReset?: () => void
  /** callback per aprire il form di creazione */
  onCreate?: () => void
}

export function useGridEmptyState({
  hasActiveFilters,
  view,
  entityLabel,
  onReset,
  onCreate,
}: Options): GridEmptyState {
  return React.useMemo<GridEmptyState>(() => {
    if (view === 'deleted') {
      return {
        title: 'Cestino vuoto',
        subtitle: `Nessun ${entityLabel.replace(/i$/, 'o').replace(/e$/, 'a')} nel cestino.`,
      }
    }

    if (hasActiveFilters) {
      return {
        title: 'Nessun risultato',
        subtitle: 'Nessun elemento corrisponde ai filtri attivi.',
        action: onReset ? (
          <Button size="small" variant="outlined" onClick={onReset}>
            Reimposta filtri
          </Button>
        ) : undefined,
      }
    }

    return {
      title: `Nessun ${entityLabel.replace(/i$/, 'o').replace(/e$/, 'a')} ancora`,
      subtitle: `Crea il primo elemento per iniziare.`,
      action: onCreate ? (
        <Button size="small" variant="contained" onClick={onCreate}>
          Crea nuovo
        </Button>
      ) : undefined,
    }
  }, [hasActiveFilters, view, entityLabel, onReset, onCreate])
}
