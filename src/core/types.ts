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
 * Where the clerk is looking.
 *
 * One closed union rather than a boolean per surface: looking at the shelf,
 * the clock or the notebook all mean the same thing — you are not looking at
 * the customer — and independent flags would multiply against `Phase` into a
 * branch space that cannot be covered without exclusions.
 */
export type Gaze = 'counter' | 'shelf' | 'clock' | 'notebook'

export const GAZE_ORDER = ['counter', 'shelf', 'clock', 'notebook'] as const satisfies
  readonly Gaze[]

/**
 * What looking somewhere costs you.
 */
export interface GazeSpec {
  /**
   * Whether the customer, their speech and the receipt stay visible.
   *
   * False everywhere except the counter: you cannot read the cigarette wall,
   * the clock or your own notes while also reading the basket in front of you.
   */
  readonly canSeeCustomer: boolean
  /**
   * Label for the control that turns your head this way.
   */
  readonly label: string
}

export const GAZE: Record<Gaze, GazeSpec> = {
  counter: { canSeeCustomer: true, label: 'Back to the counter' },
  shelf: { canSeeCustomer: false, label: 'Turn to the shelf' },
  clock: { canSeeCustomer: false, label: 'Look at the clock' },
  notebook: { canSeeCustomer: false, label: 'Check your notes' },
}

/**
 * What the player did, as a closed union the shift reducer switches over.
 */
export type ShiftEvent =
  | { readonly kind: 'scan' }
  | { readonly kind: 'pick-slot'; readonly slot: number }
  | { readonly kind: 'look'; readonly at: Gaze }
  | { readonly kind: 'use-lookup' }
  | { readonly kind: 'give'; readonly denom: number }
  | { readonly kind: 'take-back'; readonly denom: number }
  | { readonly kind: 'confirm' }
  | { readonly kind: 'tick'; readonly deltaMs: number }
  | { readonly kind: 'restart'; readonly seed: number; readonly shift: number }

export const EVENT_KIND_ORDER = [
  'scan',
  'pick-slot',
  'look',
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
