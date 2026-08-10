import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_TALLY } from '../core/types'
import { reconcile } from '../core/reconcile'
import { ShiftOver } from './shift-over'

/**
 * A till that cashed up correctly, which is the uninteresting case for most
 * of these tests — the books themselves are covered in books.test.tsx.
 */
const BALANCED = reconcile(0, 0)

describe('ShiftOver', () => {
  it('grades an unworked shift as D', () => {
    render(<ShiftOver tally={EMPTY_TALLY} books={BALANCED} onRestart={vi.fn()} />)
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('grades a strong shift as S', () => {
    render(
      <ShiftOver tally={{ ...EMPTY_TALLY, served: 10, score: 1500 }} books={BALANCED} onRestart={vi.fn()} />,
    )
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
        books={reconcile(-120, -120)}
        onRestart={vi.fn()}
      />,
    )
    expect(screen.getByText('Served')).toBeInTheDocument()
    expect(screen.getByText('Lookups used')).toBeInTheDocument()
    // "Drawer off by" now comes from the cash-up, not the running tally.
    expect(screen.getAllByText('-¥120')).not.toHaveLength(0)
    expect(screen.getByText('Balanced')).toBeInTheDocument()
  })

  it('says how far the books were out when the count was wrong', () => {
    render(
      <ShiftOver tally={EMPTY_TALLY} books={reconcile(0, -50)} onRestart={vi.fn()} />,
    )
    expect(screen.getByText(/Out by/)).toBeInTheDocument()
  })

  it('starts another shift on request', async () => {
    const onRestart = vi.fn()
    render(<ShiftOver tally={EMPTY_TALLY} books={BALANCED} onRestart={onRestart} />)
    await userEvent.click(screen.getByRole('button', { name: 'Another shift' }))
    expect(onRestart).toHaveBeenCalledTimes(1)
  })
})
