import type { ItemId } from './catalog'
import type { HotItem } from './hotfood'
import type { Point } from './layout'
import type { Gaze } from './types'
import type { Resolution } from './resolution'

/**
What the player did, as a closed union the shift reducer switches over.
*/
export type ShiftEvent =
  | { readonly kind: 'scan' }
  | { readonly kind: 'sweep'; readonly item: number; readonly to: Point }
  | { readonly kind: 'pick-slot'; readonly slot: number }
  | { readonly kind: 'look'; readonly at: Gaze }
  | { readonly kind: 'use-lookup' }
  /**
  Tell the customer what they owe. The number is whatever the clerk typed,
  which is not necessarily what the register says.
  */
  | { readonly kind: 'announce'; readonly amount: number }
  | { readonly kind: 'give'; readonly denom: number }
  | { readonly kind: 'take-back'; readonly denom: number }
  | { readonly kind: 'confirm' }
  | { readonly kind: 'resolve'; readonly how: Resolution }
  | { readonly kind: 'ask-id' }
  | { readonly kind: 'refuse-sale' }
  /**
  Put more of one item out. Costs time you are not at the till.
  */
  | { readonly kind: 'restock'; readonly item: ItemId }
  /**
  Send away a customer whose basket the shop cannot fill.
  
  Distinct from `refuse-sale`, which is the age-check refusal: this one is
  the shop's own fault, and it is scored as a lost sale rather than a
  judgement call.
  */
  | { readonly kind: 'turn-away' }
  /**
  Wipe up one mess. Identified rather than indexed: the list is rendered
  sorted, so an index would silently clean the wrong thing.
  */
  | { readonly kind: 'clean'; readonly id: number }
  /**
  "Sorry to keep you." Buys back some of the wait, and costs a beat of the
  only currency the game has.
  */
  | { readonly kind: 'apologise' }
  /**
  Put a portion on to cook. Costs a moment of handling.
  */
  | { readonly kind: 'cook'; readonly what: HotItem }
  /**
  Take a portion out — to sell it, or to bin it if it is ruined.
  */
  | { readonly kind: 'take-out'; readonly id: number }
  | { readonly kind: 'tick'; readonly deltaMs: number }
  | { readonly kind: 'restart'; readonly seed: number; readonly shift: number }

export const EVENT_KIND_ORDER = [
  'scan',
  'sweep',
  'pick-slot',
  'look',
  'use-lookup',
  'announce',
  'give',
  'take-back',
  'confirm',
  'resolve',
  'ask-id',
  'refuse-sale',
  'restock',
  'turn-away',
  'clean',
  'apologise',
  'cook',
  'take-out',
  'tick',
  'restart',
] as const

/**
Running tally for one shift.
*/
export interface ShiftTally {
  readonly served: number
  readonly exactChange: number
  readonly wrongChange: number
  readonly wrongBrand: number
  readonly lookupsUsed: number
  readonly sloppyChange: number
  /**
  Sales where the price you said out loud was not the price on the register
  and the customer did not pull you up on it.
  */
  readonly misquoted: number
  /**
  Sales lost because the shelf was empty when someone wanted the thing.
  
  Housekeeping you did not do, measured in customers who walked.
  */
  readonly lostSales: number
  /**
  Trips out back to put more stock on the shelf.
  */
  readonly restocked: number
  /**
  Messes wiped up over the shift.
  */
  readonly cleaned: number
  /**
  Customers who gave up and walked out mid-transaction.
  */
  readonly walkedOut: number
  /**
  Portions left too long and thrown away.
  */
  readonly binned: number
  /**
  Hot food actually sold.
  */
  readonly hotSold: number
  readonly score: number
  /**
  Net yen the drawer is off by. Negative means you shorted yourself.
  */
  readonly drawerDelta: number
}

export const EMPTY_TALLY: ShiftTally = {
  served: 0,
  exactChange: 0,
  wrongChange: 0,
  wrongBrand: 0,
  lookupsUsed: 0,
  sloppyChange: 0,
  misquoted: 0,
  lostSales: 0,
  restocked: 0,
  cleaned: 0,
  walkedOut: 0,
  binned: 0,
  hotSold: 0,
  score: 0,
  drawerDelta: 0,
}
