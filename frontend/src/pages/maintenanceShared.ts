// Costanti e helper condivisi tra Maintenance.tsx, MaintenancePlans.tsx e
// Rapportini.tsx — estratti perché erano duplicati quasi identici nei tre file.
// Segue la stessa idea di frontend/src/features/pianoferie/pianoFerieShared.ts,
// ma qui il file resta accanto a maintenanceTypes.ts (già in pages/) invece di
// un nuovo features/maintenance/, per non introdurre una seconda convenzione
// di posizionamento per lo stesso modulo.
//
// Solo costanti/funzioni pure in questo file (nessun componente): il campo
// "Anno" condiviso vive in ./maintenance/YearFilterField.tsx.

export const UNIT_IT: Record<string, string> = { days: 'giorni', weeks: 'settimane', months: 'mesi', years: 'anni' }

export const RESULT_COLOR: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  ok: 'success', ko: 'error', partial: 'warning', not_planned: 'default',
}
export const RESULT_LABEL: Record<string, string> = {
  ok: 'OK', ko: 'KO', partial: 'Parziale', not_planned: 'Non prevista',
}

export function dueDiffDays(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

// Densità riga/header di base, comune alle tre grid. Rapportini.tsx aggiunge
// in più le regole di hover delle row-actions (sx: { ...MAINTENANCE_GRID_SX_BASE, ...extra }).
export const MAINTENANCE_GRID_SX_BASE = {
  '--DataGrid-rowHeight': '24px',
  '--DataGrid-headerHeight': '35px',
  '& .MuiDataGrid-cell': { py: 0.25 },
  '& .MuiDataGrid-columnHeader': { py: 0.75 },
} as const
