/**
 * The shift: one pure reducer over a closed event union.
 *
 * Nothing here reads a clock or an rng directly — the tick delta arrives as
 * an argument and the generator lives in state — so a seeded shift replays
 * byte-identically. That is what makes the whole thing testable, and it is
 * enforced by the `no-restricted-properties` lint ban.
 *
 * Each event arm is its own small function and `reduce` is a thin dispatcher,
 * which keeps every branch individually reachable from a test.
 */

import { CIGARETTES, SLOT_TO_CIGARETTE } from './catalog'
import { customerTotal, makeCustomer, tenderValue } from './customer'
import { addDenom, type Denom, DENOMS, EMPTY_PURSE, type Purse, removeDenom } from './money'
import { createRng, type Rng } from './rng'
import { gradeChange, parMs, speedPoints } from './score'
import { type ShelfSpec, shelfSpecForShift } from './shelf'
import { EMPTY_TALLY, type Customer, type Phase, type ShiftEvent, type ShiftTally } from './types'

/**
 * How long one shift runs, in milliseconds.
 */
export const SHIFT_MS = 180_000

export interface ShiftState {
  readonly phase: Phase
  readonly shift: number
  readonly shelf: ShelfSpec
  readonly rng: Rng
  readonly customer: Customer
  /**
   * Items rung up so far.
   */
  readonly scanned: number
  /**
   * Whether the cigarette request has been satisfied.
   */
  readonly shelfDone: boolean
  /**
   * Whether the lookup chart is open.
   */
  readonly lookupOpen: boolean
  /**
   * Change counted out so far.
   */
  readonly tray: Purse
  readonly elapsedMs: number
  /**
   * When the current customer stepped up.
   */
  readonly customerStartMs: number
  /**
   * Frozen until this timestamp, after using the lookup chart.
   */
  readonly frozenUntilMs: number
  readonly tally: ShiftTally
  /**
   * Most recent feedback line, for the UI.
   */
  readonly message: string
}

/**
 * Total items the current customer wants rung up.
 */
export const lineCount = (customer: Customer): number => {
  let count = 0
  for (const line of customer.basket) {
    count += line.qty
  }
  return count
}

/**
 * Starts a shift. `shift` is 1-based and drives the shelf escalation.
 */
export const createShift = (seed: number, shift = 1): ShiftState => {
  const rng = createRng(seed)
  const shelf = shelfSpecForShift(shift)
  return {
    phase: 'scanning',
    shift,
    shelf,
    rng,
    customer: makeCustomer(rng, 1, shelf),
    scanned: 0,
    shelfDone: false,
    lookupOpen: false,
    tray: EMPTY_PURSE,
    elapsedMs: 0,
    customerStartMs: 0,
    frozenUntilMs: 0,
    tally: EMPTY_TALLY,
    message: 'Ring up the items.',
  }
}

/**
 * Yen still owed to the customer.
 */
export const changeOwed = (state: ShiftState): number =>
  tenderValue(state.customer) - customerTotal(state.customer)

/**
 * Whether every item is scanned and any cigarette request is handled.
 */
const canTender = (state: ShiftState): boolean => {
  if (state.scanned < lineCount(state.customer)) {
    return false
  }
  return state.customer.cigarette === undefined || state.shelfDone
}

/**
 * Whether the lookup chart currently has the player frozen.
 */
const isFrozen = (state: ShiftState): boolean => state.frozenUntilMs > state.elapsedMs

/**
 * Moves to the next customer, folding the finished one into the tally.
 *
 * The generator is copied before it is drawn from, never advanced in place.
 * `Rng` is a mutable object, so reusing the caller's would make `reduce`
 * mutate its own input — the same state reduced twice would yield different
 * customers, and React's StrictMode (which double-invokes reducers in dev)
 * would silently desync dev from prod.
 */
const advance = (state: ShiftState, tally: ShiftTally, message: string): ShiftState => {
  const rng: Rng = { s: state.rng.s }
  return {
    ...state,
    phase: 'scanning',
    rng,
    customer: makeCustomer(rng, state.customer.id + 1, state.shelf),
    scanned: 0,
    shelfDone: false,
    lookupOpen: false,
    tray: EMPTY_PURSE,
    customerStartMs: state.elapsedMs,
    tally,
    message,
  }
}

const isDenom = (value: number): value is Denom => {
  for (const denom of DENOMS) {
    if (denom === value) {
      return true
    }
  }
  return false
}

const onTick = (state: ShiftState, deltaMs: number): ShiftState => {
  const elapsedMs = state.elapsedMs + deltaMs
  if (elapsedMs >= SHIFT_MS) {
    return { ...state, elapsedMs: SHIFT_MS, phase: 'closed', message: 'Shift over.' }
  }
  return { ...state, elapsedMs }
}

const onScan = (state: ShiftState): ShiftState => {
  const total = lineCount(state.customer)
  if (isFrozen(state) || state.scanned >= total) {
    return state
  }
  const scanned = state.scanned + 1
  if (scanned < total) {
    return { ...state, scanned }
  }
  if (state.customer.cigarette !== undefined && !state.shelfDone) {
    return { ...state, scanned, phase: 'shelf', message: 'Cigarettes — pick the slot.' }
  }
  return { ...state, scanned, phase: 'changing', message: 'Count out the change.' }
}

const onPickSlot = (state: ShiftState, slot: number): ShiftState => {
  const wanted = state.customer.cigarette
  if (wanted === undefined || state.phase !== 'shelf' || isFrozen(state)) {
    return state
  }
  const isRight = SLOT_TO_CIGARETTE.get(slot) === wanted.cigarette
  const label = CIGARETTES[wanted.cigarette].label
  return {
    ...state,
    phase: 'changing',
    shelfDone: true,
    lookupOpen: false,
    tally: isRight ? state.tally : { ...state.tally, wrongBrand: state.tally.wrongBrand + 1 },
    message: isRight ? 'Right one. Now the change.' : `That's not ${label}. Now the change.`,
  }
}

const onUseLookup = (state: ShiftState): ShiftState => {
  if (state.shelf.mode === 'labelled' || state.lookupOpen) {
    return state
  }
  return {
    ...state,
    lookupOpen: true,
    frozenUntilMs: state.elapsedMs + state.shelf.lookupFreezeMs,
    tally: {
      ...state.tally,
      lookupsUsed: state.tally.lookupsUsed + 1,
      score: state.tally.score - state.shelf.lookupPenalty,
    },
    message: 'Checking the chart…',
  }
}

const onGive = (state: ShiftState, denom: number): ShiftState => {
  if (state.phase !== 'changing' || !isDenom(denom)) {
    return state
  }
  return { ...state, tray: addDenom(state.tray, denom) }
}

const onTakeBack = (state: ShiftState, denom: number): ShiftState => {
  if (state.phase !== 'changing' || !isDenom(denom)) {
    return state
  }
  return { ...state, tray: removeDenom(state.tray, denom) }
}

/**
 * Feedback line for a graded transaction.
 */
const confirmMessage = (isCorrect: boolean, surplusCoins: number): string => {
  if (!isCorrect) {
    return 'Wrong change. They noticed.'
  }
  if (surplusCoins > 0) {
    return `Right, but ${String(surplusCoins)} coin(s) too many.`
  }
  return 'Exact. Next.'
}

const onConfirm = (state: ShiftState): ShiftState => {
  if (state.phase !== 'changing' || !canTender(state)) {
    return state
  }
  const grade = gradeChange(state.tray, changeOwed(state))
  const par = parMs(lineCount(state.customer), state.customer.cigarette !== undefined)
  const speed = grade.correct ? speedPoints(state.elapsedMs - state.customerStartMs, par) : 0
  const tally: ShiftTally = {
    ...state.tally,
    served: state.tally.served + 1,
    exactChange: state.tally.exactChange + (grade.correct ? 1 : 0),
    wrongChange: state.tally.wrongChange + (grade.correct ? 0 : 1),
    sloppyChange: state.tally.sloppyChange + (grade.surplusCoins > 0 ? 1 : 0),
    drawerDelta: state.tally.drawerDelta + grade.drawerDelta,
    score: state.tally.score + grade.points + speed,
  }
  return advance(state, tally, confirmMessage(grade.correct, grade.surplusCoins))
}

/**
 * The reducer. Every arm of {@link ShiftEvent} is dispatched explicitly;
 * `noFallthroughCasesInSwitch` keeps it honest.
 */
export const reduce = (state: ShiftState, event: ShiftEvent): ShiftState => {
  // Restart is the one event that must work on a closed shift.
  if (event.kind === 'restart') {
    return createShift(event.seed, event.shift)
  }
  if (state.phase === 'closed') {
    return state
  }
  switch (event.kind) {
    case 'tick': {
      return onTick(state, event.deltaMs)
    }
    case 'scan': {
      return onScan(state)
    }
    case 'pick-slot': {
      return onPickSlot(state, event.slot)
    }
    case 'use-lookup': {
      return onUseLookup(state)
    }
    case 'give': {
      return onGive(state, event.denom)
    }
    case 'take-back': {
      return onTakeBack(state, event.denom)
    }
    case 'confirm': {
      return onConfirm(state)
    }
  }
}
