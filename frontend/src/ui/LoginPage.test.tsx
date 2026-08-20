import { fireEvent, screen } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage, type AmbitoConfig } from '@shared/ui/LoginPage'

const AMBITI: AmbitoConfig[] = [
  { value: 'archie', label: 'Archie', color: '#0f766e', colorHover: '#0d5f58', colorLight: 'rgba(15,118,110,0.15)' },
  { value: 'portal', label: 'Portale Clienti', color: '#1A6BB5', colorHover: '#155a99', colorLight: 'rgba(26,107,181,0.15)' },
]

describe('LoginPage accessibility (fix audit 2026-07)', () => {
  it('associates visible labels with their inputs via htmlFor/id', () => {
    render(<LoginPage ambiti={AMBITI} onLogin={vi.fn()} />)

    // getByLabelText fallisce se label e input non sono associati via
    // htmlFor/id (o aria-labelledby): prima del fix erano semplici
    // Typography senza alcun legame semantico.
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('renders the ambito selector as real, keyboard-focusable buttons', () => {
    render(<LoginPage ambiti={AMBITI} onLogin={vi.fn()} />)

    const archieBtn = screen.getByRole('button', { name: 'Archie' })
    const portalBtn = screen.getByRole('button', { name: 'Portale Clienti' })
    expect(archieBtn).toBeInTheDocument()
    expect(portalBtn).toBeInTheDocument()

    // Il primo ambito passato è selezionato di default.
    expect(archieBtn).toHaveAttribute('aria-pressed', 'true')
    expect(portalBtn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(portalBtn)
    expect(portalBtn).toHaveAttribute('aria-pressed', 'true')
    expect(archieBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('show/hide password uses a real button with a dynamic accessible name', () => {
    render(<LoginPage ambiti={AMBITI} onLogin={vi.fn()} />)

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    const toggleBtn = screen.getByRole('button', { name: 'Mostra password' })
    fireEvent.click(toggleBtn)

    expect(passwordInput.type).toBe('text')
    expect(screen.getByRole('button', { name: 'Nascondi password' })).toBeInTheDocument()
  })

  it('submits credentials with the selected ambito on Enter', () => {
    const onLogin = vi.fn().mockResolvedValue(undefined)
    render(<LoginPage ambiti={AMBITI} onLogin={onLogin} />)

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'mario.rossi' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Portale Clienti' }))
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Enter' })

    expect(onLogin).toHaveBeenCalledWith('mario.rossi', 'secret123', 'portal')
  })
})
