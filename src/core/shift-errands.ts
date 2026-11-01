/**
Event arms away from the till: hot food, apologies, restocking and the chart.
*/

import { ITEMS, type ItemId } from './catalog'
import { greedyChange, mergePurses } from './money'
import { CASE_CAPACITY, type HotItem, HOT_ITEMS, remove, stageOf } from './hotfood'
import { APOLOGY_FORGIVES_MS, APOLOGY_MS, canApologise } from './patience'
import { restock, RESTOCK_MS, SHELF_CAPACITY } from './stock'
import type { ShiftState } from './shift-state'
import { isFrozen, moodOf } from './shift-queries'

/**
How long handling a portion costs, in milliseconds.

Putting food on and taking it off are quick — the pressure is meant to come
from the timer running while you serve, not from the handling itself.
*/
export const HANDLE_MS = 800

/**
Puts one portion on to cook.

Refused when the case is full: without a cap the winning move is to fill
the roller at the start of the shift and never think about it again.
*/
export const onCook = (state: ShiftState, what: HotItem): ShiftState => {
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
Takes a portion out: sold if it is good, binned if it was left too long.

Both are the same action because they are the same motion — you find out
which it was by looking at what you are holding, which is the point of the
grace window being visible rather than announced.
*/
export const onTakeOut = (state: ShiftState, id: number): ShiftState => {
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
"Sorry to keep you."

Costs a beat and buys back part of the wait. Not a full reset: a real
apology buys you a moment, and forgiving everything would make the button
strictly better than simply being quick.
*/
export const onApologise = (state: ShiftState): ShiftState => {
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
Puts more of one item on the shelf.

Only out back, and only while nobody is mid-transaction: walking off to the
stockroom holding a customer's money is not a thing a clerk does. The cost
is `RESTOCK_MS` frozen, which is time the person at the counter is waiting.
*/
export const onRestock = (state: ShiftState, item: ItemId): ShiftState => {
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

export const onUseLookup = (state: ShiftState): ShiftState => {
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
