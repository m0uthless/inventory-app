import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { THEME_REGISTRY } from '../../theme/themeRegistry'
import { ModuleWidget } from './ModuleWidget'
import WidgetShell from './widgets/WidgetShell'

const theme = THEME_REGISTRY.default.build('light')
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ me: { is_superuser: true, disabled_modules: ['issues'] } }) }))

const show = (key: string) => render(
  <ThemeProvider theme={theme}><MemoryRouter>
    <ModuleWidget widgetKey={key}><WidgetShell tone="verde" title="Titolo">corpo</WidgetShell></ModuleWidget>
  </MemoryRouter></ThemeProvider>,
)

describe('ModuleWidget', () => {
  it('segnala «spento» sul widget di un modulo spento', () => {
    show('issues')
    expect(screen.getByText('spento')).toBeInTheDocument()
  })

  it('niente etichetta per gli altri widget', () => {
    show('announcements')
    expect(screen.queryByText('spento')).not.toBeInTheDocument()
  })
})
