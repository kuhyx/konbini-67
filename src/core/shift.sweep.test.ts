import { describe, expect, it } from 'vitest'
import { createShift, reduce, type ShiftState } from './shift'
import { customerTotal } from './customer'

import {
  scanAll,
  basketOnly,
  payExact,
  ringUp,
  servePerfectly,
  changing,
} from '../test/shift-fixtures'

describe('sweeping items over the beam', () => {
  const FAR_SIDE = { x: 0.95, y: 0.5 }

  it('lays the basket out as loose items on the counter', () => {
    const state = createShift(1)
    // Only what they actually put down: a cigarette packet is still on the
    // wall behind you until you fetch it.
    expect(state.onCounter).toHaveLength(basketOnly(state))
    // Scattered, not stacked in one place.
    const xs = new Set(state.onCounter.map((piece) => piece.at.x))
    expect(xs.size).toBeGreaterThan(0)
  })

  it('rings an item up when the sweep crosses the beam', () => {
    const state = createShift(1)
    const after = reduce(state, { kind: 'sweep', item: 0, to: FAR_SIDE })
    expect(after.scanned).toBe(1)
    expect(after.onCounter).toHaveLength(state.onCounter.length - 1)
  })

  it('is a miss when the sweep stops short, and costs only the attempt', () => {
    const state = createShift(1)
    // Barely moved: never reached the beam.
    const short = { x: 0.2, y: 0.5 }
    const after = reduce(state, { kind: 'sweep', item: 0, to: short })
    expect(after.scanned).toBe(0)
    expect(after.onCounter).toHaveLength(state.onCounter.length)
    expect(after.message).toContain('No beep')
    // No score penalty for fumbling it — you just pass it again.
    expect(after.tally.score).toBe(state.tally.score)
  })

  it('leaves a missed item where you dropped it, ready to try again', () => {
    const state = createShift(1)
    const short = { x: 0.2, y: 0.5 }
    const after = reduce(state, { kind: 'sweep', item: 0, to: short })
    expect(after.onCounter[0]?.at).toStrictEqual(short)
    // And sweeping it properly this time works.
    const retried = reduce(after, { kind: 'sweep', item: 0, to: FAR_SIDE })
    expect(retried.scanned).toBe(1)
  })

  it('ignores a sweep of an item that is not there', () => {
    const state = createShift(1)
    expect(reduce(state, { kind: 'sweep', item: 99, to: FAR_SIDE })).toStrictEqual(state)
  })

  it('clears the counter as the basket is rung up', () => {
    let state = createShift(1)
    const total = basketOnly(state)
    for (let n = 0; n < total; n += 1) {
      state = reduce(state, { kind: 'sweep', item: 0, to: FAR_SIDE })
    }
    expect(state.onCounter).toHaveLength(0)
    expect(state.scanned).toBe(total)
  })

  it('gives the next customer a fresh counter', () => {
    const state = servePerfectly(createShift(1))
    expect(state.onCounter).toHaveLength(basketOnly(state))
  })

  it('cannot be swept while the chart has you frozen', () => {
    const frozen = reduce(createShift(1, 4), { kind: 'use-lookup' })
    expect(reduce(frozen, { kind: 'sweep', item: 0, to: FAR_SIDE })).toStrictEqual(frozen)
  })

  it('cannot be swept once scanning is done', () => {
    const done = scanAll(createShift(1))
    expect(reduce(done, { kind: 'sweep', item: 0, to: FAR_SIDE })).toStrictEqual(done)
  })

  it('lays out identically for the same seed', () => {
    expect(createShift(5).onCounter).toStrictEqual(createShift(5).onCounter)
  })
})

/**
Rings a seeded shift all the way up to the point of saying a price.
*/
const scanAllThrough = (seed: number): ShiftState => ringUp(createShift(seed))

/**
A customer who is listening, and one who is not. Both are needed: the whole
mechanic is that you cannot tell which you have until afterwards.
*/
const attentive = (): ShiftState => {
  let seed = 1
  while (!createShift(seed).customer.willQueryThePrice) {
    seed += 1
  }
  return scanAllThrough(seed)
}

const distracted = (): ShiftState => {
  let seed = 1
  while (createShift(seed).customer.willQueryThePrice) {
    seed += 1
  }
  return scanAllThrough(seed)
}

describe('saying the price out loud', () => {
  it('puts no money down until a price has been said', () => {
    const ready = attentive()
    expect(ready.phase).toBe('announcing')
    expect(ready.cashOnCounter).toStrictEqual([])
  })

  it('is queried by a customer who was listening, and settles nothing', () => {
    const ready = attentive()
    const wrong = customerTotal(ready.customer) + 90
    const after = reduce(ready, { kind: 'announce', amount: wrong })
    expect(after.phase).toBe('announcing')
    expect(after.quoted).toBeUndefined()
    expect(after.cashOnCounter).toStrictEqual([])
    expect(after.message).toContain('I make it less')
    // Being pulled up on it costs you time, which is the only real penalty.
    expect(after.elapsedMs).toBeGreaterThan(ready.elapsedMs)
  })

  it('is paid without question by a customer who was not', () => {
    const ready = distracted()
    const wrong = customerTotal(ready.customer) + 90
    const after = reduce(ready, { kind: 'announce', amount: wrong })
    expect(after.phase).toBe('changing')
    expect(after.quoted).toBe(wrong)
    expect(after.cashOnCounter.length).toBeGreaterThan(0)
    expect(after.message).toContain('without looking up')
  })

  it('books an unnoticed overcharge as a drawer surplus', () => {
    const ready = distracted()
    const over = customerTotal(ready.customer) + 100
    const told = reduce(ready, { kind: 'announce', amount: over })
    const after = reduce(payExact(told), { kind: 'confirm' })
    // The shop took ¥100 it was not owed. Nobody said a word at the counter.
    expect(after.tally.misquoted).toBe(1)
    expect(after.tally.drawerDelta).toBe(100)
  })

  it('leaves the books alone when the price was right', () => {
    const ready = distracted()
    const told = reduce(ready, { kind: 'announce', amount: customerTotal(ready.customer) })
    const after = reduce(payExact(told), { kind: 'confirm' })
    expect(after.tally.misquoted).toBe(0)
    expect(after.tally.drawerDelta).toBe(0)
  })

  it('cannot be said twice, or before everything is rung up', () => {
    const fresh = createShift(1)
    expect(reduce(fresh, { kind: 'announce', amount: 500 })).toStrictEqual(fresh)
    const told = changing()
    expect(reduce(told, { kind: 'announce', amount: 999 })).toStrictEqual(told)
  })
})
