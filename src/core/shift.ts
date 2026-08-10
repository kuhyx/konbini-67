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

import { CIGARETTES, type ItemId, SLOT_TO_CIGARETTE } from './catalog'
import { customerTotal, makeCustomer, tenderValue } from './customer'
import {
  addDenom,
  type Denom,
  DENOMS,
  EMPTY_PURSE,
  formatYen,
  MANAGER_FLOAT,
  mergePurses,
  OPENING_FLOAT,
  type Purse,
  removeDenom,
} from './money'
import {
  describeId,
  ID_CHECK_MS,
  ID_SCORE,
  idCheckPoints,
  type IdOutcome,
  isSaleLegal,
  requiresIdCheck,
} from './id-check'
import { didCrossLaser, type Placed, type Point, scatter } from './layout'
import { createRng, nextFloat, type Rng } from './rng'
import { type ChangeGrade, gradeChange, parMs, speedPoints } from './score'
import { type ShelfSpec, shelfSpecForShift } from './shelf'
import {
  EMPTY_TALLY,
  type Customer,
  GAZE,
  type Gaze,
  type Phase,
  type Resolution,
  RESOLUTIONS,
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
   * The basket as it physically sits on the counter, one entry per item.
   *
   * Scanning means sweeping one of these over the beam, so the loose goods
   * have to exist as things with positions rather than as a counter.
   */
  readonly onCounter: readonly Placed<ItemId>[]
  /**
   * The customer's cash, lying on the counter where they put it.
   *
   * A scattered pile rather than a total: counting it is the player's job,
   * which is the whole reason the TENDERED readout was removed.
   */
  readonly cashOnCounter: readonly Placed<Denom>[]
  /**
   * Whether the cigarette request has been satisfied.
   */
  readonly shelfDone: boolean
  /**
   * Where the clerk is looking. Anything but `counter` hides the customer.
   */
  readonly gaze: Gaze
  /**
   * Whether this customer has been asked to prove their age.
   *
   * Undefined means not asked — which on an age-restricted basket is itself
   * a decision, and a scored one.
   */
  readonly idShown: IdOutcome | undefined
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
  /**
   * The float the shift opened with, kept for the end-of-shift books.
   */
  readonly openingFloat: Purse
  /**
   * Yen that should have been taken in: every basket total rung up and paid
   * for. What the drawer *ought* to hold is this plus the opening float.
   */
  readonly takings: number
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
 * Where the customer's goods land when they put the basket down.
 */
const GOODS_AREA = { x: 0.05, y: 0.1, width: 0.35, height: 0.8 }

/**
 * Where the customer drops their money.
 */
const CASH_AREA = { x: 0.55, y: 0.15, width: 0.4, height: 0.5 }

/**
 * Spreads a purse out as individual coins and notes.
 */
const layOutCash = (rng: Rng, purse: Purse): readonly Placed<Denom>[] => {
  const loose: Denom[] = []
  for (const denom of DENOMS) {
    for (let n = 0; n < purse[denom]; n += 1) {
      loose.push(denom)
    }
  }
  return scatter(rng, loose, CASH_AREA)
}

/**
 * Lays a basket out on the counter, one loose item per unit of quantity.
 */
const layOutBasket = (rng: Rng, customer: Customer): readonly Placed<ItemId>[] => {
  const loose: ItemId[] = []
  for (const line of customer.basket) {
    for (let n = 0; n < line.qty; n += 1) {
      loose.push(line.item)
    }
  }
  return scatter(rng, loose, GOODS_AREA)
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
 *
 * `float` is the drawer it opens with — injectable so a test can start from a
 * till that cannot make change, which is otherwise reachable only by playing
 * a long way into a shift.
 */
export const createShift = (seed: number, shift = 1, float: Purse = OPENING_FLOAT): ShiftState => {
  const rng = createRng(seed)
  const shelf = shelfSpecForShift(shift)
  const customer = makeCustomer(rng, 1, shelf)
  return {
    phase: 'scanning',
    shift,
    shelf,
    rng,
    customer,
    onCounter: layOutBasket(rng, customer),
    cashOnCounter: layOutCash(rng, customer.tender),
    scanned: 0,
    shelfDone: false,
    gaze: 'counter',
    idShown: undefined,
    tray: EMPTY_PURSE,
    drawer: float,
    drawerAtTender: float,
    openingFloat: float,
    takings: 0,
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
  const customer = makeCustomer(rng, state.customer.id + 1, state.shelf)
  return {
    ...state,
    phase: 'scanning',
    rng,
    customer,
    onCounter: layOutBasket(rng, customer),
    cashOnCounter: layOutCash(rng, customer.tender),
    scanned: 0,
    shelfDone: false,
    gaze: 'counter',
    idShown: undefined,
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

/**
 * Sweeps one item across the counter.
 *
 * It rings up only if the sweep actually took it through the beam. Stopping
 * short is a miss, and a miss costs nothing but the second it took — you pick
 * the thing up and pass it again, exactly as at a real till. The item stays
 * where you left it either way.
 */
const onSweep = (state: ShiftState, item: number, to: Point): ShiftState => {
  const piece = state.onCounter[item]
  if (piece === undefined || isFrozen(state) || state.phase !== 'scanning') {
    return state
  }
  const moved = state.onCounter.map((each, index) =>
    index === item ? { ...each, at: to } : each,
  )
  if (!didCrossLaser(piece.at, to)) {
    return { ...state, onCounter: moved, message: 'No beep. Try again.' }
  }
  // A successful sweep takes the item off the counter and rings it up.
  const remaining = moved.filter((_, index) => index !== item)
  return { ...onScan({ ...state, onCounter: remaining }), onCounter: remaining }
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

/**
 * Yen the drawer is short of making this customer's change exactly.
 *
 * Zero when it can be made. Only ever a few yen in practice — it is the tail
 * of the amount that ran out of small coins.
 */
const shortfall = (state: ShiftState): number => {
  // The most the drawer can actually pay out toward what is owed. Greedy
  // gives exactly that: it takes the largest pieces that fit at every step,
  // so whatever is left over is the part no combination could cover — and it
  // naturally comes out at zero when the change can be made in full, so no
  // separate "can it?" guard is needed.
  let left = changeOwed(state)
  for (const denom of DENOMS) {
    left -= Math.min(Math.floor(left / denom), state.drawer[denom]) * denom
  }
  return left
}

/**
 * Talks your way out of a till that cannot make the change.
 *
 * Every option costs shift time, and the ones the customer can refuse draw
 * their answer from a copy of the generator — never a fresh source — so a
 * seeded shift still replays identically.
 */
const onResolve = (state: ShiftState, how: Resolution): ShiftState => {
  if (state.phase !== 'changing' || isFrozen(state)) {
    return state
  }
  const spec = RESOLUTIONS[how]
  const rng: Rng = { s: state.rng.s }
  const isAccepted = !spec.canRefuse || nextFloat(rng) < spec.acceptance
  const elapsedMs = state.elapsedMs + spec.costMs
  if (!isAccepted) {
    return {
      ...state,
      rng,
      elapsedMs,
      message: `${spec.line} They shake their head.`,
    }
  }
  if (how === 'ask-manager') {
    // A fresh roll of coins: back to a full float's worth of small change.
    return {
      ...state,
      rng,
      elapsedMs,
      drawer: mergePurses(state.drawer, MANAGER_FLOAT),
      message: `${spec.line} That is better.`,
    }
  }
  if (how === 'owe-the-coin') {
    // Settled short by the gap, with their blessing. The books will still
    // notice, which is the honest outcome — this is a known discrepancy
    // rather than a mistake you have to discover.
    const gap = shortfall(state)
    const tally: ShiftTally = {
      ...state.tally,
      served: state.tally.served + 1,
      drawerDelta: state.tally.drawerDelta + gap,
    }
    const drawer = mergePurses(state.drawer, state.customer.tender)
    const takings = state.takings + customerTotal(state.customer)
    return advance(
      { ...state, rng, elapsedMs, drawer, takings },
      tally,
      `${spec.line} They wave it off. ${formatYen(gap)} short in the books.`,
    )
  }
  // Card, or smaller money: the sale closes cleanly with no change at all.
  const tally: ShiftTally = { ...state.tally, served: state.tally.served + 1 }
  const drawer =
    how === 'offer-card' ? state.drawer : mergePurses(state.drawer, state.customer.tender)
  // Card money never touches the till, so it is not part of what the drawer
  // should hold at close — only cash sales count toward the books.
  const takings = state.takings + (how === 'offer-card' ? 0 : customerTotal(state.customer))
  return advance({ ...state, rng, elapsedMs, drawer, takings }, tally, `${spec.line} Sorted.`)
}

/**
 * Asks to see some ID.
 *
 * Costs a couple of seconds and, for the one customer in five who takes
 * offence, a moment of being told off. Asking is never the wrong call — the
 * argument is noise, not a signal.
 */
const onAskId = (state: ShiftState): ShiftState => {
  if (state.idShown !== undefined) {
    return state
  }
  const card = state.customer.idCard
  const line = card.willArgue
    ? '“Seriously? Do I look under twenty?” They hand it over anyway.'
    : 'They hand it over.'
  return {
    ...state,
    idShown: card.outcome,
    elapsedMs: state.elapsedMs + ID_CHECK_MS,
    message: `${line} ${describeId(card)}`,
  }
}

/**
 * Turns the sale down.
 *
 * The right call for anyone who cannot prove their age, and the wrong one for
 * anyone who can — but the clerk has to decide which, which is the mechanic.
 */
const onRefuseSale = (state: ShiftState): ShiftState => {
  const outcome = state.idShown ?? state.customer.idCard.outcome
  const points = idCheckPoints(outcome, false)
  const tally: ShiftTally = {
    ...state.tally,
    served: state.tally.served + 1,
    score: state.tally.score + points,
  }
  const message = isSaleLegal(outcome)
    ? 'They were old enough. They leave without their shopping.'
    : 'You turn them down. They mutter, and go.'
  return advance(state, tally, message)
}

/**
 * Points for how the age check was handled on a completed sale.
 */
const idPointsForSale = (state: ShiftState): number => {
  if (!requiresIdCheck(state.customer)) {
    return 0
  }
  if (state.idShown === undefined) {
    return ID_SCORE.skippedCheck
  }
  return idCheckPoints(state.idShown, true)
}

const onConfirm = (state: ShiftState): ShiftState => {
  if (state.phase !== 'changing' || !canTender(state)) {
    return state
  }
  const grade = gradeChange(state.tray, changeOwed(state), state.drawerAtTender)
  // Selling beer or tobacco without looking at an ID is its own mistake,
  // whether or not the customer happened to be old enough. Getting away with
  // it is not the same as doing it right.
  const idPoints = idPointsForSale(state)
  const par = parMs(lineCount(state.customer), state.customer.cigarette !== undefined)
  const speed = grade.correct ? speedPoints(state.elapsedMs - state.customerStartMs, par) : 0
  const tally: ShiftTally = {
    ...state.tally,
    served: state.tally.served + 1,
    exactChange: state.tally.exactChange + (grade.correct ? 1 : 0),
    wrongChange: state.tally.wrongChange + (grade.correct ? 0 : 1),
    sloppyChange: state.tally.sloppyChange + (grade.surplusCoins > 0 ? 1 : 0),
    drawerDelta: state.tally.drawerDelta + grade.drawerDelta,
    score: state.tally.score + grade.points + speed + idPoints,
  }
  // The customer's cash goes into the till. The tray has already been taken
  // out of it piece by piece, so this closes the loop: money is conserved.
  const drawer = mergePurses(state.drawer, state.customer.tender)
  const takings = state.takings + customerTotal(state.customer)
  return advance({ ...state, drawer, takings }, tally, confirmMessage(grade))
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
    case 'sweep': {
      return onSweep(state, event.item, event.to)
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
    case 'resolve': {
      return onResolve(state, event.how)
    }
    case 'ask-id': {
      return onAskId(state)
    }
    case 'refuse-sale': {
      return onRefuseSale(state)
    }
  }
}
