import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CIGARETTES } from '../core/catalog'
import { makeCustomer } from '../core/customer'
import { createRng } from '../core/rng'
import { shelfSpecForShift } from '../core/shelf'
import { requestLine } from '../core/speech'
import type { Customer } from '../core/types'
import { Counter } from './counter'

const shelf = shelfSpecForShift(1)

const withCigarettes = (): Customer => {
  let seed = 1
  let customer = makeCustomer(createRng(seed), 1, shelf)
  while (customer.cigarette === undefined) {
    seed += 1
    customer = makeCustomer(createRng(seed), 1, shelf)
  }
  return customer
}

const withoutCigarettes = (): Customer => {
  let seed = 1
  let customer = makeCustomer(createRng(seed), 1, shelf)
  while (customer.cigarette !== undefined) {
    seed += 1
    customer = makeCustomer(createRng(seed), 1, shelf)
  }
  return customer
}

describe('requestLine', () => {
  it('says nothing extra without cigarettes', () => {
    expect(requestLine(withoutCigarettes())).toBe('Just these, thanks.')
  })

  it('asks by number when that is the form', () => {
    const customer = withCigarettes()
    const line = requestLine({
      ...customer,
      cigarette: { cigarette: 'echo', form: 'by-number' },
    })
    expect(line).toContain(String(CIGARETTES.echo.slot))
  })

  it('asks by brand when that is the form', () => {
    const customer = withCigarettes()
    const line = requestLine({
      ...customer,
      cigarette: { cigarette: 'echo', form: 'by-brand' },
    })
    expect(line).toContain('Echo')
  })
})

describe('Counter', () => {
  it('shows the customer and what they said', () => {
    const customer = withoutCigarettes()
    render(<Counter customer={customer} scanned={0} showTotal={false} />)
    expect(screen.getByText(customer.name)).toBeInTheDocument()
    expect(screen.getByText(/Just these/)).toBeInTheDocument()
  })

  it('hides prices until an item is rung up', () => {
    const customer = withoutCigarettes()
    render(<Counter customer={customer} scanned={0} showTotal={false} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getByText(/SCANNING/)).toBeInTheDocument()
  })

  it('reveals a price once the item is scanned', () => {
    const customer = withoutCigarettes()
    const { container } = render(
      <Counter customer={customer} scanned={1} showTotal={false} />,
    )
    expect(container.querySelectorAll('.rung')).toHaveLength(1)
  })

  it('shows the total and tender only once everything is rung up', () => {
    const customer = withoutCigarettes()
    render(<Counter customer={customer} scanned={99} showTotal />)
    expect(screen.getByText('TOTAL')).toBeInTheDocument()
    expect(screen.getByText('TENDERED')).toBeInTheDocument()
    // The whole premise: the game never shows the change due.
    expect(screen.getByText(/Work out the change yourself/)).toBeInTheDocument()
  })
})
