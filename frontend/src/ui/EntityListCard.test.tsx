import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EntityListCard from '@shared/ui/EntityListCard'

function setup(below?: boolean) {
  render(
    <EntityListCard
      toolbar={{ compact: true, q: '', onQChange: () => {} }}
      belowToolbar={below ? <div data-testid="below">filtri</div> : undefined}
      grid={{
        rows: [], rowCount: 0, loading: false, columns: [],
        paginationModel: { page: 0, pageSize: 10 }, onPaginationModelChange: () => {},
        sortModel: [], onSortModelChange: () => {},
      } as never}
    />,
  )
}

describe('EntityListCard belowToolbar', () => {
  it('wraps the toolbar row and puts belowToolbar on its own full-width row', () => {
    setup(true)
    const container = screen.getByTestId('below').parentElement as HTMLElement
    expect(container).toHaveStyle({ flexBasis: '100%', width: '100%' })
    expect(container.parentElement).toHaveStyle({ flexWrap: 'wrap' })
  })

  it('does not wrap the toolbar row without belowToolbar', () => {
    setup(false)
    const toolbarRoot = screen.getByRole('textbox').closest('div[class*="MuiBox-root"]')!
    let el: HTMLElement | null = toolbarRoot as HTMLElement
    while (el) {
      expect(el).not.toHaveStyle({ flexWrap: 'wrap' })
      el = el.parentElement
    }
  })
})
