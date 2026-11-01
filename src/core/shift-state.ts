/**
The shift's state shape and its length.
*/

import type { CounterThing } from './catalog'
import { type Denom, type Purse } from './money'
import type { IdOutcome } from './id-check'
import type { Placed } from './layout'
import type { Cooking } from './hotfood'
import type { Mess } from './mess'
import type { Rng } from './rng'
import type { ShelfSpec } from './shelf'
import type { Stock } from './stock'
import { type Customer, type Gaze, type Phase, type ShiftTally } from './types'

/**
How long one shift runs, in milliseconds.
*/
export const SHIFT_MS = 180_000

export interface ShiftState {
  readonly phase: Phase
  readonly shift: number
  readonly shelf: ShelfSpec
  readonly rng: Rng
  readonly customer: Customer
  /**
  Items rung up so far.
  */
  readonly scanned: number
  /**
  The basket as it physically sits on the counter, one entry per item.
  
  Scanning means sweeping one of these over the beam, so the loose goods
  have to exist as things with positions rather than as a counter.
  */
  readonly onCounter: readonly Placed<CounterThing>[]
  /**
  The customer's cash, lying on the counter where they put it.
  
  A scattered pile rather than a total: counting it is the player's job,
  which is the whole reason the TENDERED readout was removed.
  
  Empty until the price has been announced — a customer cannot pay before
  they have been told what they owe.
  */
  readonly cashOnCounter: readonly Placed<Denom>[]
  /**
  Change counted out so far, physically taken from the drawer.
  */
  readonly tray: Purse
  /**
  What the clerk told the customer they owed.
  
  Undefined until announced. This is what they actually pay against — say
  the wrong number and, if they do not catch it, the wrong number is what
  the transaction settles on.
  */
  readonly quoted: number | undefined
  /**
  Whether the cigarette request has been satisfied.
  */
  readonly shelfDone: boolean
  /**
  Where the clerk is looking. Anything but `counter` hides the customer.
  */
  readonly gaze: Gaze
  /**
  Whether this customer has been asked to prove their age.
  
  Undefined means not asked — which on an age-restricted basket is itself
  a decision, and a scored one.
  */
  readonly idShown: IdOutcome | undefined
  /**
  What is actually in the till.
  
  Money is conserved: every piece in `tray` came out of here, and a
  customer's cash goes in at confirm. You work with what you have.
  */
  readonly drawer: Purse
  /**
  The drawer as it stood when this customer's change became owed.
  
  Grading needs a fixed reference: the live drawer shrinks as the player
  counts, so scoring against it would make a clumsy grab look better the
  more it took.
  */
  readonly drawerAtTender: Purse
  /**
  The float the shift opened with, kept for the end-of-shift books.
  */
  readonly openingFloat: Purse
  /**
  Yen that should have been taken in: every basket total rung up and paid
  for. What the drawer *ought* to hold is this plus the opening float.
  */
  readonly takings: number
  readonly elapsedMs: number
  /**
  When the current customer stepped up.
  */
  readonly customerStartMs: number
  /**
  Frozen until this timestamp, after using the lookup chart.
  */
  readonly frozenUntilMs: number
  readonly tally: ShiftTally
  /**
  What is left on the shelves.
  
  Depletes as you sell and refills only when you walk out back, which is
  what gives the gaps between customers a cost.
  */
  readonly stock: Stock
  /**
  Spills and litter waiting to be wiped up.
  
  Nobody asks you to clean, which is why the job slides — so the pressure
  comes from customers minding the state of the shop rather than a score.
  */
  readonly messes: readonly Mess[]
  /**
  Next id to hand a mess. Monotonic so two messes are never confusable.
  */
  readonly nextMessId: number
  /**
  When the next mess is due.
  */
  readonly nextMessAtMs: number
  /**
  Milliseconds of this customer's wait already forgiven by apologising.
  
  Held separately from `customerStartMs` so an apology reads as "some of
  that was excused" rather than rewriting when they arrived — which would
  also quietly reset the speed bonus.
  */
  readonly forgivenMs: number
  /**
  What is on the roller and in the warmer.
  
  The only part of the shop that changes state while you are doing
  something else. Stages are derived from `elapsedMs` rather than stored,
  so the same tick that runs the shift clock runs the food — there is no
  second timer, and there must never be one.
  */
  readonly hotCase: readonly Cooking[]
  /**
  Next id to hand a portion.
  */
  readonly nextCookId: number
  /**
  Most recent feedback line, for the UI.
  */
  readonly message: string
}
