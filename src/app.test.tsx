import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './app'
import { createManualClock } from './core/clock'
import { createShift, SHIFT_MS } from './core/shift'
import { FULL_SHELF } from './core/stock'
import { MESS_INTERVAL_MS } from './core/mess'
import { MOOD_AT_MS } from './core/patience'
import { HOT_ITEMS } from './core/hotfood'
import { ITEMS } from './core/catalog'
import { EMPTY_PURSE, type Purse } from './core/money'
import { asSurface, dragOn } from './test/drag'
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
 * The counter surface, prepared so pointer drags land where the test aims.
 */
const surface = (): HTMLElement => {
  const node = document.querySelector('.counter-top')
  if (node === null) {
    throw new Error('the counter is not on screen')
  }
  return asSurface(node as HTMLElement)
}

/**
 * How many loose things are currently on the counter.
 */
const looseGoods = (): number => document.querySelectorAll('.good').length

/**
 * Rings up every item, whatever the basket happens to hold.
 *
 * Each one is physically swept over the beam. A successful sweep takes that
 * item off the counter, so the pile is re-read every pass rather than cached.
 */
const scanEverything = (): void => {
  for (let n = 0; n < 14; n += 1) {
    const [first] = [...document.querySelectorAll('.good')]
    if (first === undefined) {
      return
    }
    const at = unitOf(first as HTMLElement)
    dragOn(surface(), at, { x: 0.95, y: at.y })
  }
}

/**
 * Where a rendered piece sits, read back out of its inline percentages.
 *
 * The component positions everything from the game's own unit coordinates, so
 * this recovers the point a drag has to start from to grab it.
 */
const unitOf = (node: HTMLElement): { x: number; y: number } => ({
  x: Number(node.style.left.replace('%', '')) / 100,
  y: Number(node.style.top.replace('%', '')) / 100,
})

/**
 * Says the total out loud, which is what puts the customer's money down.
 */
const announceTotal = async (amount?: number): Promise<void> => {
  const field = screen.queryByLabelText('Price to say out loud')
  if (field === null) {
    return
  }
  // Read the true total off the register unless the test wants it wrong.
  // Scoped to the register itself: the customer's loose cash is on screen too
  // and looks exactly like a price.
  const shown = document.querySelector('.register-total')
  const correct = Number((shown?.textContent ?? '0').replaceAll(/\D/g, ''))
  await userEvent.type(field, String(amount ?? correct))
  await userEvent.click(screen.getByRole('button', { name: 'Say it' }))
}

/**
 * Rings everything up, fetches any cigarettes, and announces the price.
 */
const ringUpAndAnnounce = async (): Promise<void> => {
  scanEverything()
  await handleCigarettesIfAsked()
  // The packet is on the counter now and still has to go over the beam.
  scanEverything()
  await announceTotal()
}

/**
 * Takes one piece out of the drawer and pushes it across to the customer.
 */
const handOver = async (denom: string): Promise<void> => {
  await userEvent.click(screen.getByLabelText(`Give ${denom}`))
}

describe('App', () => {
  it('opens the store on shift 1', () => {
    installRaf()
    render(<App />)
    expect(screen.getByText('6/7')).toBeInTheDocument()
    expect(screen.getByText(/KONBINI · SHIFT 1/)).toBeInTheDocument()
    expect(screen.getByText('Ring up the items.')).toBeInTheDocument()
  })

  it('starts with the closing button unavailable', () => {
    installRaf()
    render(<App />)
    expect(screen.getByRole('button', { name: /That’s everything/ })).toBeDisabled()
  })

  it('rings the register up only after everything is scanned', async () => {
    installRaf()
    render(<App />)
    expect(screen.queryByText('REGISTER')).not.toBeInTheDocument()
    scanEverything()
    // The shelf no longer appears by itself, so a cigarette customer leaves
    // you facing the counter with the request outstanding — deal with it the
    // way a player has to, then the total is up either way.
    await handleCigarettesIfAsked()
    scanEverything()
    expect(screen.getByText('REGISTER')).toBeInTheDocument()
  })

  it('makes the customer wait for the price before they pay', async () => {
    installRaf()
    render(<App />)
    scanEverything()
    await handleCigarettesIfAsked()
    scanEverything()
    // Their money is not on the counter: they have not been told what to pay.
    expect(document.querySelectorAll('.cash')).toHaveLength(0)
    await announceTotal()
    expect(document.querySelectorAll('.cash').length).toBeGreaterThan(0)
  })

  it('keeps the cigarette shelf out of sight until you turn to it', async () => {
    installRaf()
    render(<App />)
    // Not on screen at the counter, however far into the sale you are.
    expect(screen.queryByRole('heading', { name: /Cigarettes/i })).not.toBeInTheDocument()
    scanEverything()
    expect(screen.queryByRole('heading', { name: /Cigarettes/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Turn to the shelf/i }))
    expect(screen.getByRole('heading', { name: /Cigarettes/i })).toBeInTheDocument()
    // And now the customer and their request are behind you.
    expect(screen.getByText(/You’re looking away/)).toBeInTheDocument()
    expect(screen.queryByText('REGISTER')).not.toBeInTheDocument()
  })

  it('lets you count change out once the price is announced', async () => {
    installRaf()
    render(<App />)
    await ringUpAndAnnounce()
    await handOver('¥100')
    expect(screen.getByText('×1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /That’s everything/ })).toBeEnabled()
  })

  it('puts a coin back in the drawer when you take it back', async () => {
    installRaf()
    render(<App />)
    await ringUpAndAnnounce()
    await handOver('¥100')
    expect(screen.getByText('×1')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Take back ¥100'))
    expect(screen.queryByText('×1')).not.toBeInTheDocument()
  })

  it('lets you say a price the register never showed', async () => {
    installRaf()
    render(<App />)
    scanEverything()
    await handleCigarettesIfAsked()
    scanEverything()
    // Typed, not read off a button: the number you say is yours to get wrong.
    await announceTotal(99_999)
    // Either they queried it or they paid it — both are real outcomes, and
    // which one you get is decided by the customer, not the form.
    const queried = screen.queryByText(/I make it less/)
    const paid = screen.queryByText(/without looking up/)
    expect(queried ?? paid).not.toBeNull()
  })

  it('advances to the next customer after handing change over', async () => {
    installRaf()
    render(<App />)
    await ringUpAndAnnounce()
    await userEvent.click(screen.getByRole('button', { name: /That’s everything/ }))
    // Wrong change is still a completed sale; the queue moves on either way,
    // and the message becomes feedback on what just happened.
    expect(looseGoods()).toBeGreaterThan(0)
    expect(screen.getByText(/Next|counted it|drawer is|too many|short/)).toBeInTheDocument()
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

    // Not in view until you turn your head — a clock on the wall is not in
    // your field of view while you are working the counter.
    expect(screen.queryByLabelText('Wall clock')).not.toBeInTheDocument()

    clock.advance(45_000)
    act(() => {
      raf.pump()
    })
    await userEvent.click(screen.getByRole('button', { name: /Look at the clock/i }))

    // An analog face: hands to read, and no digits anywhere on it. 45s of a
    // 180s shift is a quarter past, so the minute hand is at 90°.
    const face = screen.getByLabelText('Wall clock')
    expect(face).toBeInTheDocument()
    expect(face.querySelector('.hand.minute')).toHaveStyle({ transform: 'rotate(90deg)' })
    expect(screen.queryByText('22:15')).not.toBeInTheDocument()
    // And looking away costs you sight of the customer.
    expect(screen.getByText(/You’re looking away/)).toBeInTheDocument()

    // Turning back restores the counter and takes the clock out of view.
    await userEvent.click(screen.getByRole('button', { name: /Back to the counter/i }))
    expect(screen.queryByLabelText('Wall clock')).not.toBeInTheDocument()
    expect(screen.queryByText(/You’re looking away/)).not.toBeInTheDocument()
  })

  it('keeps no running scoreboard on the counter', () => {
    installRaf()
    render(<App />)
    // A real shop has a till, a customer and a clock — not a live tally of
    // how you are doing.
    expect(screen.queryByText('SERVED')).not.toBeInTheDocument()
    expect(screen.queryByText('SCORE')).not.toBeInTheDocument()
  })

  it('says nothing when you merely turn your head', async () => {
    installRaf()
    render(<App />)
    const before = screen.getByText('Ring up the items.')
    expect(before).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Look at the clock/i }))
    // The banner still carries the last thing that actually happened, rather
    // than being overwritten with a narration of where you are looking.
    expect(screen.getByText('Ring up the items.')).toBeInTheDocument()
  })

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

describe('stock and the stockroom', () => {
  it('lets you put more out, and charges you the time for it', async () => {
    installRaf()
    render(<App stock={{ ...FULL_SHELF, melonpan: 0 }} />)

    await userEvent.click(screen.getByRole('button', { name: /Go out back/i }))
    expect(screen.getByText(/Out back/)).toBeInTheDocument()

    // The empty shelf is the one crate worth putting out, and it sorts first.
    await userEvent.click(screen.getByText(ITEMS.melonpan.label))
    expect(screen.getByText(/Putting out melonpan/)).toBeInTheDocument()
  })

  it('disables every crate when the shop is fully stocked', async () => {
    installRaf()
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /Go out back/i }))
    const crates = document.querySelectorAll<HTMLButtonElement>('.crate')
    expect(crates.length).toBeGreaterThan(0)
    expect([...crates].every((crate) => crate.disabled)).toBe(true)
  })

  it('does not offer to send anyone away while the shop is stocked', () => {
    installRaf()
    render(<App />)
    expect(screen.queryByRole('button', { name: /send them away/i })).not.toBeInTheDocument()
  })

  it('sends away a customer whose basket it cannot fill', async () => {
    installRaf()
    // Empty the shelf the first customer is actually shopping from, which is
    // the only way the control appears.
    const first = createShift(1)
    const [line] = first.customer.basket
    if (line === undefined) {
      throw new Error('seed 1 customer should have a basket')
    }
    render(<App stock={{ ...FULL_SHELF, [line.item]: 0 }} />)

    const away = screen.getByRole('button', { name: /send them away/i })
    await userEvent.click(away)
    // They leave with nothing, and the next customer steps up.
    expect(screen.getByText(/we’re out of/)).toBeInTheDocument()
  })
})

describe('cleaning up', () => {
  it('lets you wipe up a spill once one appears', async () => {
    const raf = installRaf()
    const clock = createManualClock()
    render(<App clock={clock} />)

    // Nothing is dropped in the opening moments — the shop starts clean.
    expect(document.querySelectorAll('.mess')).toHaveLength(0)

    clock.advance(MESS_INTERVAL_MS + 1000)
    act(() => {
      raf.pump()
    })

    const messes = document.querySelectorAll<HTMLButtonElement>('.mess')
    expect(messes.length).toBeGreaterThan(0)

    const first = messes[0]
    if (first === undefined) {
      throw new Error('expected a mess to have been dropped')
    }
    await userEvent.click(first)
    expect(document.querySelectorAll('.mess')).toHaveLength(messes.length - 1)
  })
})

describe('keeping someone waiting', () => {
  it('offers an apology once they mind, and takes it', async () => {
    const raf = installRaf()
    const clock = createManualClock()
    render(<App clock={clock} />)

    // Nobody minds at the start of a transaction.
    expect(screen.queryByRole('button', { name: /Apologise/i })).not.toBeInTheDocument()

    clock.advance(MOOD_AT_MS.annoyed)
    act(() => {
      raf.pump()
    })

    const sorry = screen.getByRole('button', { name: /Apologise/i })
    await userEvent.click(sorry)
    expect(screen.getByText(/omatase/)).toBeInTheDocument()
  })
})

describe('the hot case', () => {
  it('cooks something, and sells it once it is ready', async () => {
    const raf = installRaf()
    const clock = createManualClock()
    render(<App clock={clock} />)

    await userEvent.click(screen.getByRole('button', { name: /To the hot case/i }))
    expect(screen.getByText(/sells nothing while it is empty/)).toBeInTheDocument()

    await userEvent.click(screen.getByText(HOT_ITEMS.coffee.label))
    expect(document.querySelectorAll('.portion')).toHaveLength(1)

    // The timer runs while you are doing anything else — that is the point.
    clock.advance(HOT_ITEMS.coffee.cookMs + 1000)
    act(() => {
      raf.pump()
    })
    expect(document.querySelectorAll('.portion.ready')).toHaveLength(1)

    await userEvent.click(screen.getByLabelText(/Hot Coffee, ready/))
    expect(document.querySelectorAll('.portion')).toHaveLength(0)
    expect(screen.getByText(/Hot Coffee sold/)).toBeInTheDocument()
  })
})
