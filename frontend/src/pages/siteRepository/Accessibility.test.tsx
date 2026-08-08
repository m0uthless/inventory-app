import { fireEvent, screen } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CollapsibleSiteRow } from './CollapsibleSiteRow'
import { ProvinceSection } from './ProvinceSection'
import type { ProvinceGroup, SiteRow } from './types'

// ─── CollapsibleSiteRow ─────────────────────────────────────────────────────

function makeSite(): SiteRow {
  return {
    id: 1,
    name: 'Sede Centrale',
    display_name: 'Sede Centrale',
    city: 'Bologna',
    postal_code: '40100',
    primary_contact_name: null,
    primary_contact_email: null,
    primary_contact_phone: null,
    status: 1,
    status_label: 'Attivo',
    customer: 1,
  }
}

describe('CollapsibleSiteRow — accessibilità da tastiera (fix P2 8.3)', () => {
  it('si espande e si richiude con Invio/Spazio dalla tastiera', () => {
    render(
      <CollapsibleSiteRow
        site={makeSite()}
        allInventory={[]}
        searchQuery=""
        statusFilter="all"
        onOpenDrawer={vi.fn()}
        onOpenSite={vi.fn()}
        canViewSite={false}
        canChangeSite={false}
        onEditSite={vi.fn()}
        onSiteContextMenu={vi.fn()}
        onInventoryContextMenu={vi.fn()}
        isLast={false}
        rowIndex={0}
      />,
    )

    const header = screen.getAllByRole('button').find((b) => b.hasAttribute('aria-expanded'))
    if (!header) throw new Error('Header espandibile non trovato')
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(header).toHaveAttribute('tabIndex', '0')

    fireEvent.keyDown(header, { key: 'Enter' })
    expect(header).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(header, { key: ' ' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
  })

  it('il pulsante decorativo espandi/comprimi non è raggiungibile da tastiera (evita doppio tab stop)', () => {
    const { container } = render(
      <CollapsibleSiteRow
        site={makeSite()}
        allInventory={[]}
        searchQuery=""
        statusFilter="all"
        onOpenDrawer={vi.fn()}
        onOpenSite={vi.fn()}
        canViewSite={false}
        canChangeSite={false}
        onEditSite={vi.fn()}
        onSiteContextMenu={vi.fn()}
        onInventoryContextMenu={vi.fn()}
        isLast={false}
        rowIndex={0}
      />,
    )

    // getByRole('button') esclude correttamente gli elementi aria-hidden
    // dall'albero di accessibilità (è quello che vogliamo): qui verifichiamo
    // direttamente nel DOM che il pulsante decorativo abbia tabIndex=-1 e
    // aria-hidden, cioè che non intercetti il focus da tastiera.
    const decorative = container.querySelector('button[aria-hidden="true"]')
    expect(decorative).not.toBeNull()
    expect(decorative).toHaveAttribute('tabindex', '-1')
  })
})

// ─── ProvinceSection ────────────────────────────────────────────────────────

function makeProvinceGroup(): ProvinceGroup {
  return {
    province: 'BO',
    issueCount: 0,
    customers: [],
  }
}

describe('ProvinceSection — accessibilità da tastiera (fix P2 8.3)', () => {
  it('si espande con Invio e collega aria-controls al contenuto', () => {
    render(
      <ProvinceSection
        group={makeProvinceGroup()}
        searchQuery=""
        statusFilter="all"
        counts={{}}
        issueCounts={{}}
        onOpenDrawer={vi.fn()}
        onOpenVpn={vi.fn()}
        onOpenCustomer={vi.fn()}
        onOpenSite={vi.fn()}
        canViewCustomer={false}
        canViewSite={false}
        canChangeCustomer={false}
        onEditCustomer={vi.fn()}
        canChangeSite={false}
        onEditSite={vi.fn()}
        onCustomerContextMenu={vi.fn()}
        onSiteContextMenu={vi.fn()}
        onInventoryContextMenu={vi.fn()}
        refreshToken={0}
      />,
    )

    const header = screen.getByRole('button', { name: /BO/ })
    expect(header).toHaveAttribute('aria-expanded', 'false')

    const controlsId = header.getAttribute('aria-controls')
    expect(controlsId).toBeTruthy()

    fireEvent.keyDown(header, { key: 'Enter' })
    expect(header).toHaveAttribute('aria-expanded', 'true')

    // Il contenitore collegato via aria-controls deve esistere nel DOM una
    // volta espanso (Collapse smonta il contenuto quando chiuso).
    expect(document.getElementById(controlsId as string)).not.toBeNull()
  })
})
