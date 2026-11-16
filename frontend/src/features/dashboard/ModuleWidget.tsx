import * as React from 'react'

import { WIDGET_MODULE } from '../../modules/moduleRegistry'
import { useModules } from '../../modules/useModules'
import { WidgetOffContext } from './widgetOff'

/** Avvolge un widget della Dashboard: se il suo modulo è spento, la cornice lo segnala. */
export function ModuleWidget({ widgetKey, children }: { widgetKey: string; children: React.ReactNode }) {
  const { isOff } = useModules()
  return <WidgetOffContext.Provider value={isOff(WIDGET_MODULE[widgetKey])}>{children}</WidgetOffContext.Provider>
}
