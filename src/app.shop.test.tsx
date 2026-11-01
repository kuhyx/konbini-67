import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './app'
import { createManualClock } from './core/clock'
import { createShift } from './core/shift'
import { FULL_SHELF } from './core/stock'
import { MESS_INTERVAL_MS } from './core/mess'
import { MOOD_AT_MS } from './core/patience'
import { HOT_ITEMS } from './core/hotfood'
import { ITEMS } from './core/catalog'
import { installRaf } from './test/harness'

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

  it('rattles a crate onto the shelf where you can hear it', async () => {
    // The cue itself is unit-tested against `cuesFor`; what this pins down is
    // the wiring in between — that the app hands the restock tally to the
    // speaker at all. Every other new cue was confirmed by ear in a browser;
    // this one needs a sold-down shelf to reach, so it is held here instead.
    installRaf()
    const played: string[] = []
    render(
      <App
        stock={{ ...FULL_SHELF, melonpan: 0 }}
        speaker={{
          play: (cue) => {
            played.push(cue)
          },
        }}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Go out back/i }))
    await userEvent.click(screen.getByText(ITEMS.melonpan.label))
    expect(played).toContain('stock')
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
