import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'

import IssueDialog from './IssueDialog'
import { THEME_REGISTRY } from '../../theme/themeRegistry'
import { createEmptyIssueForm, type IssueFormData, type UserOption } from './types'

const theme = THEME_REGISTRY.default.build('light')
// jsdom non implementa scrollIntoView (usato dall'elenco delle pillole).
Element.prototype.scrollIntoView = vi.fn()
const areas = [{ id: 4, label: 'Radiologia' }, { id: 5, label: 'Sistemi' }]
const users: UserOption[] = [
  { id: 1, label: 'Anna Radi', username: 'anna', is_issue_assignee: true, leave_area: 4 },
  { id: 2, label: 'Sara Sist', username: 'sara', is_issue_assignee: true, leave_area: 5 },
]

function Harness({ initial }: { initial: IssueFormData }) {
  const [form, setForm] = React.useState(initial)
  return (
    <ThemeProvider theme={theme}>
      <IssueDialog open editIssue={null} form={form} saving={false} errors={{}} customerInput="" customerOptions={[]} customerLoading={false}
        siteOptions={[]} categories={[]} users={users} areas={areas} onClose={vi.fn()} onSave={vi.fn()} onOpenLinkInventory={vi.fn()}
        onCustomerInputChange={vi.fn()} onFormChange={setForm} />
      <output data-testid="state">{JSON.stringify({ area: form.area_id, assignee: form.assigned_to_id })}</output>
    </ThemeProvider>
  )
}
const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}')

describe('IssueDialog · area', () => {
  it('la nuova issue parte con l\'area del profilo', () => {
    render(<Harness initial={createEmptyIssueForm(undefined, 4)} />)
    expect(state().area).toBe(4)
    expect(screen.getByText('Radiologia')).toBeInTheDocument()
  })

  it('cambiare area con un assegnatario fuori area lo svuota e avvisa', () => {
    render(<Harness initial={{ ...createEmptyIssueForm(1, 4) }} />)
    fireEvent.click(screen.getByText('Radiologia'))
    fireEvent.click(screen.getByRole('option', { name: 'Sistemi' }))
    expect(state()).toEqual({ area: 5, assignee: '' })
    expect(screen.getByText("L'assegnatario non fa parte della nuova area: scegline un altro.")).toBeInTheDocument()
  })

  it('l\'elenco degli assegnatari propone solo i membri dell\'area', () => {
    render(<Harness initial={createEmptyIssueForm(undefined, 4)} />)
    fireEvent.click(screen.getByText('Assegna'))
    expect(screen.getByRole('option', { name: /Anna Radi/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Sara Sist/ })).not.toBeInTheDocument()
  })
})
