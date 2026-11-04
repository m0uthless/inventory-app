import * as React from 'react'

/**
 * Le pagine migrate al restyle hanno una testata propria (titolo + azione
 * primaria): chiamano `useOwnPageHeader()` e la shell smette di mostrare il
 * titolo automatico. Le altre pagine ricevono il titolo dalla shell.
 */
type State = { hidden: boolean; setHidden: (v: boolean) => void }

const Ctx = React.createContext<State>({ hidden: false, setHidden: () => {} })

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = React.useState(false)
  const value = React.useMemo(() => ({ hidden, setHidden }), [hidden])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePageHeaderState() {
  return React.useContext(Ctx)
}

/** Da chiamare nelle pagine che disegnano la propria testata. */
// eslint-disable-next-line react-refresh/only-export-components
export function useOwnPageHeader() {
  const { setHidden } = React.useContext(Ctx)
  React.useLayoutEffect(() => {
    setHidden(true)
    return () => setHidden(false)
  }, [setHidden])
}
