import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { addDenom, EMPTY_PURSE, OPENING_FLOAT } from '../core/money'
import { Till } from './till'

describe('Till', () => {
  it('offers every denomination the drawer actually holds', () => {
    render(<Till tray={EMPTY_PURSE} drawer={OPENING_FLOAT} enabled onGive={vi.fn()} onTakeBack={vi.fn()} />)
    expect(screen.getByLabelText('Give ¥1')).toBeInTheDocument()
    expect(screen.getByLabelText('Give ¥1,000')).toBeInTheDocument()
  })

  it('will not let you hand over what the drawer is out of', () => {
    // The opening float carries no ¥10,000 notes, so that key is dead.
    render(<Till tray={EMPTY_PURSE} drawer={OPENING_FLOAT} enabled onGive={vi.fn()} onTakeBack={vi.fn()} />)
    const empty = screen.getByLabelText('¥10,000 — none left')
    expect(empty).toBeDisabled()
    expect(screen.queryByLabelText('Give ¥10,000')).not.toBeInTheDocument()
  })

  it('hands a denomination over when clicked', async () => {
    const onGive = vi.fn()
    render(<Till tray={EMPTY_PURSE} drawer={OPENING_FLOAT} enabled onGive={onGive} onTakeBack={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('Give ¥100'))
    expect(onGive).toHaveBeenCalledWith(100)
  })

  it('shows how many of each denomination are in hand', () => {
    render(
      <Till tray={addDenom(EMPTY_PURSE, 500)} drawer={OPENING_FLOAT} enabled onGive={vi.fn()} onTakeBack={vi.fn()} />,
    )
    expect(screen.getByText('×1')).toBeInTheDocument()
    expect(screen.getByLabelText('Give ¥500')).toHaveClass('has')
  })

  it('only offers take-back for denominations actually held', () => {
    const { rerender } = render(
      <Till tray={EMPTY_PURSE} drawer={OPENING_FLOAT} enabled onGive={vi.fn()} onTakeBack={vi.fn()} />,
    )
    expect(screen.queryByLabelText('Take back ¥500')).not.toBeInTheDocument()
    rerender(
      <Till tray={addDenom(EMPTY_PURSE, 500)} drawer={OPENING_FLOAT} enabled onGive={vi.fn()} onTakeBack={vi.fn()} />,
    )
    expect(screen.getByLabelText('Take back ¥500')).toBeInTheDocument()
  })

  it('takes a denomination back when asked', async () => {
    const onTakeBack = vi.fn()
    render(
      <Till tray={addDenom(EMPTY_PURSE, 50)} drawer={OPENING_FLOAT} enabled onGive={vi.fn()} onTakeBack={onTakeBack} />,
    )
    await userEvent.click(screen.getByLabelText('Take back ¥50'))
    expect(onTakeBack).toHaveBeenCalledWith(50)
  })

  it('never totals up what you are holding', () => {
    const tray = addDenom(addDenom(EMPTY_PURSE, 500), 100)
    render(<Till tray={tray} drawer={OPENING_FLOAT} enabled onGive={vi.fn()} onTakeBack={vi.fn()} />)
    // No running value and no piece count: you count your own handful, the
    // same way you would standing at a till.
    expect(screen.queryByText('IN HAND')).not.toBeInTheDocument()
    expect(screen.queryByText('¥600')).not.toBeInTheDocument()
    expect(screen.queryByText(/coin\(s\)\/note\(s\)/)).not.toBeInTheDocument()
    expect(screen.getByText(/nothing here adds it up for you/)).toBeInTheDocument()
  })

  it('is inert while disabled', () => {
    render(<Till tray={EMPTY_PURSE} drawer={OPENING_FLOAT} enabled={false} onGive={vi.fn()} onTakeBack={vi.fn()} />)
    expect(screen.getByLabelText('Give ¥100')).toBeDisabled()
  })
})
