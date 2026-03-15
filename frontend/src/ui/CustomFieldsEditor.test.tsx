import { fireEvent, screen } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CustomFieldsEditor from './CustomFieldsEditor'

vi.mock('../hooks/useCustomFieldDefinitions', () => ({
  useCustomFieldDefinitions: () => ({
    loading: false,
    defs: [
      { id: 1, entity: 'inventory', key: 'visit_count', label: 'Visite', field_type: 'number', required: false, is_active: true },
    ],
  }),
  getCustomFieldValue: (value: Record<string, unknown> | null | undefined, def: { key: string }) => value?.[def.key],
  setCustomFieldValue: (prev: Record<string, unknown> | null | undefined, def: { key: string }, nextVal: unknown) => ({ ...(prev ?? {}), [def.key]: nextVal }),
}))

describe('CustomFieldsEditor', () => {
  it('shows field errors and clears them on change', () => {
    const onChange = vi.fn()
    const onClearFieldError = vi.fn()

    render(
      <CustomFieldsEditor
        entity="inventory"
        value={{ visit_count: 1 }}
        onChange={onChange}
        errors={{ visit_count: 'Numero non valido.' }}
        onClearFieldError={onClearFieldError}
      />,
    )

    expect(screen.getByText('Numero non valido.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Visite'), { target: { value: '2' } })
    expect(onChange).toHaveBeenCalled()
    expect(onClearFieldError).toHaveBeenCalledWith('visit_count')
  })
})
