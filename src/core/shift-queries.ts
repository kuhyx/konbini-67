/**
Read-only views of shift state, plus the hand-off to the next customer.
*/

import { customerTotal, makeCustomer } from './customer'
import { addDenom, type Denom, DENOMS, EMPTY_PURSE, type Purse } from './money'
import { type Mood, moodFor } from './patience'
import type { Rng } from './rng'
import type { ShiftTally } from './types'
import type { ShiftState } from './shift-state'
import { layOutBasket, lineCount } from './shift-setup'

/**
What is physically on the counter in front of you, in yen.
*/
export const cashPaid = (state: ShiftState): number => {
  let total = 0
  for (const piece of state.cashOnCounter) {
    total += piece.what
  }
  return total
}

/**
The money on the counter, as a purse — what goes into the till at confirm.
*/
export const paidPurse = (state: ShiftState): Purse => {
  let purse = EMPTY_PURSE
  for (const piece of state.cashOnCounter) {
    purse = addDenom(purse, piece.what)
  }
  return purse
}

/**
Yen still owed to the customer.

Measured against the price you *quoted*, not what the till says: the
customer paid the number they were told, so that is the number the change
has to come back from. Quoting wrong and then making correct change against
the wrong quote is a clean-looking transaction with a hole in the drawer.
*/
export const changeOwed = (state: ShiftState): number => cashPaid(state) - quotedPrice(state)

/**
The price the customer was told, falling back to the true total before one
has been said. Nothing pays out against a quote that does not exist yet.
*/
export const quotedPrice = (state: ShiftState): number => state.quoted ?? customerTotal(state.customer)

/**
Whether every item is scanned and any cigarette request is handled.
*/
export const canTender = (state: ShiftState): boolean =>
  state.scanned >= lineCount(state.customer) &&
  (state.customer.cigarette === undefined || state.shelfDone)

/**
Whether the lookup chart currently has the player frozen.
*/
export const isFrozen = (state: ShiftState): boolean => state.frozenUntilMs > state.elapsedMs

/**
Moves to the next customer, folding the finished one into the tally.

The generator is copied before it is drawn from, never advanced in place.
`Rng` is a mutable object, so reusing the caller's would make `reduce`
mutate its own input — the same state reduced twice would yield different
customers, and React's StrictMode (which double-invokes reducers in dev)
would silently desync dev from prod.
*/
export const advance = (state: ShiftState, tally: ShiftTally, message: string): ShiftState => {
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

export const isDenom = (value: number): value is Denom => {
  for (const denom of DENOMS) {
    if (denom === value) {
      return true
    }
  }
  return false
}

/**
How the person at the counter feels about how long this is taking.

Read from state rather than stored, so it can never drift out of step with
the clock — there is no anger variable to forget to update.
*/
export const moodOf = (state: ShiftState): Mood =>
  moodFor(Math.max(0, state.elapsedMs - state.customerStartMs - state.forgivenMs), state.messes)
