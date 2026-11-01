import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './app'
import { createManualClock } from './core/clock'
import { installRaf } from './test/harness'
import {
  handleCigarettesIfAsked,
  looseGoods,
  scanEverything,
  announceTotal,
  ringUpAndAnnounce,
  handOver,
} from './test/app-drivers'

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
    await handOver()
    expect(screen.getByText('×1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /That’s everything/ })).toBeEnabled()
  })

  it('puts a coin back in the drawer when you take it back', async () => {
    installRaf()
    render(<App />)
    await ringUpAndAnnounce()
    await handOver()
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
})
