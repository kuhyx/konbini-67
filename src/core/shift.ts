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

import {
  CIGARETTES,
  type CounterThing,
  ITEMS,
  type ItemId,
  SLOT_TO_CIGARETTE,
} from './catalog'
import { customerTotal, makeCustomer, tenderFor } from './customer'
import {
  addDenom,
  type Denom,
  DENOMS,
  EMPTY_PURSE,
  formatYen,
  greedyChange,
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
import {
  CASE_CAPACITY,
  type Cooking,
  type HotItem,
  HOT_ITEMS,
  remove,
  stageOf,
} from './hotfood'
import { CLEAN_MS, dropMess, type Mess, MESS_INTERVAL_MS, wipe } from './mess'
import {
  APOLOGY_FORGIVES_MS,
  APOLOGY_MS,
  canApologise,
  type Mood,
  moodFor,
  MOODS,
} from './patience'
import { createRng, nextFloat, type Rng } from './rng'
import { type ChangeGrade, gradeChange, parMs, speedPoints } from './score'
import { type ShelfSpec, shelfSpecForShift } from './shelf'
import {
  FULL_SHELF,
  outOfStockIn,
  restock,
  RESTOCK_MS,
  SHELF_CAPACITY,
  type Stock,
  takeFromShelf,
} from './stock'
import {
  EMPTY_TALLY,
  type Customer,
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
  readonly onCounter: readonly Placed<CounterThing>[]
  /**
   * The customer's cash, lying on the counter where they put it.
   *
   * A scattered pile rather than a total: counting it is the player's job,
   * which is the whole reason the TENDERED readout was removed.
   *
   * Empty until the price has been announced — a customer cannot pay before
   * they have been told what they owe.
   */
  readonly cashOnCounter: readonly Placed<Denom>[]
  /**
   * Change counted out so far, physically taken from the drawer.
   */
  readonly tray: Purse
  /**
   * What the clerk told the customer they owed.
   *
   * Undefined until announced. This is what they actually pay against — say
   * the wrong number and, if they do not catch it, the wrong number is what
   * the transaction settles on.
   */
  readonly quoted: number | undefined
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
   * What is left on the shelves.
   *
   * Depletes as you sell and refills only when you walk out back, which is
   * what gives the gaps between customers a cost.
   */
  readonly stock: Stock
  /**
   * Spills and litter waiting to be wiped up.
   *
   * Nobody asks you to clean, which is why the job slides — so the pressure
   * comes from customers minding the state of the shop rather than a score.
   */
  readonly messes: readonly Mess[]
  /**
   * Next id to hand a mess. Monotonic so two messes are never confusable.
   */
  readonly nextMessId: number
  /**
   * When the next mess is due.
   */
  readonly nextMessAtMs: number
  /**
   * Milliseconds of this customer's wait already forgiven by apologising.
   *
   * Held separately from `customerStartMs` so an apology reads as "some of
   * that was excused" rather than rewriting when they arrived — which would
   * also quietly reset the speed bonus.
   */
  readonly forgivenMs: number
  /**
   * What is on the roller and in the warmer.
   *
   * The only part of the shop that changes state while you are doing
   * something else. Stages are derived from `elapsedMs` rather than stored,
   * so the same tick that runs the shift clock runs the food — there is no
   * second timer, and there must never be one.
   */
  readonly hotCase: readonly Cooking[]
  /**
   * Next id to hand a portion.
   */
  readonly nextCookId: number
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
 * Where the customer drops their money — their side of the counter.
 */
const CASH_AREA = { x: 0.62, y: 0.12, width: 0.32, height: 0.45 }

/**
 * Where a packet fetched from the cigarette wall lands: your side of the
 * beam, so it still has to be passed over like everything else.
 */
const PACKET_AREA = { x: 0.08, y: 0.62, width: 0.22, height: 0.2 }


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
const layOutBasket = (rng: Rng, customer: Customer): readonly Placed<CounterThing>[] => {
  const loose: CounterThing[] = []
  for (const line of customer.basket) {
    for (let n = 0; n < line.qty; n += 1) {
      loose.push({ kind: 'item', id: line.item })
    }
  }
  return scatter(rng, loose, GOODS_AREA)
}

/**
 * Total items the current customer wants rung up.
 *
 * The cigarette packet counts: once fetched it lies on the counter and has to
 * go over the beam like anything else.
 */
export const lineCount = (customer: Customer): number => {
  let count = customer.cigarette === undefined ? 0 : 1
  for (const line of customer.basket) {
    count += line.qty
  }
  return count
}

/**
 * Items rung up before the cigarette request interrupts.
 *
 * The packet is not on the counter until it has been fetched, so the scanning
 * phase pauses one short of the full count. Only ever asked about a customer
 * who wants cigarettes, hence the unconditional subtraction.
 */
const basketCount = (customer: Customer): number => lineCount(customer) - 1

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
    // Nothing yet: they pay once they have been told the price.
    cashOnCounter: [],
    tray: EMPTY_PURSE,
    quoted: undefined,
    scanned: 0,
    shelfDone: false,
    gaze: 'counter',
    idShown: undefined,
    drawer: float,
    drawerAtTender: float,
    openingFloat: float,
    takings: 0,
    elapsedMs: 0,
    customerStartMs: 0,
    frozenUntilMs: 0,
    tally: EMPTY_TALLY,
    stock: FULL_SHELF,
    messes: [],
    nextMessId: 1,
    nextMessAtMs: MESS_INTERVAL_MS,
    forgivenMs: 0,
    hotCase: [],
    nextCookId: 1,
    message: 'Ring up the items.',
  }
}

/**
 * What is physically on the counter in front of you, in yen.
 */
export const cashPaid = (state: ShiftState): number => {
  let total = 0
  for (const piece of state.cashOnCounter) {
    total += piece.what
  }
  return total
}

/**
 * The money on the counter, as a purse — what goes into the till at confirm.
 */
const paidPurse = (state: ShiftState): Purse => {
  let purse = EMPTY_PURSE
  for (const piece of state.cashOnCounter) {
    purse = addDenom(purse, piece.what)
  }
  return purse
}

/**
 * Yen still owed to the customer.
 *
 * Measured against the price you *quoted*, not what the till says: the
 * customer paid the number they were told, so that is the number the change
 * has to come back from. Quoting wrong and then making correct change against
 * the wrong quote is a clean-looking transaction with a hole in the drawer.
 */
export const changeOwed = (state: ShiftState): number => cashPaid(state) - quotedPrice(state)

/**
 * The price the customer was told, falling back to the true total before one
 * has been said. Nothing pays out against a quote that does not exist yet.
 */
const quotedPrice = (state: ShiftState): number => state.quoted ?? customerTotal(state.customer)

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
    cashOnCounter: [],
    tray: EMPTY_PURSE,
    quoted: undefined,
    scanned: 0,
    shelfDone: false,
    gaze: 'counter',
    idShown: undefined,
    customerStartMs: state.elapsedMs,
    // Forgiveness is per-customer. Carrying it over would mean one apology
    // bought patience from everybody who came after.
    forgivenMs: 0,
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
  const ticked = { ...state, elapsedMs }
  // Someone who has had enough leaves, taking the sale with them. That is the
  // whole penalty — no score deduction on top, per the no-scoreboard rule.
  if (moodOf(ticked) === 'leaving') {
    return advance(
      ticked,
      { ...state.tally, walkedOut: state.tally.walkedOut + 1 },
      `${MOODS.leaving.line} They put the basket down and go.`,
    )
  }
  if (elapsedMs < state.nextMessAtMs) {
    return ticked
  }
  // Something got dropped. The rng lives in state, so which mess and where
  // stays part of the seeded replay rather than a wall-clock accident.
  const rng: Rng = { s: state.rng.s }
  return {
    ...state,
    elapsedMs,
    rng,
    messes: dropMess(rng, state.messes, state.nextMessId),
    nextMessId: state.nextMessId + 1,
    nextMessAtMs: elapsedMs + MESS_INTERVAL_MS,
  }
}

/**
 * Wipes up one mess.
 *
 * Allowed in any phase and from any gaze: unlike a restocking trip you are
 * still behind the counter, so this is an interruption rather than an errand.
 */
const onClean = (state: ShiftState, id: number): ShiftState => {
  const remaining = wipe(state.messes, id)
  if (remaining.length === state.messes.length || isFrozen(state)) {
    return state
  }
  return {
    ...state,
    messes: remaining,
    frozenUntilMs: state.elapsedMs + CLEAN_MS,
    tally: { ...state.tally, cleaned: state.tally.cleaned + 1 },
  }
}

const onScan = (state: ShiftState): ShiftState => {
  const total = lineCount(state.customer)
  if (isFrozen(state) || state.scanned >= total) {
    return state
  }
  const scanned = state.scanned + 1
  // The packet is not on the counter yet, so the basket runs out one short of
  // the full count and the customer's request interrupts here.
  if (state.customer.cigarette !== undefined && !state.shelfDone) {
    if (scanned >= basketCount(state.customer)) {
      return { ...state, scanned, phase: 'shelf', message: 'Cigarettes — pick the slot.' }
    }
    return { ...state, scanned }
  }
  if (scanned < total) {
    return { ...state, scanned }
  }
  return {
    ...state,
    scanned,
    phase: 'announcing',
    message: 'Tell them what it comes to.',
  }
}

/**
 * Says a price out loud — whatever price the clerk typed.
 *
 * The register shows the right number, but saying it is still a thing a human
 * does, and humans transpose digits. Quote the wrong amount and one of two
 * things happens, decided per customer when they walked in:
 *
 * - **They are paying attention.** They query it, you are told, and nothing
 *   is settled: type it again.
 * - **They are not.** They pay the number you said. If you overcharged, the
 *   drawer ends the shift long; if you undercharged, it ends short. Either
 *   way nobody mentions it, and you meet it at cash-up.
 *
 * That asymmetry is the whole mechanic: you never know which kind of customer
 * you got until you have already made the mistake.
 */
const onAnnounce = (state: ShiftState, amount: number): ShiftState => {
  if (state.phase !== 'announcing' || isFrozen(state)) {
    return state
  }
  const owed = customerTotal(state.customer)
  if (amount !== owed && state.customer.willQueryThePrice) {
    return {
      ...state,
      elapsedMs: state.elapsedMs + MISQUOTE_MS,
      message: `“Sorry — ${formatYen(amount)}? I make it less than that.” Try again.`,
    }
  }
  const rng: Rng = { s: state.rng.s }
  const misquote = amount - owed
  return {
    ...state,
    rng,
    phase: 'changing',
    quoted: amount,
    cashOnCounter: layOutCash(rng, tenderFor(state.customer, amount)),
    drawerAtTender: state.drawer,
    message:
      misquote === 0
        ? `“${formatYen(amount)}, please.” They put their money down.`
        : `“${formatYen(amount)}, please.” They pay it without looking up.`,
  }
}

/**
 * How long being pulled up on a wrong price costs you.
 */
const MISQUOTE_MS = 4000

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
  // The packet is a physical thing: you fetch it, put it on the counter, and
  // it still has to go over the beam like everything else.
  const rng: Rng = { s: state.rng.s }
  const picked = SLOT_TO_CIGARETTE.get(slot) ?? wanted.cigarette
  const packet = scatter(rng, [{ kind: 'cigarette', id: picked } as const], PACKET_AREA)
  return {
    ...state,
    rng,
    phase: 'scanning',
    shelfDone: true,
    gaze: 'counter',
    onCounter: [...state.onCounter, ...packet],
    tally: isRight ? state.tally : { ...state.tally, wrongBrand: state.tally.wrongBrand + 1 },
    message: isRight
      ? 'You put the packet on the counter.'
      : `That's not ${label}. You put it on the counter anyway.`,
  }
}

/**
 * Turns the clerk's head.
 *
 * Costs nothing but the time it takes — a real clerk is not fined for glancing
 * at the clock. The cost is that the shift keeps running while the customer is
 * out of view, so whatever you looked away to find, you had better remember.
 *
 * The message is left alone on purpose: where you are looking is obvious from
 * what is in front of you, and narrating it would trample the line that
 * actually carries information ("No beep. Try again.").
 */
const onLook = (state: ShiftState, at: Gaze): ShiftState => {
  if (isFrozen(state) || state.gaze === at) {
    return state
  }
  return { ...state, gaze: at }
}

/**
 * How long handling a portion costs, in milliseconds.
 *
 * Putting food on and taking it off are quick — the pressure is meant to come
 * from the timer running while you serve, not from the handling itself.
 */
export const HANDLE_MS = 800

/**
 * Puts one portion on to cook.
 *
 * Refused when the case is full: without a cap the winning move is to fill
 * the roller at the start of the shift and never think about it again.
 */
const onCook = (state: ShiftState, what: HotItem): ShiftState => {
  if (isFrozen(state) || state.hotCase.length >= CASE_CAPACITY) {
    return state
  }
  return {
    ...state,
    hotCase: [...state.hotCase, { what, startedMs: state.elapsedMs, id: state.nextCookId }],
    nextCookId: state.nextCookId + 1,
    frozenUntilMs: state.elapsedMs + HANDLE_MS,
    message: `${HOT_ITEMS[what].label} on.`,
  }
}

/**
 * Takes a portion out: sold if it is good, binned if it was left too long.
 *
 * Both are the same action because they are the same motion — you find out
 * which it was by looking at what you are holding, which is the point of the
 * grace window being visible rather than announced.
 */
const onTakeOut = (state: ShiftState, id: number): ShiftState => {
  const portion = state.hotCase.find((each) => each.id === id)
  if (portion === undefined || isFrozen(state)) {
    return state
  }
  const stage = stageOf(portion, state.elapsedMs)
  if (stage === 'cooking') {
    return { ...state, message: 'Not ready yet.' }
  }
  const spec = HOT_ITEMS[portion.what]
  const wasRuined = stage === 'ruined'
  return {
    ...state,
    hotCase: remove(state.hotCase, id),
    frozenUntilMs: state.elapsedMs + HANDLE_MS,
    // Money is conserved: what the drawer holds must always be the opening
    // float plus everything taken in. Adding a flat coin here instead of the
    // actual price opened a silent gap — the same shape of discrepancy a
    // misquote produces, but earned by nothing the player did.
    drawer: wasRuined ? state.drawer : mergePurses(state.drawer, greedyChange(spec.price)),
    takings: wasRuined ? state.takings : state.takings + spec.price,
    tally: {
      ...state.tally,
      binned: state.tally.binned + (wasRuined ? 1 : 0),
      hotSold: state.tally.hotSold + (wasRuined ? 0 : 1),
    },
    message: wasRuined ? `That ${spec.label.toLowerCase()} is ruined. Bin it.` : `${spec.label} sold.`,
  }
}

/**
 * How the person at the counter feels about how long this is taking.
 *
 * Read from state rather than stored, so it can never drift out of step with
 * the clock — there is no anger variable to forget to update.
 */
export const moodOf = (state: ShiftState): Mood =>
  moodFor(Math.max(0, state.elapsedMs - state.customerStartMs - state.forgivenMs), state.messes)

/**
 * "Sorry to keep you."
 *
 * Costs a beat and buys back part of the wait. Not a full reset: a real
 * apology buys you a moment, and forgiving everything would make the button
 * strictly better than simply being quick.
 */
const onApologise = (state: ShiftState): ShiftState => {
  if (!canApologise(moodOf(state)) || isFrozen(state)) {
    return state
  }
  return {
    ...state,
    forgivenMs: state.forgivenMs + APOLOGY_FORGIVES_MS,
    frozenUntilMs: state.elapsedMs + APOLOGY_MS,
    message: '“Taihen omatase itashimashita.”',
  }
}

/**
 * Puts more of one item on the shelf.
 *
 * Only out back, and only while nobody is mid-transaction: walking off to the
 * stockroom holding a customer's money is not a thing a clerk does. The cost
 * is `RESTOCK_MS` frozen, which is time the person at the counter is waiting.
 */
const onRestock = (state: ShiftState, item: ItemId): ShiftState => {
  if (state.gaze !== 'stockroom' || isFrozen(state) || state.phase !== 'scanning') {
    return state
  }
  if (state.stock[item] >= SHELF_CAPACITY) {
    return { ...state, message: `The ${ITEMS[item].label.toLowerCase()} shelf is already full.` }
  }
  return {
    ...state,
    stock: restock(state.stock, item),
    frozenUntilMs: state.elapsedMs + RESTOCK_MS,
    tally: { ...state.tally, restocked: state.tally.restocked + 1 },
    message: `Putting out ${ITEMS[item].label.toLowerCase()}…`,
  }
}

const onUseLookup = (state: ShiftState): ShiftState => {
  if (state.shelf.mode === 'labelled' || isFrozen(state)) {
    return state
  }
  return {
    ...state,
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
    const drawer = mergePurses(state.drawer, paidPurse(state))
    const takings = state.takings + customerTotal(state.customer)
    return advance(
      { ...state, rng, elapsedMs, drawer, takings },
      tally,
      `${spec.line} They wave it off. ${formatYen(gap)} short in the books.`,
    )
  }
  // Card, or smaller money: the sale closes cleanly with no change at all.
  // Whatever was already counted out goes back in the drawer either way.
  const tally: ShiftTally = { ...state.tally, served: state.tally.served + 1 }
  const drawer =
    how === 'offer-card' ? state.drawer : mergePurses(state.drawer, paidPurse(state))
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
 * What the current customer wants that the shop has not got.
 */
export const missingFromBasket = (state: ShiftState): readonly ItemId[] =>
  outOfStockIn(
    state.stock,
    state.customer.basket.map((line) => line.item),
  )

/**
 * Send away a customer whose basket the shop cannot fill.
 *
 * There is no scored penalty beyond the lost sale itself, in keeping with the
 * no-scoreboard rule: the shop simply took no money from someone who wanted to
 * give it some, and that shows up in the takings.
 */
const onLostSale = (state: ShiftState): ShiftState => {
  // Destructured rather than length-checked: `first` being defined is the
  // same fact as the list being non-empty, so this states it once instead of
  // leaving an `undefined` case that cannot happen but must still be written.
  const [first] = missingFromBasket(state)
  if (first === undefined || state.phase === 'closed') {
    return state
  }
  const label = ITEMS[first].label.toLowerCase()
  const tally: ShiftTally = { ...state.tally, lostSales: state.tally.lostSales + 1 }
  return advance(state, tally, `“Sorry, we’re out of ${label}.” They leave empty-handed.`)
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
  // A price you quoted wrong and they did not catch is money the shop is out
  // by, quietly. It never announces itself at the counter — you meet it when
  // the drawer does not balance.
  // `canTender` has already established the phase is `changing`, which is
  // only reachable through the announcement that sets `quoted` — so this is
  // read directly rather than defaulted.
  const misquote = quotedPrice(state) - customerTotal(state.customer)
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
    misquoted: state.tally.misquoted + (misquote === 0 ? 0 : 1),
    drawerDelta: state.tally.drawerDelta + grade.drawerDelta + misquote,
    score: state.tally.score + grade.points + speed + idPoints,
  }
  // The cash physically on the counter goes into the till. The tray has
  // already been taken out of it piece by piece, so this closes the loop:
  // money is conserved.
  const drawer = mergePurses(state.drawer, paidPurse(state))
  // Takings are what the shop *should* have taken — the real price of the
  // goods. Quoting wrong does not change what the basket was worth, which is
  // precisely why the discrepancy shows up.
  const takings = state.takings + customerTotal(state.customer)
  // Goods leave the shelf when the sale completes rather than when they are
  // scanned: a transaction abandoned halfway puts nothing back, because
  // nothing ever left.
  let stock = state.stock
  for (const line of state.customer.basket) {
    for (let n = 0; n < line.qty; n += 1) {
      stock = takeFromShelf(stock, line.item)
    }
  }
  return advance({ ...state, drawer, takings, stock }, tally, confirmMessage(grade))
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
    case 'announce': {
      return onAnnounce(state, event.amount)
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
    case 'restock': {
      return onRestock(state, event.item)
    }
    case 'turn-away': {
      return onLostSale(state)
    }
    case 'clean': {
      return onClean(state, event.id)
    }
    case 'apologise': {
      return onApologise(state)
    }
    case 'cook': {
      return onCook(state, event.what)
    }
    case 'take-out': {
      return onTakeOut(state, event.id)
    }
    case 'refuse-sale': {
      return onRefuseSale(state)
    }
  }
}
