/**
The shift: one pure reducer over a closed event union.

Nothing here reads a clock or an rng directly — the tick delta arrives as
an argument and the generator lives in state — so a seeded shift replays
byte-identically. That is what makes the whole thing testable, and it is
enforced by the `no-restricted-properties` lint ban.

Each event arm is its own small function and `reduce` is a thin dispatcher,
which keeps every branch individually reachable from a test.
*/

import { onAnnounce, onClean, onLook, onPickSlot, onScan, onSweep, onTick } from './shift-counter'
import { onApologise, onCook, onRestock, onTakeOut, onUseLookup } from './shift-errands'
import { onGive, onResolve, onTakeBack } from './shift-till'
import { onAskId, onConfirm, onLostSale, onRefuseSale } from './shift-sale'
import { createShift } from './shift-setup'
import type { ShiftState } from './shift-state'
import type { ShiftEvent } from './types'

export { SHIFT_MS, type ShiftState } from './shift-state'
export { createShift, lineCount } from './shift-setup'
export { cashPaid, changeOwed, moodOf } from './shift-queries'
export { HANDLE_MS } from './shift-errands'
export { missingFromBasket } from './shift-sale'

/**
The reducer. Every arm of {@link ShiftEvent} is dispatched explicitly;
`noFallthroughCasesInSwitch` keeps it honest.
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
