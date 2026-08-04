import { describe, expect, it } from 'vitest'
import { buildPhilipsAssignmentCopyText } from './PhilipsAssignmentCopyDialog'

describe('buildPhilipsAssignmentCopyText', () => {
  it('compone il formato standard "@Persona - Numero - Account - Descrizione"', () => {
    const text = buildPhilipsAssignmentCopyText({
      assignedToLabel: 'Mario Rossi',
      number: 'CS0628228',
      account: 'ACME Hospital',
      shortDescription: 'Server down',
      caseTypeLabel: 'L1',
    })
    expect(text).toBe('@Mario Rossi - CS0628228 - ACME Hospital - Server down')
  })

  it('usa "Non assegnato" quando manca la persona assegnata', () => {
    const text = buildPhilipsAssignmentCopyText({
      assignedToLabel: null,
      number: 'CS0628228',
      account: 'ACME Hospital',
      shortDescription: 'Server down',
      caseTypeLabel: 'L1',
    })
    expect(text).toBe('@Non assegnato - CS0628228 - ACME Hospital - Server down')
  })

  it('usa un segnaposto quando manca la descrizione breve', () => {
    const text = buildPhilipsAssignmentCopyText({
      assignedToLabel: 'Mario Rossi',
      number: 'CS0628228',
      account: 'ACME Hospital',
      shortDescription: '',
      caseTypeLabel: 'L1',
    })
    expect(text).toBe('@Mario Rossi - CS0628228 - ACME Hospital - (nessuna descrizione)')
  })

  it('per il Type EBIT usa il formato dedicato "@Persona - Numero - EBIT", senza account/descrizione', () => {
    const text = buildPhilipsAssignmentCopyText({
      assignedToLabel: 'Mario Rossi',
      number: 'CS0628228',
      account: 'ACME Hospital', // volutamente diverso da "EBIT": il match è sul Type, non sull'Account
      shortDescription: 'Server down',
      caseTypeLabel: 'EBIT',
    })
    expect(text).toBe('@Mario Rossi - CS0628228 - EBIT')
  })

  it('riconosce il Type EBIT indipendentemente da maiuscole/minuscole e spazi', () => {
    const text = buildPhilipsAssignmentCopyText({
      assignedToLabel: 'Mario Rossi',
      number: 'CS0628228',
      account: 'ACME Hospital',
      shortDescription: 'Server down',
      caseTypeLabel: '  ebit  ',
    })
    expect(text).toBe('@Mario Rossi - CS0628228 - EBIT')
  })

  it('un Account chiamato "EBIT" NON attiva il formato dedicato se il Type è diverso (regressione del bug segnalato)', () => {
    const text = buildPhilipsAssignmentCopyText({
      assignedToLabel: 'Mario Rossi',
      number: 'CS0628228',
      account: 'EBIT',
      shortDescription: 'Server down',
      caseTypeLabel: 'L1',
    })
    expect(text).toBe('@Mario Rossi - CS0628228 - EBIT - Server down')
  })
})
