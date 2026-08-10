import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './app'
import { createManualClock } from './core/clock'
import { SHIFT_MS } from './core/shift'
import { installRaf } from './test/harness'

/**
 * Rings up every item, whatever the basket happens to hold.
 */
const scanEverything = async (): Promise<void> => {
  const scan = screen.getByRole('button', { name: 'Scan item' })
  for (let n = 0; n < 12 && !(scan as HTMLButtonElement).disabled; n += 1) {
    await userEvent.click(scan)
  }
}

describe('App', () => {
  it('opens the store on shift 1', () => {
    installRaf()
    render(<App />)
    expect(screen.getByText('6/7')).toBeInTheDocument()
    expect(screen.getByText(/KONBINI · SHIFT 1/)).toBeInTheDocument()
    expect(screen.getByText('Ring up the items.')).toBeInTheDocument()
  })

  it('starts with the change button unavailable', () => {
    installRaf()
    render(<App />)
    expect(screen.getByRole('button', { name: 'Hand over change' })).toBeDisabled()
  })

  it('reveals the total only after everything is scanned', async () => {
    installRaf()
    render(<App />)
    expect(screen.queryByText('TOTAL')).not.toBeInTheDocument()
    await scanEverything()
    // Either the shelf or the till is now up; both mean scanning finished.
    // Which one depends on whether this customer wanted cigarettes, so assert
    // that one of the two appeared rather than branching on it.
    const onShelf = screen.queryByRole('heading', { name: /Cigarettes/i })
    const onTill = screen.queryByText('TOTAL')
    // Named so a failure says which surface was missing, not just "length 0".
    expect({ shelf: onShelf !== null, till: onTill !== null }).not.toStrictEqual({
      shelf: false,
      till: false,
    })
  })

  it('lets you count out change once the basket is rung up', async () => {
    installRaf()
    render(<App />)
    await scanEverything()
    if (screen.queryByRole('heading', { name: /Cigarettes/i }) !== null) {
      await userEvent.click(screen.getByLabelText('Slot 3'))
    }
    await userEvent.click(screen.getByLabelText('Give ¥100'))
    expect(screen.getByText('×1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hand over change' })).toBeEnabled()
  })

  it('advances to the next customer after handing change over', async () => {
    installRaf()
    render(<App />)
    await scanEverything()
    if (screen.queryByRole('heading', { name: /Cigarettes/i }) !== null) {
      await userEvent.click(screen.getByLabelText('Slot 3'))
    }
    await userEvent.click(screen.getByRole('button', { name: 'Hand over change' }))
    // Wrong change is still a completed sale; the queue moves on either way,
    // and the message becomes feedback on what just happened.
    expect(screen.getByText(/SERVED/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scan item' })).toBeEnabled()
    expect(screen.getByText(/Next|counted it|drawer is|too many/)).toBeInTheDocument()
  })

  it('shows no countdown anywhere while the shift runs', () => {
    const raf = installRaf()
    const clock = createManualClock()
    render(<App clock={clock} />)
    expect(raf.pending()).toBe(1)

    clock.advance(45_000)
    act(() => {
      raf.pump()
    })
    // The old "175s" readout is gone: nothing on screen counts down for you.
    expect(screen.queryByText(/^\d+s$/)).not.toBeInTheDocument()
    expect(screen.queryByText('TIME')).not.toBeInTheDocument()
  })

  it('reads the wall clock only when you look up at it', async () => {
    const raf = installRaf()
    const clock = createManualClock()
    render(<App clock={clock} />)

    // Face is blank until you turn your head — a clock on the wall is not in
    // your field of view while you are working the counter.
    expect(screen.queryByText('22:00')).not.toBeInTheDocument()

    clock.advance(45_000)
    act(() => {
      raf.pump()
    })
    await userEvent.click(screen.getByRole('button', { name: /Look at the clock/i }))

    // 45s of a 180s shift is a quarter of 22:00-23:00.
    expect(screen.getByText('22:15')).toBeInTheDocument()
    expect(screen.getByText(/off at 23:00/)).toBeInTheDocument()
    // And looking away costs you sight of the customer.
    expect(screen.getByText(/You’re looking away/)).toBeInTheDocument()

    // Turning back restores the counter and blanks the clock face again.
    await userEvent.click(screen.getByRole('button', { name: /Back to the counter/i }))
    expect(screen.queryByText('22:15')).not.toBeInTheDocument()
    expect(screen.queryByText(/You’re looking away/)).not.toBeInTheDocument()
  })

  it('shows the summary when the shift ends, and starts a new one', async () => {
    const raf = installRaf()
    const clock = createManualClock()
    render(<App clock={clock} />)

    // Run the shift clock out in one frame.
    clock.advance(SHIFT_MS)
    act(() => {
      raf.pump()
    })

    expect(screen.getByText('Shift over')).toBeInTheDocument()
    expect(screen.getByText('Served')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Another shift' }))
    expect(screen.getByText(/KONBINI · SHIFT 2/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scan item' })).toBeInTheDocument()
  })

  it('does not offer the lookup chart while the shelf is still labelled', () => {
    installRaf()
    render(<App />)
    // Shift 1 is the labelled tier, so no chart is on offer yet.
    expect(screen.queryByRole('button', { name: /Check the chart/ })).not.toBeInTheDocument()
  })

  it('takes a denomination back out of the tray', async () => {
    installRaf()
    render(<App />)
    await scanEverything()
    if (screen.queryByRole('heading', { name: /Cigarettes/i }) !== null) {
      await userEvent.click(screen.getByLabelText('Slot 3'))
    }
    await userEvent.click(screen.getByLabelText('Give ¥100'))
    expect(screen.getByLabelText('Give ¥100')).toHaveClass('has')

    await userEvent.click(screen.getByLabelText('Take back ¥100'))
    expect(screen.getByLabelText('Give ¥100')).not.toHaveClass('has')
  })

  it('offers the taxed lookup chart once the names have faded', async () => {
    const raf = installRaf()
    const clock = createManualClock()
    render(<App clock={clock} />)

    // Play through to a faded-tier shift (3+) by running each shift out.
    for (let shift = 1; shift < 3; shift += 1) {
      clock.advance(SHIFT_MS)
      act(() => {
        raf.pump()
      })
      await userEvent.click(screen.getByRole('button', { name: 'Another shift' }))
    }
    expect(screen.getByText(/KONBINI · SHIFT 3/)).toBeInTheDocument()

    // Reach a customer who actually wants cigarettes.
    let guard = 0
    while (screen.queryByRole('heading', { name: /Cigarettes/i }) === null && guard < 12) {
      await scanEverything()
      if (screen.queryByRole('heading', { name: /Cigarettes/i }) !== null) {
        break
      }
      await userEvent.click(screen.getByRole('button', { name: 'Hand over change' }))
      guard += 1
    }

    const chart = screen.getByRole('button', { name: /Check the chart/ })
    expect(chart).toBeEnabled()
    await userEvent.click(chart)
    // Using it costs score and locks the button while open.
    expect(screen.getByRole('button', { name: /Check the chart/ })).toBeDisabled()
  })
})
