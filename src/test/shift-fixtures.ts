/**
Shared drivers for the shift reducer tests: play a customer through.
*/

import { CIGARETTES } from '../core/catalog'
import { DENOMS, EMPTY_PURSE, greedyChange } from '../core/money'
import type { IdOutcome } from '../core/id-check'
import { changeOwed, createShift, lineCount, reduce, type ShiftState } from '../core/shift'
import { customerTotal } from '../core/customer'
import type { EVENT_KIND_ORDER, ShiftEvent } from '../core/types'

/**
Rings up everything currently lying on the counter.

Stops of its own accord when the scanning phase ends — either because the
basket is done or because the customer's cigarette request interrupts.
*/
export const scanAll = (start: ShiftState): ShiftState => {
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
How many things the customer physically put down.

One short of {@link lineCount} when cigarettes are wanted: that packet is
behind the counter until the clerk turns round and fetches it.
*/
export const basketOnly = (state: ShiftState): number =>
  lineCount(state.customer) - (state.customer.cigarette === undefined ? 0 : 1)

/**
Hands over the fewest-coins correct change.
*/
export const payExact = (start: ShiftState): ShiftState => {
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
Rings up everything, fetching the cigarettes when asked.
*/
export const ringUp = (start: ShiftState): ShiftState => {
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
Plays one customer perfectly: scan, right slot, announce, exact change.
*/
export const servePerfectly = (start: ShiftState): ShiftState => {
  const rung = ringUp(start)
  const told = reduce(rung, { kind: 'announce', amount: customerTotal(rung.customer) })
  return reduce(payExact(told), { kind: 'confirm' })
}

/**
A representative event for each kind in the union.

Extracted from the loop that exercises every kind: the payload-carrying
kinds need distinct shapes, and building them here keeps that dispatch out
of the test body.
*/
export const sampleEvent = (kind: (typeof EVENT_KIND_ORDER)[number]): ShiftEvent => {
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
    case 'clean':
    case 'take-out': {
      return { kind, id: 1 }
    }
    case 'cook': {
      return { kind, what: 'coffee' }
    }
    default: {
      return { kind }
    }
  }
}

export const play = (): ShiftState => {
  let state = createShift(1)
  for (let n = 0; n < 20; n += 1) {
    state = servePerfectly(state)
    state = reduce(state, { kind: 'tick', deltaMs: 3000 })
  }
  return state
}

// A perfect run scores the same on any seed — what a seed changes is who
// walks in and what they owe, so that is what this asserts.
export const baskets = (seed: number): string => {
  let state = createShift(seed)
  const owed: number[] = []
  for (let n = 0; n < 20; n += 1) {
    owed.push(changeOwed(scanAll(state)))
    state = servePerfectly(state)
  }
  return owed.join(',')
}

/**
A shift whose first customer wants cigarettes, at the given tier.
*/
export const cigShift = (): ShiftState => {
  let seed = 1
  while (createShift(seed, 1).customer.cigarette === undefined) {
    seed += 1
  }
  return createShift(seed, 1)
}

export const changing = (): ShiftState => {
  let seed = 1
  while (createShift(seed).customer.cigarette !== undefined) {
    seed += 1
  }
  // Through the announcement, which is what puts their money on the counter.
  const rung = scanAll(createShift(seed))
  return reduce(rung, { kind: 'announce', amount: customerTotal(rung.customer) })
}

/**
A shift whose drawer has been stripped of everything but big notes, so the
change genuinely cannot be made.
*/
export const stuck = (): ShiftState => {
  const bigNotesOnly = { ...EMPTY_PURSE, 10_000: 2, 5000: 2, 1000: 2 }
  return { ...changing(), drawer: bigNotesOnly, drawerAtTender: bigNotesOnly }
}

/**
A shift whose first customer wants cigarettes AND carries the given ID.
*/
export const cigShiftWithOutcome = (outcome: IdOutcome): ShiftState => {
  let seed = 1
  while (seed < 401) {
    const state = createShift(seed)
    if (state.customer.cigarette !== undefined && state.customer.idCard.outcome === outcome) {
      return state
    }
    seed += 1
  }
  throw new Error(`no ${outcome} cigarette customer within 400 seeds`)
}

/**
Serves a customer through to confirm, checking their ID on the way.
*/
export const serveWithId = (start: ShiftState): ShiftState =>
  servePerfectly(reduce(start, { kind: 'ask-id' }))

/**
The same, but never looking at the ID at all.
*/
export const serveWithoutId = (start: ShiftState): ShiftState => servePerfectly(start)

/**
A shift whose first customer wants cigarettes, so the basket needs an ID.
*/
export const restricted = (): ShiftState => cigShift()
