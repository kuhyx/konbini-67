import { describe, expect, it } from 'vitest'
import { canMakeChange, purseValue } from './money'
import { changeOwed, createShift, reduce } from './shift'
import { RESOLUTION_ORDER, RESOLUTIONS } from './types'
import { stuck } from '../test/shift-fixtures'

describe('talking your way out of an empty till', () => {
  it('offers a way out when the drawer cannot make the change', () => {
    const state = stuck()
    expect(canMakeChange(changeOwed(state), state.drawer)).toBe(false)
  })

  it('costs shift time whatever the customer says', () => {
    const state = stuck()
    for (const how of RESOLUTION_ORDER) {
      const after = reduce(state, { kind: 'resolve', how })
      expect(after.elapsedMs).toBe(state.elapsedMs + RESOLUTIONS[how].costMs)
    }
  })

  it('never charges score for asking — the cost is time and goodwill', () => {
    const state = stuck()
    for (const how of RESOLUTION_ORDER) {
      const after = reduce(state, { kind: 'resolve', how })
      expect(after.tally.score).toBe(state.tally.score)
    }
  })

  it('refills the drawer from the manager, who cannot refuse', () => {
    const state = stuck()
    const after = reduce(state, { kind: 'resolve', how: 'ask-manager' })
    expect(after.drawer[100]).toBeGreaterThan(state.drawer[100])
    expect(canMakeChange(changeOwed(state), after.drawer)).toBe(true)
    expect(after.message).toContain('better')
  })

  it('books the gap when the customer waves off the odd yen', () => {
    // Search for a seed the customer agrees on: acceptance is seeded, so
    // some will refuse.
    let state = stuck()
    let after = reduce(state, { kind: 'resolve', how: 'owe-the-coin' })
    let guard = 0
    while (!after.message.includes('wave') && guard < 40) {
      state = { ...state, rng: { s: state.rng.s + 1 } }
      after = reduce(state, { kind: 'resolve', how: 'owe-the-coin' })
      guard += 1
    }
    expect(after.message).toContain('short in the books')
    expect(after.tally.drawerDelta).toBeGreaterThan(0)
    expect(after.tally.served).toBe(state.tally.served + 1)
  })

  it('lets the customer refuse, leaving you still stuck', () => {
    let state = stuck()
    let after = reduce(state, { kind: 'resolve', how: 'ask-smaller' })
    let guard = 0
    while (!after.message.includes('shake their head') && guard < 40) {
      state = { ...state, rng: { s: state.rng.s + 1 } }
      after = reduce(state, { kind: 'resolve', how: 'ask-smaller' })
      guard += 1
    }
    expect(after.message).toContain('shake their head')
    // Same customer, same phase: nothing was resolved.
    expect(after.phase).toBe('changing')
    expect(after.customer.id).toBe(state.customer.id)
  })

  it('closes the sale on card without touching the drawer', () => {
    let state = stuck()
    let after = reduce(state, { kind: 'resolve', how: 'offer-card' })
    let guard = 0
    while (!after.message.includes('Sorted') && guard < 40) {
      state = { ...state, rng: { s: state.rng.s + 1 } }
      after = reduce(state, { kind: 'resolve', how: 'offer-card' })
      guard += 1
    }
    // Card means no cash changes hands at all.
    expect(after.drawer).toStrictEqual(state.drawer)
    expect(after.tally.served).toBe(state.tally.served + 1)
  })

  it('takes the cash when they find smaller money', () => {
    let state = stuck()
    let after = reduce(state, { kind: 'resolve', how: 'ask-smaller' })
    let guard = 0
    while (!after.message.includes('Sorted') && guard < 40) {
      state = { ...state, rng: { s: state.rng.s + 1 } }
      after = reduce(state, { kind: 'resolve', how: 'ask-smaller' })
      guard += 1
    }
    expect(purseValue(after.drawer)).toBeGreaterThan(purseValue(state.drawer))
  })

  it('is refused outside the changing phase', () => {
    const state = createShift(1)
    expect(reduce(state, { kind: 'resolve', how: 'ask-manager' })).toStrictEqual(state)
  })

  it('is refused while the chart has you frozen', () => {
    const frozen = reduce(createShift(1, 4), { kind: 'use-lookup' })
    const changingFrozen = { ...frozen, phase: 'changing' as const }
    expect(reduce(changingFrozen, { kind: 'resolve', how: 'ask-manager' })).toStrictEqual(
      changingFrozen,
    )
  })

  it('replays identically from the same generator state', () => {
    const state = stuck()
    const first = reduce(state, { kind: 'resolve', how: 'ask-smaller' })
    const second = reduce(state, { kind: 'resolve', how: 'ask-smaller' })
    expect(first.message).toBe(second.message)
    expect(first.rng.s).toBe(second.rng.s)
  })
})
