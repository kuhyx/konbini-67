import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './app'
import { createManualClock } from './core/clock'
import { SHIFT_MS } from './core/shift'
import { EMPTY_PURSE, type Purse } from './core/money'
import { installRaf } from './test/harness'
import { looseGoods, scanEverything, announceTotal, ringUpAndAnnounce } from './test/app-drivers'

describe('App', () => {
  it('offers a way out when the till cannot make the change', async () => {
    installRaf()
    // A drawer of nothing but big notes: no combination makes the change.
    const bigNotesOnly: Purse = { ...EMPTY_PURSE, 10_000: 2, 5000: 2, 1000: 2 }
    render(<App float={bigNotesOnly} />)

    // Nothing on offer while you are still ringing up.
    expect(screen.queryByRole('button', { name: /Anything smaller/i })).not.toBeInTheDocument()

    await ringUpAndAnnounce()

    expect(screen.getByText(/till cannot make this change/i)).toBeInTheDocument()
    for (const label of [/Anything smaller/i, /Suggest card/i, /Owe them/i, /Ask the manager/i]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('refills the drawer when you go and ask the manager', async () => {
    installRaf()
    const bigNotesOnly: Purse = { ...EMPTY_PURSE, 10_000: 2, 5000: 2, 1000: 2 }
    render(<App float={bigNotesOnly} />)
    await ringUpAndAnnounce()

    await userEvent.click(screen.getByRole('button', { name: /Ask the manager/i }))
    // Small change is back, so the warning clears and the sale can proceed.
    expect(screen.queryByText(/till cannot make this change/i)).not.toBeInTheDocument()
    expect(screen.getByText(/That is better/)).toBeInTheDocument()
  })

  it('asks for ID on a restricted basket and shows what they produce', async () => {
    installRaf()
    render(<App />)
    // Shift 1 seed 1 opens on a customer who wants cigarettes.
    const ask = screen.getByRole('button', { name: /Ask for ID/i })
    await userEvent.click(ask)
    // The card is described, never adjudicated.
    expect(screen.getByText(/card says|not got it|expired/i)).toBeInTheDocument()
    // And it is not on offer twice for the same customer.
    expect(screen.queryByRole('button', { name: /Ask for ID/i })).not.toBeInTheDocument()
  })

  it('lets you turn a sale down and moves on to the next customer', async () => {
    installRaf()
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /Refuse the sale/i }))
    expect(screen.getByText(/leave without their shopping|mutter, and go/)).toBeInTheDocument()
    expect(looseGoods()).toBeGreaterThan(0)
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
    expect(looseGoods()).toBeGreaterThan(0)
  })

  it('does not offer the lookup chart while the shelf is still labelled', () => {
    installRaf()
    render(<App />)
    // Shift 1 is the labelled tier, so no chart is on offer yet.
    expect(screen.queryByRole('button', { name: /Check the chart/ })).not.toBeInTheDocument()
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
    while (screen.queryByRole('button', { name: /Turn to the shelf/i }) !== null && guard < 12) {
      scanEverything()
      // A cigarette request parks you in the shelf phase, which is where the
      // chart is on offer.
      await userEvent.click(screen.getByRole('button', { name: /Turn to the shelf/i }))
      if (screen.queryByRole('button', { name: /Check the chart/ }) !== null) {
        break
      }
      await userEvent.click(screen.getByRole('button', { name: /Back to the counter/i }))
      await announceTotal()
      await userEvent.click(screen.getByRole('button', { name: /That’s everything/ }))
      guard += 1
    }

    const chart = screen.getByRole('button', { name: /Check the chart/ })
    expect(chart).toBeEnabled()
    await userEvent.click(chart)
    // Using it costs you: the shelf freezes for a moment, which is the whole
    // price of looking something up mid-sale.
    expect(screen.getByText(/Checking the chart/)).toBeInTheDocument()
  })
})
