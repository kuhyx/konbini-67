import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CIGARETTES } from '../core/catalog'
import { customerTotal, makeCustomer, tenderValue } from '../core/customer'
import { createRng } from '../core/rng'
import { shelfSpecForShift } from '../core/shelf'
import { requestLine } from '../core/speech'
import { formatYen } from '../core/money'
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
    render(<Counter customer={customer} showTotal={false} mood="patient" />)
    expect(screen.getByText(customer.name)).toBeInTheDocument()
    expect(screen.getByText(/Just these/)).toBeInTheDocument()
  })

  it('never lists what they are buying — that is on the counter', () => {
    const customer = withoutCigarettes()
    const { container } = render(<Counter customer={customer} showTotal={false} mood="patient" />)
    // Reading the basket off a panel would be looking at the wrong thing: the
    // shopping is physically in front of you.
    expect(container.querySelectorAll('.receipt')).toHaveLength(0)
    expect(screen.queryByText(/SCANNING/)).not.toBeInTheDocument()
  })

  it('keeps the register dark until everything is rung up', () => {
    const customer = withoutCigarettes()
    const { container } = render(<Counter customer={customer} showTotal={false} mood="patient" />)
    expect(container.querySelectorAll('.register')).toHaveLength(0)
  })

  it('shows the register total once everything is rung up', () => {
    const customer = withoutCigarettes()
    render(<Counter customer={customer} showTotal mood="patient" />)
    // A real register does total the basket for you — that part is not the
    // player's arithmetic, so it stays.
    expect(screen.getByText('REGISTER')).toBeInTheDocument()
    const total = formatYen(customerTotal(customer))
    expect(screen.getByText(total)).toBeInTheDocument()
  })

  it('never reveals what the customer handed over', () => {
    const customer = withoutCigarettes()
    render(<Counter customer={customer} showTotal mood="patient" />)
    // The money is on the counter; counting it is the player's job, so the
    // tendered amount must not appear anywhere — nor the change due.
    expect(screen.queryByText('TENDERED')).not.toBeInTheDocument()
    const tendered = formatYen(tenderValue(customer))
    expect(screen.queryByText(tendered)).not.toBeInTheDocument()
  })
})

describe('how the customer is taking it', () => {
  it('says nothing at all while they are still patient', () => {
    const { container } = render(
      <Counter customer={withoutCigarettes()} showTotal={false} mood="patient" />,
    )
    // A clerk reads a face; there is nothing to read yet.
    expect(container.querySelector('.tell')).toBeNull()
  })

  it('shows posture before anyone speaks', () => {
    render(<Counter customer={withoutCigarettes()} showTotal={false} mood="restless" />)
    expect(screen.getByText(/shifts their weight/)).toBeInTheDocument()
  })

  it('gives them a line once they actually mind', () => {
    render(<Counter customer={withoutCigarettes()} showTotal={false} mood="annoyed" />)
    expect(screen.getByText(/Sumimasen/)).toBeInTheDocument()
  })

  it('never renders a patience number', () => {
    const { container } = render(
      <Counter customer={withoutCigarettes()} showTotal={false} mood="annoyed" />,
    )
    // The whole design rule: no bar, no percentage, nothing that does the
    // reading for the player.
    expect(container.textContent).not.toContain('%')
  })
})
