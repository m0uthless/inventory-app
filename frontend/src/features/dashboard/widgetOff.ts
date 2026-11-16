import * as React from 'react'

/** Il widget appartiene a un modulo spento (lo vede solo il superuser): la cornice mostra «spento». */
export const WidgetOffContext = React.createContext(false)

export const useWidgetOff = () => React.useContext(WidgetOffContext)
