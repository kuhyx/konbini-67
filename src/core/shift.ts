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
import {
  addDenom,
  type Denom,
  DENOMS,
  EMPTY_PURSE,
  formatYen,
  mergePurses,
  OPENING_FLOAT,
  type Purse,
  removeDenom,
} from './money'
import { createRng, type Rng } from './rng'
import { type ChangeGrade, gradeChange, parMs, speedPoints } from './score'
import { type ShelfSpec, shelfSpecForShift } from './shelf'
import {
  EMPTY_TALLY,
  type Customer,
  GAZE,
  type Gaze,
  type Phase,
  type ShiftEvent,
  type ShiftTally,
} from './types'

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
   * Where the clerk is looking. Anything but `counter` hides the customer.
   */
  readonly gaze: Gaze
  /**
   * Change counted out so far, physically taken from the drawer.
   */
  readonly tray: Purse
  /**
   * What is actually in the till.
   *
   * Money is conserved: every piece in `tray` came out of here, and a
   * customer's cash goes in at confirm. You work with what you have.
   */
  readonly drawer: Purse
  /**
   * The drawer as it stood when this customer's change became owed.
   *
   * Grading needs a fixed reference: the live drawer shrinks as the player
   * counts, so scoring against it would make a clumsy grab look better the
   * more it took.
   */
  readonly drawerAtTender: Purse
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
    gaze: 'counter',
    tray: EMPTY_PURSE,
    drawer: OPENING_FLOAT,
    drawerAtTender: OPENING_FLOAT,
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
    gaze: 'counter',
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
  return {
    ...state,
    scanned,
    phase: 'changing',
    drawerAtTender: state.drawer,
    message: 'Count out the change.',
  }
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
    gaze: 'counter',
    drawerAtTender: state.drawer,
    tally: isRight ? state.tally : { ...state.tally, wrongBrand: state.tally.wrongBrand + 1 },
    message: isRight ? 'Right one. Now the change.' : `That's not ${label}. Now the change.`,
  }
}

/**
 * Turns the clerk's head.
 *
 * Costs nothing but the time it takes — a real clerk is not fined for glancing
 * at the clock. The cost is that the shift keeps running while the customer is
 * out of view, so whatever you looked away to find, you had better remember.
 */
const onLook = (state: ShiftState, at: Gaze): ShiftState => {
  if (isFrozen(state) || state.gaze === at) {
    return state
  }
  return { ...state, gaze: at, message: GAZE[at].label }
}

const onUseLookup = (state: ShiftState): ShiftState => {
  if (state.shelf.mode === 'labelled' || state.gaze === 'notebook') {
    return state
  }
  return {
    ...state,
    gaze: 'notebook',
    frozenUntilMs: state.elapsedMs + state.shelf.lookupFreezeMs,
    tally: {
      ...state.tally,
      lookupsUsed: state.tally.lookupsUsed + 1,
      score: state.tally.score - state.shelf.lookupPenalty,
    },
    message: 'Checking the chart…',
  }
}

/**
 * Picks one piece out of the drawer and into your hand.
 *
 * Refuses when the drawer has none left: you cannot hand over a coin that is
 * not there, and that shortage is the whole point of a finite till.
 */
const onGive = (state: ShiftState, denom: number): ShiftState => {
  if (state.phase !== 'changing' || !isDenom(denom) || state.drawer[denom] === 0) {
    return state
  }
  return {
    ...state,
    tray: addDenom(state.tray, denom),
    drawer: removeDenom(state.drawer, denom),
  }
}

/**
 * Puts a piece back in the drawer. The exact inverse of {@link onGive}.
 */
const onTakeBack = (state: ShiftState, denom: number): ShiftState => {
  if (state.phase !== 'changing' || !isDenom(denom) || state.tray[denom] === 0) {
    return state
  }
  return {
    ...state,
    tray: removeDenom(state.tray, denom),
    drawer: addDenom(state.drawer, denom),
  }
}

/**
 * Feedback line for a graded transaction.
 *
 * A wrong total is not one mistake but two, and they behave nothing alike:
 *
 * - **Short-changed the customer** (`drawerDelta > 0`). They count it, they
 *   notice, they say so. You are told the amount because they would tell you.
 * - **Overpaid the customer** (`drawerDelta < 0`). Nobody in the history of
 *   retail has handed money back. The customer leaves happy and the *shop* is
 *   short — which is why it surfaces silently here and lands in the books at
 *   the end of the shift rather than being announced at the counter.
 */
const confirmMessage = (grade: ChangeGrade): string => {
  if (grade.drawerDelta > 0) {
    return `You're ${formatYen(grade.drawerDelta)} short. They counted it.`
  }
  if (grade.drawerDelta < 0) {
    return `They took it and left. The drawer is ${formatYen(-grade.drawerDelta)} down.`
  }
  if (grade.surplusCoins > 0) {
    return `Right, but ${String(grade.surplusCoins)} coin(s) too many.`
  }
  return 'Exact. Next.'
}

const onConfirm = (state: ShiftState): ShiftState => {
  if (state.phase !== 'changing' || !canTender(state)) {
    return state
  }
  const grade = gradeChange(state.tray, changeOwed(state), state.drawerAtTender)
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
  // The customer's cash goes into the till. The tray has already been taken
  // out of it piece by piece, so this closes the loop: money is conserved.
  const drawer = mergePurses(state.drawer, state.customer.tender)
  return advance({ ...state, drawer }, tally, confirmMessage(grade))
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
    case 'look': {
      return onLook(state, event.at)
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
