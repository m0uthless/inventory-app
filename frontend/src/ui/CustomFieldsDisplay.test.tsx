import { screen } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CustomFieldsDisplay from './CustomFieldsDisplay'

vi.mock('./toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../hooks/useCustomFieldDefinitions', () => ({
  useCustomFieldDefinitions: () => ({
    loading: false,
    defs: [
      { id: 1, entity: 'inventory', key: 'enabled', label: 'Abilitato', field_type: 'boolean', is_active: true },
      { id: 2, entity: 'inventory', key: 'tier', label: 'Tier', field_type: 'select', options: { gold: 'Gold label' }, is_active: true },
    ],
  }),
  normalizeKey: (s: string) => s.trim().toLowerCase(),
}))

describe('CustomFieldsDisplay', () => {
  it('renders booleans and mapped select labels in a user-friendly way', () => {
    render(<CustomFieldsDisplay entity="inventory" value={{ enabled: true, tier: 'gold' }} />)
    expect(screen.getByText('Abilitato')).toBeInTheDocument()
    expect(screen.getByText('Sì')).toBeInTheDocument()
    expect(screen.getByText('Gold label')).toBeInTheDocument()
  })
})
