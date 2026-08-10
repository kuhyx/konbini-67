import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CIGARETTES } from '../core/catalog'
import { Shelf } from './shelf'

describe('Shelf', () => {
  it('shows brand names while the shelf is labelled', () => {
    render(<Shelf mode="labelled" enabled lookupOpen={false} onPick={vi.fn()} />)
    expect(screen.getByText('Echo')).toBeInTheDocument()
  })

  it('still renders names when faded, so CSS can dim them', () => {
    const { container } = render(
      <Shelf mode="faded" enabled lookupOpen={false} onPick={vi.fn()} />,
    )
    expect(screen.getByText('Echo')).toBeInTheDocument()
    expect(container.querySelectorAll('.slot.faded').length).toBeGreaterThan(0)
  })

  it('gives you nothing but numbers when bare', () => {
    render(<Shelf mode="bare" enabled lookupOpen={false} onPick={vi.fn()} />)
    expect(screen.queryByText('Echo')).not.toBeInTheDocument()
    expect(screen.getByLabelText(`Slot ${String(CIGARETTES.echo.slot)}`)).toBeInTheDocument()
  })

  it('reports the slot that was picked', async () => {
    const onPick = vi.fn()
    render(<Shelf mode="bare" enabled lookupOpen={false} onPick={onPick} />)
    await userEvent.click(screen.getByLabelText(`Slot ${String(CIGARETTES.mevius.slot)}`))
    expect(onPick).toHaveBeenCalledWith(CIGARETTES.mevius.slot)
  })

  it('disables slots that hold no brand', () => {
    render(<Shelf mode="bare" enabled lookupOpen={false} onPick={vi.fn()} />)
    // Slot 1 is an empty gap in the catalogue.
    expect(screen.getByLabelText('Slot 1')).toBeDisabled()
  })

  it('hides the chart until it is opened', () => {
    render(<Shelf mode="faded" enabled lookupOpen={false} onPick={vi.fn()} />)
    expect(screen.queryByText(/47 ·/)).not.toBeInTheDocument()
  })

  it('lists every brand and slot once the chart is open', () => {
    render(<Shelf mode="bare" enabled lookupOpen onPick={vi.fn()} />)
    expect(screen.getByText(`${String(CIGARETTES.echo.slot)} · Echo`)).toBeInTheDocument()
  })

  it('is inert while disabled', () => {
    render(<Shelf mode="bare" enabled={false} lookupOpen={false} onPick={vi.fn()} />)
    expect(screen.getByLabelText(`Slot ${String(CIGARETTES.echo.slot)}`)).toBeDisabled()
  })
})
