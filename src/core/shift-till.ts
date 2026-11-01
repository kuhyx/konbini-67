/**
Event arms at the till: counting change and talking your way out of an empty drawer.
*/

import { customerTotal } from './customer'
import { addDenom, DENOMS, formatYen, MANAGER_FLOAT, mergePurses, removeDenom } from './money'
import { nextFloat, type Rng } from './rng'
import { type Resolution, RESOLUTIONS, type ShiftTally } from './types'
import type { ShiftState } from './shift-state'
import { advance, changeOwed, isDenom, isFrozen, paidPurse } from './shift-queries'

/**
Picks one piece out of the drawer and into your hand.

Refuses when the drawer has none left: you cannot hand over a coin that is
not there, and that shortage is the whole point of a finite till.
*/
export const onGive = (state: ShiftState, denom: number): ShiftState => {
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
Puts a piece back in the drawer. The exact inverse of {@link onGive}.
*/
export const onTakeBack = (state: ShiftState, denom: number): ShiftState => {
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
Yen the drawer is short of making this customer's change exactly.

Zero when it can be made. Only ever a few yen in practice — it is the tail
of the amount that ran out of small coins.
*/
export const shortfall = (state: ShiftState): number => {
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
Talks your way out of a till that cannot make the change.

Every option costs shift time, and the ones the customer can refuse draw
their answer from a copy of the generator — never a fresh source — so a
seeded shift still replays identically.
*/
export const onResolve = (state: ShiftState, how: Resolution): ShiftState => {
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
