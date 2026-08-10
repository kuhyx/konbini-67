import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ITEMS } from '../core/catalog'
import { FULL_SHELF, SHELF_CAPACITY, type Stock } from '../core/stock'

import { Stockroom } from './stockroom'

const low: Stock = { ...FULL_SHELF, beer: 0, pocky: 1 }

describe('Stockroom', () => {
  it('lists every crate', () => {
    render(<Stockroom stock={FULL_SHELF} enabled onRestock={vi.fn()} />)
    expect(screen.getByText(ITEMS.melonpan.label)).toBeInTheDocument()
    expect(screen.getByText(ITEMS.umbrella.label)).toBeInTheDocument()
  })

  it('puts what is nearly gone at the top', () => {
    // Under time pressure the question is "what is nearly gone", not "what
    // does the catalog contain".
    const { container } = render(<Stockroom stock={low} enabled onRestock={vi.fn()} />)
    const labels = [...container.querySelectorAll('.crate-label')].map((n) => n.textContent)
    expect(labels[0]).toBe(ITEMS.beer.label)
    expect(labels[1]).toBe(ITEMS.pocky.label)
  })

  it('marks an empty shelf as the thing that loses sales', () => {
    const { container } = render(<Stockroom stock={low} enabled onRestock={vi.fn()} />)
    expect(container.querySelectorAll('.crate.empty')).toHaveLength(1)
    expect(screen.getByText('out')).toBeInTheDocument()
  })

  it('shows how much is left of a partial shelf', () => {
    render(<Stockroom stock={low} enabled onRestock={vi.fn()} />)
    expect(screen.getByText(`1/${String(SHELF_CAPACITY)}`)).toBeInTheDocument()
  })

  it('reports which crate was put out', async () => {
    const onRestock = vi.fn()
    render(<Stockroom stock={low} enabled onRestock={onRestock} />)
    await userEvent.click(screen.getByText(ITEMS.beer.label))
    expect(onRestock).toHaveBeenCalledWith('beer')
  })

  it('will not let you refill a shelf that is already full', () => {
    const { container } = render(<Stockroom stock={FULL_SHELF} enabled onRestock={vi.fn()} />)
    const crates = [...container.querySelectorAll<HTMLButtonElement>('.crate')]
    expect(crates.every((crate) => crate.disabled)).toBe(true)
  })

  it('is inert while you cannot actually be out back', () => {
    // You cannot be in the stockroom and at the till at the same time.
    const { container } = render(
      <Stockroom stock={low} enabled={false} onRestock={vi.fn()} />,
    )
    const crates = [...container.querySelectorAll<HTMLButtonElement>('.crate')]
    expect(crates.every((crate) => crate.disabled)).toBe(true)
  })
})
