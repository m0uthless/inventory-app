import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ContractReminders from './ContractReminders'
import type { ContractReminders as R } from './types'
import { THEME_REGISTRY } from '../../theme/themeRegistry'

const theme = THEME_REGISTRY.default.build('light')
const base: R = {
  every: 10, to: ['g@x.it'], cc: ['contratti@biotron.it'], seller_kind: 'manual',
  dates: [
    { date: '2026-11-01', state: 'sent', error: null },
    { date: '2026-11-11', state: 'failed', error: 'SMTP giù' },
    { date: '2026-11-21', state: 'next', error: null },
    { date: '2026-12-01', state: 'planned', error: null },
  ],
}
const show = (r: Partial<R> = {}, seller = 'Giulia Neri') => render(<ThemeProvider theme={theme}><ContractReminders reminders={{ ...base, ...r }} sellerName={seller} active /></ThemeProvider>)

describe('ContractReminders', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-20T10:00:00')) })
  afterEach(() => { vi.useRealTimers() })

  it('dice a chi vanno: venditore inserito a mano e ufficio', () => {
    show()
    expect(screen.getByText('Venditore inserito a mano: solo email')).toBeInTheDocument()
    expect(screen.getByText(/contratti@biotron\.it/)).toBeInTheDocument()
  })

  it('venditore utente Archie: email e campanella', () => {
    show({ seller_kind: 'user' })
    expect(screen.getByText('Venditore, utente Archie: email e campanella')).toBeInTheDocument()
  })

  it('senza venditore va tutto all\'ufficio', () => {
    show({ seller_kind: null, to: ['contratti@biotron.it'], cc: [] }, '')
    expect(screen.getByText('Nessun venditore')).toBeInTheDocument()
    expect(screen.getByText("Il promemoria va solo all'ufficio")).toBeInTheDocument()
  })

  it('elenca inviati, non riusciti, prossimo e previsti', () => {
    show()
    expect(screen.getByText('Inviato')).toBeInTheDocument()
    expect(screen.getByText('Non riuscito: SMTP giù')).toBeInTheDocument()
    expect(screen.getByText('Prossimo · domani')).toBeInTheDocument()
    expect(screen.getByText('Previsto')).toBeInTheDocument()
  })

  it('ripiega i molti già inviati', () => {
    const dates = Array.from({ length: 8 }, (_, i) => ({ date: `2026-0${(i % 9) + 1}-01`, state: 'sent' as const, error: null }))
    show({ dates: [...dates, { date: '2026-11-21', state: 'next', error: null }] })
    expect(screen.getByText('… altri 6 inviati')).toBeInTheDocument()
  })

  it('senza indirizzi: avvisa che non parte nulla', () => {
    show({ seller_kind: null, to: [], cc: [] }, '')
    expect(screen.getByText(/Nessun destinatario/)).toBeInTheDocument()
  })
})
