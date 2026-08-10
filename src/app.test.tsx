import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './app'
import { createManualClock } from './core/clock'
import { SHIFT_MS } from './core/shift'
import { EMPTY_PURSE, type Purse } from './core/money'
import { installRaf } from './test/harness'

/**
 * Turns to the shelf and picks a slot, if this customer wanted cigarettes.
 *
 * The shelf is no longer on screen by default — reaching it is a head-turn,
 * so every test that gets past a cigarette request has to make that turn the
 * same way a player would.
 */
const handleCigarettesIfAsked = async (): Promise<void> => {
  const turn = screen.queryByRole('button', { name: /Turn to the shelf/i })
  if (turn === null) {
    return
  }
  await userEvent.click(turn)
  const slot = screen.queryByLabelText('Slot 3')
  if (slot !== null && !(slot as HTMLButtonElement).disabled) {
    await userEvent.click(slot)
  }
  const back = screen.queryByRole('button', { name: /Back to the counter/i })
  if (back !== null) {
    await userEvent.click(back)
  }
}

/**
 * Cashes up, which now stands between the end of a shift and the summary.
 *
 * Declares whatever the till is actually out by — these tests are about the
 * shift, not the arithmetic, which books.test.tsx covers.
 */
const cashUp = async (declared = '0'): Promise<void> => {
  const field = screen.queryByLabelText('Declared discrepancy in yen')
  if (field === null) {
    return
  }
  await userEvent.type(field, declared)
  await userEvent.click(screen.getByRole('button', { name: /Close the books/i }))
}

/**
 * Rings up every item, whatever the basket happens to hold.
 */
const scanEverything = async (): Promise<void> => {
  // Goods are swept over the beam one at a time; each successful sweep takes
  // that item off the counter, so re-query rather than caching the list.
  for (let n = 0; n < 12; n += 1) {
    const [first] = screen.queryAllByRole('button', { name: /^Scan / })
    if (first === undefined) {
      return
    }
    await userEvent.click(first)
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
    // The shelf no longer appears by itself, so a cigarette customer leaves
    // you facing the counter with the request outstanding — deal with it the
    // way a player has to, then the total is up either way.
    await handleCigarettesIfAsked()
    expect(screen.getByText('TOTAL')).toBeInTheDocument()
  })

  it('keeps the cigarette shelf out of sight until you turn to it', async () => {
    installRaf()
    render(<App />)
    // Not on screen at the counter, however far into the sale you are.
    expect(screen.queryByRole('heading', { name: /Cigarettes/i })).not.toBeInTheDocument()
    await scanEverything()
    expect(screen.queryByRole('heading', { name: /Cigarettes/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Turn to the shelf/i }))
    expect(screen.getByRole('heading', { name: /Cigarettes/i })).toBeInTheDocument()
    // And now the customer and their request are behind you.
    expect(screen.getByText(/You’re looking away/)).toBeInTheDocument()
    expect(screen.queryByText('TOTAL')).not.toBeInTheDocument()
  })

  it('keeps notes across shifts, and hides the customer while you read them', async () => {
    installRaf()
    const storage = localStorage
    storage.clear()
    const { unmount } = render(<App storage={storage} />)

    await userEvent.click(screen.getByRole('button', { name: /Check your notes/i }))
    expect(screen.getByText(/You’re looking away/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Note for slot 5'), 'Hi-Lite')
    unmount()

    // A fresh mount is the next shift: the scrap of paper is still taped up.
    render(<App storage={storage} />)
    await userEvent.click(screen.getByRole('button', { name: /Check your notes/i }))
    expect(screen.getByLabelText('Note for slot 5')).toHaveValue('Hi-Lite')
  })

  it('lets you count out change once the basket is rung up', async () => {
    installRaf()
    render(<App />)
    await scanEverything()
    await handleCigarettesIfAsked()
    await userEvent.click(screen.getByLabelText('Give ¥100'))
    expect(screen.getByText('×1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hand over change' })).toBeEnabled()
  })

  it('advances to the next customer after handing change over', async () => {
    installRaf()
    render(<App />)
    await scanEverything()
    await handleCigarettesIfAsked()
    await userEvent.click(screen.getByRole('button', { name: 'Hand over change' }))
    // Wrong change is still a completed sale; the queue moves on either way,
    // and the message becomes feedback on what just happened.
    expect(screen.getByText(/SERVED/)).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^Scan / }).length).toBeGreaterThan(0)
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

  it('offers a way out when the till cannot make the change', async () => {
    installRaf()
    // A drawer of nothing but big notes: no combination makes the change.
    const bigNotesOnly: Purse = { ...EMPTY_PURSE, 10_000: 2, 5000: 2, 1000: 2 }
    render(<App float={bigNotesOnly} />)

    // Nothing on offer while you are still ringing up.
    expect(screen.queryByRole('button', { name: /Anything smaller/i })).not.toBeInTheDocument()

    await scanEverything()
    await handleCigarettesIfAsked()

    expect(screen.getByText(/till cannot make this change/i)).toBeInTheDocument()
    for (const label of [/Anything smaller/i, /Suggest card/i, /Owe them/i, /Ask the manager/i]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('refills the drawer when you go and ask the manager', async () => {
    installRaf()
    const bigNotesOnly: Purse = { ...EMPTY_PURSE, 10_000: 2, 5000: 2, 1000: 2 }
    render(<App float={bigNotesOnly} />)
    await scanEverything()
    await handleCigarettesIfAsked()

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
    expect(screen.queryAllByRole('button', { name: /^Scan / }).length).toBeGreaterThan(0)
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

    // Cash up first — the books now sit between the shift and the summary.
    expect(screen.getByText('Cash up')).toBeInTheDocument()
    await cashUp()

    expect(screen.getByText('Shift over')).toBeInTheDocument()
    expect(screen.getByText('Served')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Another shift' }))
    expect(screen.getByText(/KONBINI · SHIFT 2/)).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^Scan / }).length).toBeGreaterThan(0)
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
    await handleCigarettesIfAsked()
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
      await cashUp()
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
