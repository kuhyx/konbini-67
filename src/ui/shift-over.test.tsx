import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_TALLY } from '../core/types'
import { ShiftOver } from './shift-over'

/**
 * The whole text of the summary row carrying `label`, so a row is asserted as
 * a label-value pair rather than as a bare number that any field could own.
 */
const rowFor = (label: string): string => screen.getByText(label).parentElement?.textContent ?? ''

describe('ShiftOver', () => {
  it('grades an unworked shift as D', () => {
    render(<ShiftOver tally={EMPTY_TALLY} onRestart={vi.fn()} />)
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('grades a strong shift as S', () => {
    render(<ShiftOver tally={{ ...EMPTY_TALLY, served: 10, score: 1500 }} onRestart={vi.fn()} />)
    expect(screen.getByText('S')).toBeInTheDocument()
  })

  it('breaks down what happened', () => {
    render(
      <ShiftOver
        tally={{
          ...EMPTY_TALLY,
          served: 8,
          exactChange: 6,
          wrongChange: 2,
          wrongBrand: 1,
          lookupsUsed: 3,
          drawerDelta: -120,
          score: 400,
        }}
        onRestart={vi.fn()}
      />,
    )
    expect(screen.getByText('Served')).toBeInTheDocument()
    expect(screen.getByText('Lookups used')).toBeInTheDocument()
    expect(screen.getByText('-¥120')).toBeInTheDocument()
  })

  it('counts the prices you said wrong and nobody queried', () => {
    // The quiet mistakes: they cost the shop money and never announced
    // themselves at the counter, so this is where you meet them.
    render(<ShiftOver tally={{ ...EMPTY_TALLY, served: 5, misquoted: 2 }} onRestart={vi.fn()} />)
    expect(screen.getByText('Wrong price said')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows the housekeeping the shift was actually about', () => {
    // These six were tallied but never displayed, which made the features
    // that produce them invisible: a walkout you are not told about teaches
    // nothing. Each row is checked against its own label rather than by
    // looking up a bare number, so two fields cannot quietly swap places.
    render(
      <ShiftOver
        tally={{
          ...EMPTY_TALLY,
          served: 9,
          walkedOut: 2,
          lostSales: 3,
          restocked: 4,
          cleaned: 5,
          hotSold: 6,
          binned: 7,
        }}
        onRestart={vi.fn()}
      />,
    )
    expect(rowFor('Walked out')).toBe('Walked out2')
    expect(rowFor('Sales lost to empty shelves')).toBe('Sales lost to empty shelves3')
    expect(rowFor('Restocked')).toBe('Restocked4')
    expect(rowFor('Cleaned up')).toBe('Cleaned up5')
    expect(rowFor('Hot food sold')).toBe('Hot food sold6')
    expect(rowFor('Thrown away')).toBe('Thrown away7')
  })

  it('starts another shift on request', async () => {
    const onRestart = vi.fn()
    render(<ShiftOver tally={EMPTY_TALLY} onRestart={onRestart} />)
    await userEvent.click(screen.getByRole('button', { name: 'Another shift' }))
    expect(onRestart).toHaveBeenCalledTimes(1)
  })
})
