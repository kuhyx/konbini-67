import { describe, expect, it } from 'vitest'
import { EMPTY_PURSE } from './money'
import { createShift, reduce, SHIFT_MS } from './shift'
import { customerTotal } from './customer'
import { EVENT_KIND_ORDER } from './types'

import {
  scanAll,
  payExact,
  servePerfectly,
  sampleEvent,
  play,
  baskets,
} from '../test/shift-fixtures'

describe('createShift', () => {
  it('opens on the first customer with an empty tally', () => {
    const state = createShift(1)
    expect(state.phase).toBe('scanning')
    expect(state.customer.id).toBe(1)
    expect(state.tally.served).toBe(0)
    expect(state.tray).toStrictEqual(EMPTY_PURSE)
    // Nobody pays before they have been told the price.
    expect(state.cashOnCounter).toStrictEqual([])
  })

  it('applies the shelf tier for the shift number', () => {
    expect(createShift(1, 1).shelf.mode).toBe('labelled')
    expect(createShift(1, 7).shelf.mode).toBe('bare')
  })
})

describe('determinism', () => {
  // The M0 done-condition: a seeded shift replays byte-identically.
  it('produces an identical result from the same seed across two runs', () => {
    expect(JSON.stringify(play().tally)).toBe(JSON.stringify(play().tally))
  })

  it('produces different customers from different seeds', () => {
    expect(baskets(1)).not.toBe(baskets(999))
  })

  // `Rng` is a mutable object, so a reducer that drew from the caller's
  // generator would mutate its own input. React StrictMode double-invokes
  // reducers in dev, which would then desync dev from prod for the same seed.
  it('does not mutate the state it is given', () => {
    let seed = 1
    while (createShift(seed).customer.cigarette !== undefined) {
      seed += 1
    }
    const ready = scanAll(createShift(seed))
    const first = reduce(payExact(ready), { kind: 'confirm' })
    const second = reduce(payExact(ready), { kind: 'confirm' })
    expect(first.customer).toStrictEqual(second.customer)
    expect(first.rng.s).toBe(second.rng.s)
  })

  it('serves 20 customers with exact change and no mistakes', () => {
    let state = createShift(1)
    for (let n = 0; n < 20; n += 1) {
      state = servePerfectly(state)
    }
    expect(state.tally.served).toBe(20)
    expect(state.tally.exactChange).toBe(20)
    expect(state.tally.wrongChange).toBe(0)
    expect(state.tally.wrongBrand).toBe(0)
    expect(state.tally.sloppyChange).toBe(0)
    expect(state.tally.drawerDelta).toBe(0)
  })
})

describe('the clock', () => {
  it('advances elapsed time', () => {
    expect(reduce(createShift(1), { kind: 'tick', deltaMs: 1500 }).elapsedMs).toBe(1500)
  })

  it('closes the shift when time runs out', () => {
    const state = reduce(createShift(1), { kind: 'tick', deltaMs: SHIFT_MS })
    expect(state.phase).toBe('closed')
    expect(state.elapsedMs).toBe(SHIFT_MS)
    expect(state.message).toBe('Shift over.')
  })

  it('ignores everything once closed', () => {
    const closed = reduce(createShift(1), { kind: 'tick', deltaMs: SHIFT_MS })
    for (const kind of ['scan', 'confirm', 'use-lookup'] as const) {
      expect(reduce(closed, { kind })).toStrictEqual(closed)
    }
  })

  it('restarts even from a closed shift', () => {
    const closed = reduce(createShift(1), { kind: 'tick', deltaMs: SHIFT_MS })
    const fresh = reduce(closed, { kind: 'restart', seed: 9, shift: 3 })
    expect(fresh.phase).toBe('scanning')
    expect(fresh.elapsedMs).toBe(0)
    expect(fresh.tally.served).toBe(0)
    expect(fresh.shift).toBe(3)
  })

  it('awards a speed bonus for a quick sale and none for a slow one', () => {
    let seed = 1
    while (createShift(seed).customer.cigarette !== undefined) {
      seed += 1
    }
    const scanned = scanAll(createShift(seed))
    const rungUp = reduce(scanned, { kind: 'announce', amount: customerTotal(scanned.customer) })
    const quick = reduce(payExact(rungUp), { kind: 'confirm' })

    const slowScan = scanAll(createShift(seed))
    let slow = reduce(slowScan, { kind: 'announce', amount: customerTotal(slowScan.customer) })
    slow = reduce(slow, { kind: 'tick', deltaMs: 90_000 })
    slow = reduce(payExact(slow), { kind: 'confirm' })

    expect(quick.tally.score).toBeGreaterThan(slow.tally.score)
  })
})

describe('the event union', () => {
  it('handles every declared event kind without throwing', () => {
    const state = createShift(1)
    for (const kind of EVENT_KIND_ORDER) {
      expect(() => reduce(state, sampleEvent(kind))).not.toThrow()
    }
  })
})
