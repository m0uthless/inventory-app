import { screen, waitFor } from '@testing-library/dom'
import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatsMatrix } from './ServiceNowStats'

const periods = [{ key: 1, label: 'Gen' }, { key: 2, label: 'Feb' }]

const ebitTooltip = (s: { counts: number[]; type_totals?: Record<string, number> }) => {
  const total = s.counts.reduce((a, b) => a + b, 0)
  if (total === 0) return null
  const ebit = s.type_totals?.EBIT ?? 0
  return `Di cui EBIT: ${ebit}`
}

const ebitCellTooltip = (
  s: { counts: number[]; type_totals_by_period?: Record<string, number>[] },
  i: number,
) => {
  if (s.counts[i] === 0) return null
  const ebit = s.type_totals_by_period?.[i]?.EBIT ?? 0
  return `Di cui EBIT: ${ebit}`
}

/** Trova la cella giorno N (0-based, esclusa la colonna "Tecnico") della riga del tecnico. */
function getDayCell(container: HTMLElement, dayIndex: number, rowIndex = 0): HTMLElement {
  const row = container.querySelectorAll('tbody tr')[rowIndex] as HTMLElement
  const cells = row.querySelectorAll('td')
  return cells[1 + dayIndex] as HTMLElement // [0] = nome tecnico
}

/** Trova la cella "Totale" della RIGA del tecnico (non il footer): MuiTooltip
 * ora avvolge l'intero <td> (hitbox grande), non solo il numero al suo interno. */
function getRowTotalCell(container: HTMLElement, rowIndex = 0): HTMLElement {
  const row = container.querySelectorAll('tbody tr')[rowIndex] as HTMLElement
  const cells = row.querySelectorAll('td')
  return cells[cells.length - 1] as HTMLElement
}

describe('StatsMatrix — colonna Totale e tooltip "Di cui EBIT"', () => {
  it('mostra il tooltip sul totale anche quando EBIT è 0 (solo casi L1)', async () => {
    const series = [{ user_id: 1, name: 'Mario Rossi', counts: [2, 1], type_totals: { L1: 3 } }]
    const { container } = render(
      <StatsMatrix periods={periods} series={series} showRowTotal rowTotalTooltip={ebitTooltip} />,
    )

    fireEvent.mouseEnter(getRowTotalCell(container))

    await waitFor(() => {
      expect(screen.getByText('Di cui EBIT: 0')).toBeInTheDocument()
    })
  })

  it('mostra il conteggio EBIT corretto quando presente', async () => {
    const series = [{ user_id: 1, name: 'Mario Rossi', counts: [2, 1], type_totals: { L1: 2, EBIT: 1 } }]
    const { container } = render(
      <StatsMatrix periods={periods} series={series} showRowTotal rowTotalTooltip={ebitTooltip} />,
    )

    fireEvent.mouseEnter(getRowTotalCell(container))

    await waitFor(() => {
      expect(screen.getByText('Di cui EBIT: 1')).toBeInTheDocument()
    })
  })

  it('non mostra alcun tooltip quando il totale della riga è 0', () => {
    const series = [{ user_id: 1, name: 'Mario Rossi', counts: [0, 0], type_totals: {} }]
    const { container } = render(
      <StatsMatrix periods={periods} series={series} showRowTotal rowTotalTooltip={ebitTooltip} />,
    )

    fireEvent.mouseEnter(getRowTotalCell(container))
    expect(screen.queryByText(/Di cui EBIT/)).not.toBeInTheDocument()
  })

  it('senza showRowTotal non aggiunge la colonna Totale (header assente)', () => {
    const series = [{ user_id: 1, name: 'Mario Rossi', counts: [2, 1] }]
    const { container } = render(<StatsMatrix periods={periods} series={series} />)
    const headerCells = container.querySelectorAll('thead th')
    // Tecnico + Gen + Feb = 3 colonne, nessuna colonna Totale aggiuntiva
    expect(headerCells.length).toBe(3)
  })

  it('con showRowTotal aggiunge l\'header "Totale" in più rispetto al caso base', () => {
    const series = [{ user_id: 1, name: 'Mario Rossi', counts: [2, 1] }]
    const { container } = render(<StatsMatrix periods={periods} series={series} showRowTotal />)
    const headerCells = container.querySelectorAll('thead th')
    // Tecnico + Gen + Feb + Totale = 4 colonne
    expect(headerCells.length).toBe(4)
    expect(headerCells[3].textContent).toBe('Totale')
  })

  it('il tooltip scatta hoverando l\'intero <td>, non solo il numero (hitbox grande)', async () => {
    const series = [{ user_id: 1, name: 'Mario Rossi', counts: [2, 1], type_totals: { L1: 2, EBIT: 1 } }]
    const { container } = render(
      <StatsMatrix periods={periods} series={series} showRowTotal rowTotalTooltip={ebitTooltip} />,
    )
    const row = container.querySelectorAll('tbody tr')[0]
    const totalTd = row.querySelectorAll('td')[row.querySelectorAll('td').length - 1]
    // Il target dell'hover è il <td> stesso (l'elemento clonato da MuiTooltip),
    // non un div più piccolo annidato al suo interno.
    fireEvent.mouseEnter(totalTd)
    await waitFor(() => {
      expect(screen.getByText('Di cui EBIT: 1')).toBeInTheDocument()
    })
  })

  it('la colonna Totale resta visibile durante lo scroll orizzontale (sticky a destra)', () => {
    // Con molte colonne giorno (vista giornaliera) la tabella scorre in
    // orizzontale: se il Totale non è "sticky" a destra, per vederlo (e
    // poterlo hoverare) bisogna scrollare fino in fondo — facile non
    // accorgersene e pensare che il tooltip "non funzioni".
    const manyDays = Array.from({ length: 31 }, (_, i) => ({ key: i + 1, label: String(i + 1) }))
    const series = [{ user_id: 1, name: 'Mario Rossi', counts: Array(31).fill(1), type_totals: { L1: 31 } }]
    const { container } = render(
      <StatsMatrix periods={manyDays} series={series} showRowTotal rowTotalTooltip={ebitTooltip} />,
    )
    const headerTotal = container.querySelectorAll('thead th')[container.querySelectorAll('thead th').length - 1] as HTMLElement
    expect(headerTotal.textContent).toBe('Totale')
    expect(getComputedStyle(headerTotal).position).toBe('sticky')
    expect(getComputedStyle(headerTotal).right).toBe('0px')

    const row = container.querySelectorAll('tbody tr')[0]
    const rowTotalTd = row.querySelectorAll('td')[row.querySelectorAll('td').length - 1] as HTMLElement
    expect(getComputedStyle(rowTotalTd).position).toBe('sticky')
    expect(getComputedStyle(rowTotalTd).right).toBe('0px')
  })
})

describe('StatsMatrix — tooltip "Di cui EBIT" su ogni singola cella giorno', () => {
  it('mostra il tooltip sulla cella di un giorno con EBIT', async () => {
    const series = [{
      user_id: 1, name: 'Mario Rossi', counts: [3, 2],
      type_totals_by_period: [{ L1: 2, EBIT: 1 }, { L1: 2 }] as Record<string, number>[],
    }]
    const { container } = render(
      <StatsMatrix periods={periods} series={series} cellTooltip={ebitCellTooltip} />,
    )
    fireEvent.mouseEnter(getDayCell(container, 0)) // Gennaio: L1=2, EBIT=1
    await waitFor(() => {
      expect(screen.getByText('Di cui EBIT: 1')).toBeInTheDocument()
    })
  })

  it('mostra "Di cui EBIT: 0" su un giorno con soli case L1', async () => {
    const series = [{
      user_id: 1, name: 'Mario Rossi', counts: [3, 2],
      type_totals_by_period: [{ L1: 2, EBIT: 1 }, { L1: 2 }] as Record<string, number>[],
    }]
    const { container } = render(
      <StatsMatrix periods={periods} series={series} cellTooltip={ebitCellTooltip} />,
    )
    fireEvent.mouseEnter(getDayCell(container, 1)) // Febbraio: solo L1
    await waitFor(() => {
      expect(screen.getByText('Di cui EBIT: 0')).toBeInTheDocument()
    })
  })

  it('non mostra alcun tooltip su un giorno senza case (cella vuota)', () => {
    const series = [{
      user_id: 1, name: 'Mario Rossi', counts: [0, 2],
      type_totals_by_period: [{}, { L1: 2 }] as Record<string, number>[],
    }]
    const { container } = render(
      <StatsMatrix periods={periods} series={series} cellTooltip={ebitCellTooltip} />,
    )
    fireEvent.mouseEnter(getDayCell(container, 0))
    expect(screen.queryByText(/Di cui EBIT/)).not.toBeInTheDocument()
  })

  it('senza cellTooltip le celle giorno non hanno alcun tooltip (comportamento invariato)', () => {
    const series = [{ user_id: 1, name: 'Mario Rossi', counts: [3, 2] }]
    const { container } = render(<StatsMatrix periods={periods} series={series} />)
    fireEvent.mouseEnter(getDayCell(container, 0))
    expect(screen.queryByText(/Di cui EBIT/)).not.toBeInTheDocument()
  })
})
