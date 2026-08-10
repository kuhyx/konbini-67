import type { CigaretteId, ItemId } from './catalog'
import type { Purse } from './money'
import type { RequestForm } from './shelf'

/**
 * One line on the receipt.
 */
export interface BasketLine {
  readonly item: ItemId
  readonly qty: number
}

/**
 * A cigarette request attached to a customer, if any.
 */
export interface CigaretteRequest {
  readonly cigarette: CigaretteId
  readonly form: RequestForm
}

export interface Customer {
  readonly id: number
  readonly name: string
  readonly basket: readonly BasketLine[]
  /**
   * What they hand over, in notes and coins.
   */
  readonly tender: Purse
  readonly cigarette: CigaretteRequest | undefined
}

/**
 * Where the transaction currently is.
 */
export type Phase =
  /**
   * Ringing items up.
   */
  | 'scanning'
  /**
   * Customer has asked for cigarettes; pick the slot.
   */
  | 'shelf'
  /**
   * Waiting for the player to count out change.
   */
  | 'changing'
  /**
   * Shift over.
   */
  | 'closed'

export const PHASE_ORDER = ['scanning', 'shelf', 'changing', 'closed'] as const

/**
 * What the player did, as a closed union the shift reducer switches over.
 */
export type ShiftEvent =
  | { readonly kind: 'scan' }
  | { readonly kind: 'pick-slot'; readonly slot: number }
  | { readonly kind: 'use-lookup' }
  | { readonly kind: 'give'; readonly denom: number }
  | { readonly kind: 'take-back'; readonly denom: number }
  | { readonly kind: 'confirm' }
  | { readonly kind: 'tick'; readonly deltaMs: number }
  | { readonly kind: 'restart'; readonly seed: number; readonly shift: number }

export const EVENT_KIND_ORDER = [
  'scan',
  'pick-slot',
  'use-lookup',
  'give',
  'take-back',
  'confirm',
  'tick',
  'restart',
] as const

/**
 * Running tally for one shift.
 */
export interface ShiftTally {
  readonly served: number
  readonly exactChange: number
  readonly wrongChange: number
  readonly wrongBrand: number
  readonly lookupsUsed: number
  readonly sloppyChange: number
  readonly score: number
  /**
   * Net yen the drawer is off by. Negative means you shorted yourself.
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
  score: 0,
  drawerDelta: 0,
}
