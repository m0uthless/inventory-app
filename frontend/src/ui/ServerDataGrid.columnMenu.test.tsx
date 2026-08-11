import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GridColDef } from '@mui/x-data-grid'

import EntityListCard from '@shared/ui/EntityListCard'

type Row = { id: number; name: string; city: string; status: string }

const rows: Row[] = [
  { id: 1, name: 'Riga 1', city: 'Bologna', status: 'Attivo' },
  { id: 2, name: 'Riga 2', city: 'Milano', status: 'Inattivo' },
]

const columns: GridColDef<Row>[] = [
  { field: 'name', headerName: 'Nome', width: 150 },
  { field: 'city', headerName: 'Città', width: 150 },
  { field: 'status', headerName: 'Stato', width: 150 },
]

function renderGrid() {
  return render(
    <EntityListCard
      toolbar={{ q: '', onQChange: () => {} }}
      grid={{
        pageKey: 'test-columns-bug',
        username: 'tester',
        rows,
        columns,
        loading: false,
        rowCount: rows.length,
        paginationModel: { page: 0, pageSize: 25 },
        onPaginationModelChange: () => {},
        sortModel: [],
        onSortModelChange: () => {},
      }}
    />,
  )
}

// Apre il menu colonna (kebab "...") per l'header dato.
function openColumnMenu(headerName: string) {
  const menuButton = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${headerName} column menu"]`,
  )
  if (!menuButton) throw new Error(`Pulsante menu colonna "${headerName}" non trovato`)
  fireEvent.click(menuButton)
}

describe('ServerDataGrid — menu colonna (kebab)', () => {
  it('il pulsante kebab apre un menu con le voci Ordina/Nascondi/Gestisci colonne', () => {
    renderGrid()
    openColumnMenu('Nome')

    expect(screen.getByText('Nascondi colonna')).toBeInTheDocument()
    expect(screen.getByText('Gestisci colonne')).toBeInTheDocument()
  })

  it('"Nascondi colonna" rimuove effettivamente la colonna dalla griglia', () => {
    renderGrid()
    expect(screen.getByText('Città')).toBeInTheDocument()

    openColumnMenu('Città')
    fireEvent.click(screen.getByText('Nascondi colonna'))

    expect(screen.queryByText('Città')).not.toBeInTheDocument()
  })

  it('"Gestisci colonne" apre il pannello con la lista colonne e i toggle', () => {
    renderGrid()
    openColumnMenu('Nome')
    fireEvent.click(screen.getByText('Gestisci colonne'))

    expect(screen.getByText('Colonne')).toBeInTheDocument()
    // Le 3 colonne devono comparire nel pannello.
    expect(screen.getAllByText('Nome').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Città').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Stato').length).toBeGreaterThan(0)
  })

  it('il toggle nel pannello "Gestisci colonne" nasconde/mostra la colonna', () => {
    renderGrid()
    openColumnMenu('Nome')
    fireEvent.click(screen.getByText('Gestisci colonne'))

    const panelRow = screen
      .getAllByText('Stato')
      .map((el) => el.closest('div[draggable="true"]'))
      .find((el): el is HTMLElement => el !== null)
    if (!panelRow) throw new Error('Riga colonna "Stato" non trovata nel pannello')
    const toggle = within(panelRow).getByRole('switch')

    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    expect(toggle).not.toBeChecked()
  })
})

describe('ServerDataGrid — coerenza posizione "..." rispetto all\'etichetta', () => {
  it('riserva lo stesso spazio a destra del testo per tutte le colonne, con o senza filtro colonna', () => {
    render(
      <EntityListCard
        toolbar={{ q: '', onQChange: () => {} }}
        grid={{
          pageKey: 'test-columns-consistency',
          username: 'tester',
          rows,
          columns,
          loading: false,
          rowCount: rows.length,
          paginationModel: { page: 0, pageSize: 25 },
          onPaginationModelChange: () => {},
          sortModel: [],
          onSortModelChange: () => {},
          // Solo "Nome" ha un filtro colonna (imbuto) — prima questo faceva
          // sì che "Nome" riservasse più spazio (40px) di "Città"/"Stato"
          // (20px), quindi i "..." apparivano a distanza diversa dal testo
          // a seconda della colonna.
          filterConfig: {
            name: {
              value: '',
              label: 'Filtra per nome',
              onSet: () => {},
              onReset: () => {},
            },
          },
        }}
      />,
    )

    const labels = ['Nome', 'Città', 'Stato'].map((text) => {
      const span = screen.getByText(text)
      return span.style.paddingRight
    })

    expect(labels).toEqual(['40px', '40px', '40px'])
  })
})
