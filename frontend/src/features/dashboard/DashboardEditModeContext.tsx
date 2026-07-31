import * as React from 'react'

// ─── Dashboard edit-mode context ───────────────────────────────────────────────
// Stato condiviso tra la voce "Personalizza dashboard" nel menu utente
// (AppLayout.tsx, fuori dall'albero di Dashboard.tsx) e la griglia widget
// (DashboardGrid.tsx). Vive qui invece che in un useState locale perché i due
// componenti non sono genitore/figlio diretti: AppLayout renderizza <Outlet/>,
// quindi serve un context condiviso più in alto nell'albero (in AppLayout
// stesso, che avvolge sia il menu che l'Outlet).

type DashboardEditModeContextValue = {
  editMode: boolean
  toggleEditMode: () => void
  setEditMode: (value: boolean) => void
}

const DashboardEditModeContext = React.createContext<DashboardEditModeContextValue | null>(null)

export function DashboardEditModeProvider({ children }: { children: React.ReactNode }) {
  const [editMode, setEditMode] = React.useState(false)
  const toggleEditMode = React.useCallback(() => setEditMode(v => !v), [])

  const value = React.useMemo(
    () => ({ editMode, toggleEditMode, setEditMode }),
    [editMode, toggleEditMode],
  )

  return (
    <DashboardEditModeContext.Provider value={value}>
      {children}
    </DashboardEditModeContext.Provider>
  )
}

export function useDashboardEditMode() {
  const ctx = React.useContext(DashboardEditModeContext)
  if (!ctx) {
    throw new Error('useDashboardEditMode deve essere usato dentro <DashboardEditModeProvider>')
  }
  return ctx
}
