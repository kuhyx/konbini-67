import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { addDenom, DENOMS, OPENING_FLOAT, purseValue } from '../core/money'
import { Books } from './books'

describe('Books', () => {
  it('lays the drawer out for counting', () => {
    render(
      <Books drawer={OPENING_FLOAT} openingFloat={OPENING_FLOAT} takings={0} onSettle={vi.fn()} />,
    )
    // Every denomination is laid out with its count, for counting by hand.
    expect(screen.getByText('¥1,000')).toBeInTheDocument()
    expect(screen.getByText('¥1')).toBeInTheDocument()
    expect(screen.getAllByText(/^×\d+$/)).toHaveLength(DENOMS.length)
  })

  it('never shows the answer', () => {
    // The whole point: you work the difference out yourself.
    const heavy = addDenom(OPENING_FLOAT, 100)
    render(<Books drawer={heavy} openingFloat={OPENING_FLOAT} takings={0} onSettle={vi.fn()} />)
    expect(screen.queryByText('¥100 over')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Declared discrepancy in yen')).toHaveValue('')
  })

  it('will not close the books until you declare something', () => {
    render(
      <Books drawer={OPENING_FLOAT} openingFloat={OPENING_FLOAT} takings={0} onSettle={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /Close the books/i })).toBeDisabled()
  })

  it('reports a correct declaration', async () => {
    const onSettle = vi.fn()
    const heavy = addDenom(OPENING_FLOAT, 100)
    render(<Books drawer={heavy} openingFloat={OPENING_FLOAT} takings={0} onSettle={onSettle} />)
    await userEvent.type(screen.getByLabelText('Declared discrepancy in yen'), '100')
    await userEvent.click(screen.getByRole('button', { name: /Close the books/i }))
    expect(onSettle).toHaveBeenCalledWith(100, 100)
  })

  it('accepts a negative declaration for a light till', async () => {
    const onSettle = vi.fn()
    render(
      <Books
        drawer={OPENING_FLOAT}
        openingFloat={OPENING_FLOAT}
        takings={500}
        onSettle={onSettle}
      />,
    )
    await userEvent.type(screen.getByLabelText('Declared discrepancy in yen'), '-500')
    await userEvent.click(screen.getByRole('button', { name: /Close the books/i }))
    expect(onSettle).toHaveBeenCalledWith(-500, -500)
  })

  it('reports a wrong declaration as given, not corrected', async () => {
    const onSettle = vi.fn()
    const heavy = addDenom(OPENING_FLOAT, 100)
    render(<Books drawer={heavy} openingFloat={OPENING_FLOAT} takings={0} onSettle={onSettle} />)
    await userEvent.type(screen.getByLabelText('Declared discrepancy in yen'), '0')
    await userEvent.click(screen.getByRole('button', { name: /Close the books/i }))
    expect(onSettle).toHaveBeenCalledWith(0, 100)
  })

  it('stays disabled on input that is not a number', async () => {
    render(
      <Books drawer={OPENING_FLOAT} openingFloat={OPENING_FLOAT} takings={0} onSettle={vi.fn()} />,
    )
    await userEvent.type(screen.getByLabelText('Declared discrepancy in yen'), 'abc')
    expect(screen.getByRole('button', { name: /Close the books/i })).toBeDisabled()
  })

  it('tells you the float and the takings, since a clerk would know both', () => {
    render(
      <Books
        drawer={OPENING_FLOAT}
        openingFloat={OPENING_FLOAT}
        takings={4200}
        onSettle={vi.fn()}
      />,
    )
    expect(screen.getByText(/¥4,200/)).toBeInTheDocument()
    const floatDigits = String(purseValue(OPENING_FLOAT)).slice(0, 2)
    expect(screen.getByText(new RegExp(floatDigits))).toBeInTheDocument()
  })
})
