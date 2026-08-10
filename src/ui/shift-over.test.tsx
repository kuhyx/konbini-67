import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_TALLY } from '../core/types'
import { ShiftOver } from './shift-over'

describe('ShiftOver', () => {
  it('grades an unworked shift as D', () => {
    render(<ShiftOver tally={EMPTY_TALLY} onRestart={vi.fn()} />)
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('grades a strong shift as S', () => {
    render(
      <ShiftOver tally={{ ...EMPTY_TALLY, served: 10, score: 1500 }} onRestart={vi.fn()} />,
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
        onRestart={vi.fn()}
      />,
    )
    expect(screen.getByText('Served')).toBeInTheDocument()
    expect(screen.getByText('Lookups used')).toBeInTheDocument()
    expect(screen.getByText('-¥120')).toBeInTheDocument()
  })

  it('starts another shift on request', async () => {
    const onRestart = vi.fn()
    render(<ShiftOver tally={EMPTY_TALLY} onRestart={onRestart} />)
    await userEvent.click(screen.getByRole('button', { name: 'Another shift' }))
    expect(onRestart).toHaveBeenCalledTimes(1)
  })
})
