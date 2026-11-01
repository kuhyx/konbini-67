import { describe, expect, it } from 'vitest'
import { CIGARETTES } from './catalog'
import { createShift, lineCount, reduce } from './shift'
import { customerTotal } from './customer'
import { GAZE, GAZE_ORDER } from './types'
import { scanAll, payExact, cigShift } from '../test/shift-fixtures'

describe('scanning', () => {
  it('rings items up one at a time', () => {
    let state = createShift(3)
    const total = lineCount(state.customer)
    for (let n = 1; n <= total; n += 1) {
      state = reduce(state, { kind: 'scan' })
      expect(state.scanned).toBe(n)
    }
  })

  it('ignores extra scans once the counter is empty', () => {
    // A customer with nothing to fetch, so scanning genuinely runs out.
    let seed = 1
    while (createShift(seed).customer.cigarette !== undefined) {
      seed += 1
    }
    const state = scanAll(createShift(seed))
    expect(reduce(state, { kind: 'scan' }).scanned).toBe(state.scanned)
  })

  it('goes to the shelf when cigarettes are wanted', () => {
    let seed = 1
    while (createShift(seed).customer.cigarette === undefined) {
      seed += 1
    }
    expect(scanAll(createShift(seed)).phase).toBe('shelf')
  })

  it('waits to be told the price when no cigarettes are wanted', () => {
    let seed = 1
    while (createShift(seed).customer.cigarette !== undefined) {
      seed += 1
    }
    // Not `changing`: the customer has not been told what they owe yet, so
    // there is nothing for them to pay.
    expect(scanAll(createShift(seed)).phase).toBe('announcing')
  })
})

describe('the cigarette shelf', () => {

  it('accepts the right slot without penalty', () => {
    const state = scanAll(cigShift())
    const brand = state.customer.cigarette?.cigarette ?? 'echo'
    const after = reduce(state, { kind: 'pick-slot', slot: CIGARETTES[brand].slot })
    expect(after.tally.wrongBrand).toBe(0)
    // Back to scanning: the packet is a physical thing now sitting on the
    // counter, and it still has to go over the beam.
    expect(after.phase).toBe('scanning')
    expect(after.onCounter.at(-1)?.what).toStrictEqual({ kind: 'cigarette', id: brand })
    expect(after.onCounter).toHaveLength(state.onCounter.length + 1)
    expect(after.message).toContain('on the counter')
  })

  it('counts a wrong slot against you but moves on', () => {
    const state = scanAll(cigShift())
    const wanted = CIGARETTES[state.customer.cigarette?.cigarette ?? 'echo'].slot
    const wrong = wanted === 3 ? 5 : 3
    const after = reduce(state, { kind: 'pick-slot', slot: wrong })
    expect(after.tally.wrongBrand).toBe(1)
    // You still put a packet down — the wrong one, which is the mistake.
    expect(after.phase).toBe('scanning')
    expect(after.onCounter).toHaveLength(state.onCounter.length + 1)
  })

  it('counts an empty slot as wrong', () => {
    const state = scanAll(cigShift())
    // Slot 1 holds no brand in the catalogue.
    expect(reduce(state, { kind: 'pick-slot', slot: 1 }).tally.wrongBrand).toBe(1)
  })

  it('ignores a slot pick outside the shelf phase', () => {
    const state = createShift(1)
    expect(reduce(state, { kind: 'pick-slot', slot: 3 })).toStrictEqual(state)
  })

  // The other M0 done-condition: a scripted 10-request sequence produces
  // exactly the expected wrongBrand / lookupUsed counters.
  it('counts exactly the mistakes and lookups a scripted run makes', () => {
    let state = createShift(1, 4) // faded tier: the chart is available
    let requests = 0
    let deliberateMisses = 0
    let deliberateLookups = 0

    while (requests < 10) {
      state = scanAll(state)
      const request = state.customer.cigarette
      if (request !== undefined && state.phase === 'shelf') {
        requests += 1
        // Use the chart on every third request, miss on every other one.
        if (requests % 3 === 0) {
          state = reduce(state, { kind: 'use-lookup' })
          deliberateLookups += 1
          // The chart freezes you; let it lapse.
          state = reduce(state, { kind: 'tick', deltaMs: 5000 })
        }
        const wanted = CIGARETTES[request.cigarette].slot
        if (requests % 2 === 0) {
          state = reduce(state, { kind: 'pick-slot', slot: wanted === 3 ? 5 : 3 })
          deliberateMisses += 1
        } else {
          state = reduce(state, { kind: 'pick-slot', slot: wanted })
        }
        // The packet is on the counter now and still has to be rung up.
        state = scanAll(state)
      }
      const told = reduce(state, { kind: 'announce', amount: customerTotal(state.customer) })
      state = reduce(payExact(told), { kind: 'confirm' })
    }

    expect(requests).toBe(10)
    expect(deliberateMisses).toBe(5)
    expect(deliberateLookups).toBe(3)
    expect(state.tally.wrongBrand).toBe(5)
    expect(state.tally.lookupsUsed).toBe(3)
  })
})

describe('where the clerk is looking', () => {
  it('starts facing the counter, seeing the customer', () => {
    expect(createShift(1).gaze).toBe('counter')
  })

  it('turns the head to each surface in turn', () => {
    let state = createShift(1)
    // Starts on the counter, so look away first and come back at the end —
    // looking where you already look is a no-op, covered separately below.
    const awayThenBack = [...GAZE_ORDER.filter((gaze) => gaze !== 'counter'), 'counter' as const]
    const before = state.message
    for (const at of awayThenBack) {
      state = reduce(state, { kind: 'look', at })
      expect(state.gaze).toBe(at)
      // Turning your head says nothing: where you are looking is obvious from
      // what is in front of you, and narrating it would trample the line that
      // carries actual feedback.
      expect(state.message).toBe(before)
    }
  })

  it('ignores looking where you are already looking', () => {
    const state = reduce(createShift(1), { kind: 'look', at: 'clock' })
    expect(reduce(state, { kind: 'look', at: 'clock' })).toStrictEqual(state)
  })

  it('cannot turn away while the chart still has you frozen', () => {
    const frozen = reduce(createShift(1, 4), { kind: 'use-lookup' })
    expect(frozen.frozenUntilMs).toBeGreaterThan(frozen.elapsedMs)
    expect(reduce(frozen, { kind: 'look', at: 'counter' })).toStrictEqual(frozen)
  })

  it('hides the customer everywhere except the counter', () => {
    expect(GAZE.counter.canSeeCustomer).toBe(true)
    const awayFromCounter = GAZE_ORDER.filter((gaze) => gaze !== 'counter')
    for (const at of awayFromCounter) {
      expect(GAZE[at].canSeeCustomer).toBe(false)
    }
  })
})

describe('the lookup chart', () => {
  it('is unavailable while the names are still on the shelf', () => {
    const state = createShift(1, 1)
    expect(reduce(state, { kind: 'use-lookup' })).toStrictEqual(state)
  })

  it('costs score and freezes you once the names fade', () => {
    const state = createShift(1, 4)
    const after = reduce(state, { kind: 'use-lookup' })
    expect(after.tally.lookupsUsed).toBe(1)
    expect(after.tally.score).toBe(-state.shelf.lookupPenalty)
    expect(after.frozenUntilMs).toBeGreaterThan(after.elapsedMs)
  })

  it('cannot be opened twice at once', () => {
    const once = reduce(createShift(1, 4), { kind: 'use-lookup' })
    expect(reduce(once, { kind: 'use-lookup' })).toStrictEqual(once)
  })

  it('blocks scanning while frozen', () => {
    const frozen = reduce(createShift(1, 4), { kind: 'use-lookup' })
    expect(reduce(frozen, { kind: 'scan' }).scanned).toBe(frozen.scanned)
  })

  it('blocks slot picks while frozen', () => {
    let seed = 1
    while (createShift(seed, 4).customer.cigarette === undefined) {
      seed += 1
    }
    const shelfPhase = scanAll(createShift(seed, 4))
    const frozen = reduce(shelfPhase, { kind: 'use-lookup' })
    expect(reduce(frozen, { kind: 'pick-slot', slot: 3 }).phase).toBe('shelf')
  })
})
