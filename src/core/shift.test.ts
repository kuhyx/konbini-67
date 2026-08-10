import { describe, expect, it } from 'vitest'
import { CIGARETTES } from './catalog'
import { canMakeChange, DENOMS, EMPTY_PURSE, greedyChange, purseValue } from './money'
import {
  ID_CHECK_MS,
  ID_SCORE,
  type IdOutcome,
  isSaleLegal,
  requiresIdCheck,
} from './id-check'
import {
  changeOwed,
  createShift,
  lineCount,
  missingFromBasket,
  reduce,
  SHIFT_MS,
  type ShiftState,
} from './shift'
import { FULL_SHELF, RESTOCK_MS, RESTOCK_PER_TRIP, SHELF_CAPACITY } from './stock'
import { CLEAN_MS, MESS_INTERVAL_MS } from './mess'
import { customerTotal, tenderValue } from './customer'
import {
  EVENT_KIND_ORDER,
  GAZE,
  GAZE_ORDER,
  RESOLUTION_ORDER,
  RESOLUTIONS,
  type ShiftEvent,
} from './types'

/**
 * Rings up everything currently lying on the counter.
 *
 * Stops of its own accord when the scanning phase ends — either because the
 * basket is done or because the customer's cigarette request interrupts.
 */
const scanAll = (start: ShiftState): ShiftState => {
  let state = start
  for (let n = 0; n < lineCount(start.customer); n += 1) {
    if (state.phase !== 'scanning') {
      break
    }
    state = reduce(state, { kind: 'scan' })
  }
  return state
}

/**
 * How many things the customer physically put down.
 *
 * One short of {@link lineCount} when cigarettes are wanted: that packet is
 * behind the counter until the clerk turns round and fetches it.
 */
const basketOnly = (state: ShiftState): number =>
  lineCount(state.customer) - (state.customer.cigarette === undefined ? 0 : 1)

/**
 * Hands over the fewest-coins correct change.
 */
const payExact = (start: ShiftState): ShiftState => {
  let state = start
  const optimal = greedyChange(changeOwed(state))
  for (const denom of DENOMS) {
    for (let n = 0; n < optimal[denom]; n += 1) {
      state = reduce(state, { kind: 'give', denom })
    }
  }
  return state
}

/**
 * Rings up everything, fetching the cigarettes when asked.
 */
const ringUp = (start: ShiftState): ShiftState => {
  let state = scanAll(start)
  if (state.phase === 'shelf' && state.customer.cigarette !== undefined) {
    const slot = CIGARETTES[state.customer.cigarette.cigarette].slot
    state = reduce(state, { kind: 'pick-slot', slot })
    // The packet is on the counter now and still has to go over the beam.
    state = reduce(state, { kind: 'scan' })
  }
  return state
}

/**
 * Plays one customer perfectly: scan, right slot, announce, exact change.
 */
const servePerfectly = (start: ShiftState): ShiftState => {
  const rung = ringUp(start)
  const told = reduce(rung, { kind: 'announce', amount: customerTotal(rung.customer) })
  return reduce(payExact(told), { kind: 'confirm' })
}

/**
 * A representative event for each kind in the union.
 *
 * Extracted from the loop that exercises every kind: the payload-carrying
 * kinds need distinct shapes, and building them here keeps that dispatch out
 * of the test body.
 */
const sampleEvent = (kind: (typeof EVENT_KIND_ORDER)[number]): ShiftEvent => {
  switch (kind) {
    case 'give':
    case 'take-back': {
      return { kind, denom: 100 }
    }
    case 'announce': {
      return { kind, amount: 500 }
    }
    case 'pick-slot': {
      return { kind, slot: 3 }
    }
    case 'sweep': {
      return { kind, item: 0, to: { x: 0.9, y: 0.5 } }
    }
    case 'look': {
      return { kind, at: 'clock' }
    }
    case 'resolve': {
      return { kind, how: 'ask-manager' }
    }
    case 'tick': {
      return { kind, deltaMs: 16 }
    }
    case 'restart': {
      return { kind, seed: 2, shift: 2 }
    }
    case 'restock': {
      return { kind, item: 'melonpan' }
    }
    case 'clean': {
      return { kind, id: 1 }
    }
    default: {
      return { kind }
    }
  }
}

const play = (): ShiftState => {
  let state = createShift(1)
  for (let n = 0; n < 20; n += 1) {
    state = servePerfectly(state)
    state = reduce(state, { kind: 'tick', deltaMs: 3000 })
  }
  return state
}

// A perfect run scores the same on any seed — what a seed changes is who
// walks in and what they owe, so that is what this asserts.
const baskets = (seed: number): string => {
  let state = createShift(seed)
  const owed: number[] = []
  for (let n = 0; n < 20; n += 1) {
    owed.push(changeOwed(scanAll(state)))
    state = servePerfectly(state)
  }
  return owed.join(',')
}

/**
 * A shift whose first customer wants cigarettes, at the given tier.
 */
const cigShift = (shiftNo: number): ShiftState => {
  let seed = 1
  while (createShift(seed, shiftNo).customer.cigarette === undefined) {
    seed += 1
  }
  return createShift(seed, shiftNo)
}

const changing = (): ShiftState => {
  let seed = 1
  while (createShift(seed).customer.cigarette !== undefined) {
    seed += 1
  }
  // Through the announcement, which is what puts their money on the counter.
  const rung = scanAll(createShift(seed))
  return reduce(rung, { kind: 'announce', amount: customerTotal(rung.customer) })
}


/**
 * A shift whose drawer has been stripped of everything but big notes, so the
 * change genuinely cannot be made.
 */
const stuck = (): ShiftState => {
  const bigNotesOnly = { ...EMPTY_PURSE, 10_000: 2, 5000: 2, 1000: 2 }
  return { ...changing(), drawer: bigNotesOnly, drawerAtTender: bigNotesOnly }
}

/**
 * A shift whose first customer wants cigarettes AND carries the given ID.
 */
const cigShiftWithOutcome = (from: number, outcome: IdOutcome): ShiftState => {
  let seed = from
  while (seed < from + 400) {
    const state = createShift(seed)
    if (state.customer.cigarette !== undefined && state.customer.idCard.outcome === outcome) {
      return state
    }
    seed += 1
  }
  throw new Error(`no ${outcome} cigarette customer near seed ${String(from)}`)
}

/**
 * Serves a customer through to confirm, checking their ID on the way.
 */
const serveWithId = (start: ShiftState): ShiftState =>
  servePerfectly(reduce(start, { kind: 'ask-id' }))

/**
 * The same, but never looking at the ID at all.
 */
const serveWithoutId = (start: ShiftState): ShiftState => servePerfectly(start)

/**
 * A shift whose first customer wants cigarettes, so the basket needs an ID.
 */
const restricted = (): ShiftState => cigShift(1)

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
    const state = scanAll(cigShift(1))
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
    const state = scanAll(cigShift(1))
    const wanted = CIGARETTES[state.customer.cigarette?.cigarette ?? 'echo'].slot
    const wrong = wanted === 3 ? 5 : 3
    const after = reduce(state, { kind: 'pick-slot', slot: wrong })
    expect(after.tally.wrongBrand).toBe(1)
    // You still put a packet down — the wrong one, which is the mistake.
    expect(after.phase).toBe('scanning')
    expect(after.onCounter).toHaveLength(state.onCounter.length + 1)
  })

  it('counts an empty slot as wrong', () => {
    const state = scanAll(cigShift(1))
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

describe('counting out change', () => {

  it('adds and removes denominations from the tray', () => {
    let state = reduce(changing(), { kind: 'give', denom: 100 })
    expect(state.tray[100]).toBe(1)
    state = reduce(state, { kind: 'take-back', denom: 100 })
    expect(state.tray[100]).toBe(0)
  })

  it('will not refund a piece that is not in the tray', () => {
    const state = changing()
    expect(reduce(state, { kind: 'take-back', denom: 500 })).toStrictEqual(state)
  })

  // The two ways of getting it wrong behave nothing alike, which is the whole
  // point of naming them separately.
  it('tells you the amount when you short-change the customer', () => {
    const ready = changing()
    const owed = changeOwed(ready)
    // Hand over one ¥10 coin less than the correct change: pull it back to
    // your own side before saying "that's everything".
    let state = payExact(ready)
    state = reduce(state, { kind: 'take-back', denom: 10 })
    const after = reduce(state, { kind: 'confirm' })
    expect(after.message).toContain('short')
    expect(after.message).toContain('They counted it')
    expect(after.tally.drawerDelta).toBe(10)
    expect(owed).toBeGreaterThan(0)
  })

  it('says nothing to the customer when you overpay, but books the loss', () => {
    const ready = changing()
    // Hand over one ¥10 coin more than the correct change: the customer is
    // delighted and silent, and the drawer is the thing that suffers.
    const state = reduce(payExact(ready), { kind: 'give', denom: 10 })
    const after = reduce(state, { kind: 'confirm' })
    expect(after.message).toContain('took it and left')
    expect(after.message).toContain('drawer is')
    expect(after.message).toContain('¥10')
    expect(after.tally.drawerDelta).toBe(-10)
  })

  it('ignores a value that is not a real denomination', () => {
    const state = changing()
    expect(reduce(state, { kind: 'give', denom: 3 })).toStrictEqual(state)
  })

  it('ignores coins outside the changing phase', () => {
    const state = createShift(1)
    expect(reduce(state, { kind: 'give', denom: 100 })).toStrictEqual(state)
    expect(reduce(state, { kind: 'take-back', denom: 100 })).toStrictEqual(state)
  })

  it('will not confirm before everything is rung up', () => {
    const state = createShift(1)
    expect(reduce(state, { kind: 'confirm' })).toStrictEqual(state)
  })

  it('will not confirm a part-scanned basket even in the changing phase', () => {
    // Reach `changing` legitimately, then rewind the scan count: this is the
    // "not everything rung up" guard rather than the phase guard.
    const partial: ShiftState = { ...changing(), scanned: 0 }
    expect(reduce(partial, { kind: 'confirm' }).tally.served).toBe(0)
  })

  it('will not confirm with the cigarette request outstanding', () => {
    let seed = 1
    while (createShift(seed).customer.cigarette === undefined) {
      seed += 1
    }
    const atShelf = scanAll(createShift(seed))
    expect(reduce(atShelf, { kind: 'confirm' }).tally.served).toBe(0)
  })

  it('banks exact change and moves to the next customer', () => {
    const state = reduce(payExact(changing()), { kind: 'confirm' })
    expect(state.tally.served).toBe(1)
    expect(state.tally.exactChange).toBe(1)
    expect(state.customer.id).toBe(2)
    expect(state.tray).toStrictEqual(EMPTY_PURSE)
    expect(state.phase).toBe('scanning')
  })

  it('flags sloppy-but-correct change', () => {
    let state = changing()
    const owed = changeOwed(state)
    // Correct money, needlessly many pieces: pay the ¥100s in ¥10 coins.
    const hundreds = Math.floor(owed / 100)
    for (let n = 0; n < hundreds * 10; n += 1) {
      state = reduce(state, { kind: 'give', denom: 10 })
    }
    let left = owed - hundreds * 100
    for (const denom of [50, 10, 5, 1] as const) {
      while (left >= denom) {
        state = reduce(state, { kind: 'give', denom })
        left -= denom
      }
    }
    expect(purseValue(state.tray)).toBe(owed)
    const after = reduce(state, { kind: 'confirm' })
    expect(after.tally.exactChange).toBe(1)
    expect(after.tally.sloppyChange).toBe(1)
    expect(after.message).toContain('too many')
  })

  it('will not let you hand over a coin the drawer does not have', () => {
    // The whole point of a finite till: you work with what is in it.
    let state = changing()
    const ones = state.drawer[1]
    for (let n = 0; n < ones; n += 1) {
      state = reduce(state, { kind: 'give', denom: 1 })
    }
    expect(state.drawer[1]).toBe(0)
    // One more is refused outright rather than conjuring a coin.
    const blocked = reduce(state, { kind: 'give', denom: 1 })
    expect(blocked).toStrictEqual(state)
  })

  it('conserves money: every piece in the tray came out of the drawer', () => {
    let state = changing()
    const before = purseValue(state.drawer)
    for (const denom of [500, 100, 100, 10, 1] as const) {
      state = reduce(state, { kind: 'give', denom })
    }
    expect(purseValue(state.drawer) + purseValue(state.tray)).toBe(before)
    // And putting one back is the exact inverse.
    const returned = reduce(state, { kind: 'take-back', denom: 500 })
    expect(purseValue(returned.drawer) + purseValue(returned.tray)).toBe(before)
    expect(returned.drawer[500]).toBe(state.drawer[500] + 1)
  })

  it('takes the customer cash into the drawer at confirm', () => {
    const ready = changing()
    const before = purseValue(ready.drawer)
    const owed = changeOwed(ready)
    const after = reduce(payExact(ready), { kind: 'confirm' })
    // Drawer gained what they paid and lost what was handed back.
    expect(purseValue(after.drawer)).toBe(before + tenderValue(ready.customer) - owed)
  })

  it('penalises wrong change and books the drawer', () => {
    const state = reduce(reduce(changing(), { kind: 'give', denom: 1 }), { kind: 'confirm' })
    expect(state.tally.wrongChange).toBe(1)
    expect(state.tally.drawerDelta).not.toBe(0)
    expect(state.tally.score).toBeLessThan(0)
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

describe('age checks', () => {
  it('does not mark anyone as checked until you ask', () => {
    expect(restricted().idShown).toBeUndefined()
  })

  it('shows you the card when you ask, and costs a moment', () => {
    const state = restricted()
    const after = reduce(state, { kind: 'ask-id' })
    expect(after.idShown).toBe(state.customer.idCard.outcome)
    expect(after.elapsedMs).toBe(state.elapsedMs + ID_CHECK_MS)
  })

  it('ignores a second look at the same card', () => {
    const once = reduce(restricted(), { kind: 'ask-id' })
    expect(reduce(once, { kind: 'ask-id' })).toStrictEqual(once)
  })

  it('never tells you what to do with what it shows you', () => {
    const after = reduce(restricted(), { kind: 'ask-id' })
    expect(after.message).not.toMatch(/refuse|should/i)
  })

  it('lets some customers take offence at being asked', () => {
    let seed = 1
    let state = createShift(seed)
    while (!state.customer.idCard.willArgue && seed < 200) {
      seed += 1
      state = createShift(seed)
    }
    expect(reduce(state, { kind: 'ask-id' }).message).toContain('Seriously?')
  })

  it('rewards refusing someone who cannot prove their age', () => {
    let seed = 1
    let state = createShift(seed)
    while (isSaleLegal(state.customer.idCard.outcome) && seed < 200) {
      seed += 1
      state = createShift(seed)
    }
    const after = reduce(reduce(state, { kind: 'ask-id' }), { kind: 'refuse-sale' })
    expect(after.tally.score).toBe(ID_SCORE.refusedCorrectly)
    expect(after.tally.served).toBe(1)
  })

  it('charges a little for turning away someone who was fine', () => {
    let seed = 1
    let state = createShift(seed)
    while (!isSaleLegal(state.customer.idCard.outcome) && seed < 200) {
      seed += 1
      state = createShift(seed)
    }
    const after = reduce(reduce(state, { kind: 'ask-id' }), { kind: 'refuse-sale' })
    expect(after.tally.score).toBe(ID_SCORE.refusedWrongly)
  })

  it('judges a refusal on the real card even if you never looked', () => {
    // Turning someone away on a hunch still gets graded against the truth —
    // you were right or you were not, whether or not you checked.
    const state = cigShiftWithOutcome(1, 'underage')
    const blind = reduce(state, { kind: 'refuse-sale' })
    const checked = reduce(reduce(state, { kind: 'ask-id' }), { kind: 'refuse-sale' })
    expect(blind.tally.score).toBe(checked.tally.score)
    expect(blind.tally.score).toBe(ID_SCORE.refusedCorrectly)
  })

  it('moves to the next customer after a refusal', () => {
    const state = restricted()
    const after = reduce(state, { kind: 'refuse-sale' })
    expect(after.customer.id).toBe(state.customer.id + 1)
    expect(after.phase).toBe('scanning')
  })

  it('charges heavily for selling to someone underage', () => {
    // Compared against the same sale to someone old enough: the change and
    // speed points are identical, so the gap is exactly the ID call.
    const underage = serveWithId(cigShiftWithOutcome(1, 'underage'))
    const legal = serveWithId(cigShiftWithOutcome(1, 'valid'))
    expect(underage.tally.score).toBeLessThan(legal.tally.score)
    expect(legal.tally.score - underage.tally.score).toBe(
      ID_SCORE.soldLegally - ID_SCORE.soldUnderage,
    )
  })

  it('charges for skipping the check on a restricted basket', () => {
    // Same customer, same money: the only difference is having looked.
    const state = cigShiftWithOutcome(1, 'valid')
    const withCheck = serveWithId(state)
    const without = serveWithoutId(state)
    expect(without.tally.score).toBeLessThan(withCheck.tally.score)
    expect(without.tally.score).toBeLessThan(0)
  })

  it('does not ask for ID on an ordinary basket', () => {
    let seed = 1
    let state = createShift(seed)
    while (requiresIdCheck(state.customer) && seed < 200) {
      seed += 1
      state = createShift(seed)
    }
    expect(requiresIdCheck(state.customer)).toBe(false)
  })

  it('is inert once the shift has closed', () => {
    const closed = reduce(createShift(1), { kind: 'tick', deltaMs: SHIFT_MS })
    expect(reduce(closed, { kind: 'ask-id' })).toStrictEqual(closed)
    expect(reduce(closed, { kind: 'refuse-sale' })).toStrictEqual(closed)
  })
})

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
 * Rings a seeded shift all the way up to the point of saying a price.
 */
const scanAllThrough = (seed: number): ShiftState => ringUp(createShift(seed))

/**
 * A customer who is listening, and one who is not. Both are needed: the whole
 * mechanic is that you cannot tell which you have until afterwards.
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

/**
 * A shift where the clerk has walked out to the stockroom.
 */
const outBack = (): ShiftState => reduce(createShift(1), { kind: 'look', at: 'stockroom' })

/**
 * A shift whose first customer wants something the shop has run out of.
 */
const wanting = (): ShiftState => {
  const fresh = createShift(1)
  const [line] = fresh.customer.basket
  if (line === undefined) {
    throw new Error('seed 1 customer should have a basket')
  }
  return { ...fresh, stock: { ...FULL_SHELF, [line.item]: 0 } }
}

describe('restocking', () => {
  it('puts more of an item on the shelf', () => {
    const emptied: ShiftState = { ...outBack(), stock: { ...FULL_SHELF, melonpan: 0 } }
    const after = reduce(emptied, { kind: 'restock', item: 'melonpan' })
    expect(after.stock.melonpan).toBe(RESTOCK_PER_TRIP)
    expect(after.tally.restocked).toBe(1)
  })

  it('costs time you are not at the till', () => {
    // The whole cost of the mechanic: the person at the counter is waiting.
    const emptied: ShiftState = { ...outBack(), stock: { ...FULL_SHELF, melonpan: 0 } }
    const after = reduce(emptied, { kind: 'restock', item: 'melonpan' })
    expect(after.frozenUntilMs).toBe(after.elapsedMs + RESTOCK_MS)
  })

  it('says so rather than wasting a trip on a full shelf', () => {
    const after = reduce(outBack(), { kind: 'restock', item: 'melonpan' })
    expect(after.stock.melonpan).toBe(SHELF_CAPACITY)
    expect(after.tally.restocked).toBe(0)
    expect(after.message).toContain('already full')
  })

  it('only works out back', () => {
    // Walking off to the stockroom is a thing you do *instead* of standing at
    // the counter, so it cannot be done from the counter.
    const atCounter: ShiftState = { ...createShift(1), stock: { ...FULL_SHELF, melonpan: 0 } }
    expect(reduce(atCounter, { kind: 'restock', item: 'melonpan' })).toStrictEqual(atCounter)
  })

  it('cannot be done while frozen', () => {
    const emptied: ShiftState = {
      ...outBack(),
      stock: { ...FULL_SHELF, melonpan: 0 },
      frozenUntilMs: 9_999_999,
    }
    expect(reduce(emptied, { kind: 'restock', item: 'melonpan' })).toStrictEqual(emptied)
  })

  it('cannot be done mid-transaction', () => {
    // Nobody walks out back holding a customer's money.
    const mid: ShiftState = {
      ...changing(),
      gaze: 'stockroom',
      stock: { ...FULL_SHELF, melonpan: 0 },
    }
    expect(reduce(mid, { kind: 'restock', item: 'melonpan' })).toStrictEqual(mid)
  })
})

describe('running out of stock', () => {
  it('knows what the shop cannot supply', () => {
    const state = wanting()
    expect(missingFromBasket(state).length).toBeGreaterThan(0)
  })

  it('sends the customer away and counts the lost sale', () => {
    const before = wanting()
    const after = reduce(before, { kind: 'turn-away' })
    expect(after.tally.lostSales).toBe(1)
    expect(after.message).toContain('we’re out of')
    // They leave, and the next one steps up.
    expect(after.customer.id).toBe(before.customer.id + 1)
  })

  it('takes no money for a sale that never happened', () => {
    const after = reduce(wanting(), { kind: 'turn-away' })
    expect(after.takings).toBe(0)
    expect(after.tally.served).toBe(0)
  })

  it('does nothing when everything wanted is in stock', () => {
    const stocked = createShift(1)
    expect(reduce(stocked, { kind: 'turn-away' })).toStrictEqual(stocked)
  })

  it('depletes the shelf when a sale completes', () => {
    const fresh = createShift(1)
    const [line] = fresh.customer.basket
    if (line === undefined) {
      throw new Error('seed 1 customer should have a basket')
    }
    const sold = servePerfectly(fresh)
    expect(sold.stock[line.item]).toBe(SHELF_CAPACITY - line.qty)
  })
})

/**
 * A shift run forward far enough that something has been dropped.
 */
const dirty = (count = 1): ShiftState => {
  let state = createShift(1)
  while (state.messes.length < count) {
    state = reduce(state, { kind: 'tick', deltaMs: MESS_INTERVAL_MS })
  }
  return state
}

describe('mess and cleaning', () => {
  it('drops something eventually, without being asked', () => {
    // Nobody tells you to clean; that is the whole reason the job slides.
    expect(dirty().messes.length).toBeGreaterThan(0)
  })

  it('does not drop anything in the first moments of a shift', () => {
    const fresh = reduce(createShift(1), { kind: 'tick', deltaMs: 100 })
    expect(fresh.messes).toStrictEqual([])
  })

  it('wipes up the one you clicked', () => {
    const state = dirty(2)
    const [first] = state.messes
    if (first === undefined) {
      throw new Error('expected a mess')
    }
    const after = reduce(state, { kind: 'clean', id: first.id })
    expect(after.messes).toHaveLength(state.messes.length - 1)
    expect(after.messes.some((mess) => mess.id === first.id)).toBe(false)
    expect(after.tally.cleaned).toBe(1)
  })

  it('costs a moment, but less than a trip out back', () => {
    const state = dirty()
    const [first] = state.messes
    if (first === undefined) {
      throw new Error('expected a mess')
    }
    const after = reduce(state, { kind: 'clean', id: first.id })
    expect(after.frozenUntilMs).toBe(after.elapsedMs + CLEAN_MS)
    expect(CLEAN_MS).toBeLessThan(RESTOCK_MS)
  })

  it('ignores a mess that is not there', () => {
    const state = dirty()
    expect(reduce(state, { kind: 'clean', id: 9999 })).toStrictEqual(state)
  })

  it('cannot be done while frozen', () => {
    const state = dirty()
    const [first] = state.messes
    if (first === undefined) {
      throw new Error('expected a mess')
    }
    const busy: ShiftState = { ...state, frozenUntilMs: 9_999_999 }
    expect(reduce(busy, { kind: 'clean', id: first.id })).toStrictEqual(busy)
  })

  it('keeps mess generation inside the seeded replay', () => {
    // Where a spill lands must come from the state rng, not a wall clock, or
    // the same seed stops reproducing the same shift.
    const a = dirty(3)
    const b = dirty(3)
    expect(JSON.stringify(a.messes)).toBe(JSON.stringify(b.messes))
  })
})
